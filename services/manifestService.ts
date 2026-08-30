import * as XLSX from 'xlsx';
import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { LogEntry, IdcBundle, ProcessingResult, BusinessPackage, RouteTextData } from '../types';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

type LogCallback = (message: string, type?: LogEntry['type']) => void;

// Helper to find header case-insensitively
const findHeaderKey = (row: any, candidates: string[]): string | undefined => {
  const keys = Object.keys(row);
  return keys.find(key => candidates.some(c => key.toLowerCase().includes(c)));
};

// Check PDF Header for Magic Bytes
const isPdfFile = (buffer: ArrayBuffer): boolean => {
  if (buffer.byteLength < 5) return false;
  const arr = new Uint8Array(buffer).subarray(0, 5);
  const header = String.fromCharCode(...arr);
  return header.startsWith('%PDF-');
};

const STOPWORDS = new Set(['ON', 'CA', 'ONTARIO', 'UNIT', 'SUITE', 'APT', 'APARTMENT', 'PO', 'BOX', 'APP', 'BUZZ', 'FLOOR', 'STE']);

// Normalize address to extract postal code, house number, and tokens
function normalize(addr: string) {
  const a = String(addr).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const pcm = a.match(/\b([A-Z]\d[A-Z])\s*(\d[A-Z]\d)\b/);
  const pc = pcm ? pcm[1] + pcm[2] : null;
  const nm = a.match(/\b(\d{1,6})\b/);
  const house = nm ? nm[1] : null;
  // Full set of meaningful tokens
  const allToks = a.split(' ').filter(t => t.length > 1 && !STOPWORDS.has(t));
  const wordToks = new Set(allToks.filter(t => /^[A-Z]+$/.test(t) && t.length > 2));
  const fullToks = new Set(allToks);
  return { pc, house, toks: wordToks, fullToks, norm: a };
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) {
    if (b.has(t)) n++;
  }
  return n;
}

// Jaccard similarity over full token sets
function tokenSim(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter++;
  }
  return inter / (a.size + b.size - inter);
}

// Collapse sequence numbers into range formatting
function formatSeqRange(seqs: string[]): string {
  const nums = [...new Set(seqs.map(s => parseInt(s)).filter(n => !isNaN(n)))].sort((a, b) => a - b);
  const nonNum = seqs.filter(s => isNaN(parseInt(s))).map(s => String(s).trim()).filter(Boolean);
  if (!nums.length) return nonNum.join(', ');
  const parts: string[] = [];
  let start = nums[0];
  let prev = nums[0];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === prev + 1) {
      prev = nums[i];
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = nums[i];
  }
  parts.push(start === prev ? `${start}` : `${start}–${prev}`);
  return [...parts, ...nonNum].join(', ');
}

// standalone matrix multiplication to replace pdfjsLib.Util.transform (which can be deprecated or missing in newer pdfjs-dist versions)
function multiplyMatrices(m1: number[], m2: number[]): number[] {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1
  ];
}

// High-fidelity column-based manifest parser
async function parseManifest(bytes: Uint8Array, onProgress: (p: number, n: number) => void) {
  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  const records: any[] = [];
  const routePages: { [key: string]: number[] } = {};
  const declared: { [key: string]: number } = {};
  let route: string | null = null;
  let cols: any = null;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const words = tc.items.filter((it: any) => it.str.trim()).map((it: any) => {
      const t = multiplyMatrices(vp.transform, it.transform);
      return { x: t[4], y: t[5], text: it.str };
    });

    const lineMap = new Map<number, any[]>();
    for (const w of words) {
      let key: number | null = null;
      for (const k of lineMap.keys()) {
        if (Math.abs(k - w.y) <= 2.5) {
          key = k;
          break;
        }
      }
      if (key === null) {
        key = w.y;
        lineMap.set(key, []);
      }
      lineMap.get(key)!.push(w);
    }

    const lines = [...lineMap.entries()].sort((a, b) => a[0] - b[0]).map(([y, ws]) => ws.sort((a, b) => a.x - b.x));
    let lastRec: any = null;

    for (const ws of lines) {
      const text = ws.map(w => w.text).join(' ');

      const rm = text.match(/Route\s*-\s*(\S+)/);
      if (rm) {
        route = rm[1].toUpperCase();
        const dm = text.match(/packages\s*:\s*(\d+)/);
        if (dm && !(route in declared)) declared[route] = parseInt(dm[1]);
        if (!routePages[route]) routePages[route] = [];
        if (!routePages[route].includes(p - 1)) routePages[route].push(p - 1);
        lastRec = null;
        continue;
      }

      // Learn column positions from header row on this page
      if (/\bCode\b/.test(text) && /\bAddress\b/.test(text)) {
        const find = (lbl: string) => {
          const w = ws.find(w => w.text.trim().startsWith(lbl));
          return w ? w.x : null;
        };
        const c = { code: find('Code'), track: find('Tracking'), seq: find('Seq'), addr: find('Address'), dims: find('Dimensions') };
        if (c.code != null && c.seq != null && c.addr != null) {
          const tr = (c.track != null ? c.track : c.code + 100);
          const dm2 = (c.dims != null ? c.dims : c.addr + 300);
          cols = {
            code: [c.code - 8, tr - 3],
            track: [tr - 3, c.seq - 3],
            seq: [c.seq - 3, c.addr - 3],
            addr: [c.addr - 3, dm2 - 3],
            dims: [dm2 - 3, 1e9]
          };
        }
        lastRec = null;
        continue;
      }
      if (!cols) continue;

      const bucket = (r: number[]) => ws.filter(w => w.x >= r[0] && w.x < r[1]).map(w => w.text).join(' ').trim();
      const code = bucket(cols.code);
      const track = bucket(cols.track);
      const seq = bucket(cols.seq);
      const addr = bucket(cols.addr);

      if (/^(D|CPUP|RET)\d{6,}/.test(code)) {
        lastRec = { route, code: code.split(' ')[0], track, seq, address: addr };
        records.push(lastRec);
        if (route) {
          if (!routePages[route]) routePages[route] = [];
          if (!routePages[route].includes(p - 1)) routePages[route].push(p - 1);
        }
      } else if (addr && !code && !seq && lastRec) {
        lastRec.address += ' ' + addr;
      }
    }
    if (p % 25 === 0 || p === doc.numPages) {
      onProgress(p, doc.numPages);
    }
  }
  return { records, routePages, declared, numPages: doc.numPages };
}

function parseSeqSet(seqStr: string): Set<number> {
  const nums = new Set<number>();
  if (!seqStr) return nums;
  const parts = String(seqStr).split(/[,;|\n\r]+/);
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    const rangeMatch = p.match(/^(\d+)\s*[-–—~]\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (!isNaN(start) && !isNaN(end) && start <= end && end - start <= 500) {
        for (let i = start; i <= end; i++) nums.add(i);
        continue;
      }
    }
    const cleanNum = p.replace(/\D/g, '');
    if (cleanNum) {
      const n = parseInt(cleanNum, 10);
      if (!isNaN(n)) nums.add(n);
    }
  }
  return nums;
}

function extractUnitStr(addr: string): string | null {
  if (!addr) return null;
  const m = addr.match(/(?:UNIT|SUITE|STE|APT|BLDG|ROOM|RM|#)\s*[-#]?\s*([A-Z0-9-]+)/i);
  return m ? m[0].trim().toUpperCase() : null;
}

function crossMatch(records: any[], biz: any[]): any[] {
  const bizParsed = biz.map((b, i) => {
    const seqSet = parseSeqSet(b.seq);
    const normRoute = b.route ? b.route.trim().toUpperCase() : '';
    const normAddr = b.address ? normalize(b.address) : null;
    return {
      index: i,
      raw: b,
      seqSet,
      normRoute,
      normAddr
    };
  });

  const addrIndex = new Map<string, number[]>();
  bizParsed.forEach((bp) => {
    if (bp.normAddr && bp.normAddr.pc && bp.normAddr.house) {
      const k = bp.normAddr.pc + '|' + bp.normAddr.house;
      if (!addrIndex.has(k)) addrIndex.set(k, []);
      addrIndex.get(k)!.push(bp.index);
    }
  });

  const groups = new Map<string, any>();

  for (const r of records) {
    const rSeqNum = parseInt(String(r.seq).replace(/\D/g, ''), 10);
    const rRouteUpper = r.route ? r.route.trim().toUpperCase() : '';
    const rNorm = normalize(r.address);

    let matchedBizIdx = -1;
    let matchedBySeq = false;

    // Priority 1: Direct sequence match (from Excel sequence column)
    for (const bp of bizParsed) {
      if (bp.seqSet.size > 0) {
        if (bp.normRoute && bp.normRoute !== rRouteUpper && !rRouteUpper.includes(bp.normRoute) && !bp.normRoute.includes(rRouteUpper)) {
          continue;
        }
        if (!isNaN(rSeqNum) && bp.seqSet.has(rSeqNum)) {
          matchedBizIdx = bp.index;
          matchedBySeq = true;
          break;
        } else if (r.seq && bp.raw.seq && String(r.seq).trim() === String(bp.raw.seq).trim()) {
          matchedBizIdx = bp.index;
          matchedBySeq = true;
          break;
        }
      }
    }

    // Priority 2: Address fuzzy match (if not matched by sequence and valid address present)
    if (matchedBizIdx < 0 && rNorm.pc && rNorm.house) {
      const cands = addrIndex.get(rNorm.pc + '|' + rNorm.house) || [];
      let bestSim = 0;
      for (const ci of cands) {
        const bp = bizParsed[ci];
        if (!bp.normAddr) continue;
        const sim = tokenSim(rNorm.fullToks, bp.normAddr.fullToks);
        const streetOverlap = overlap(rNorm.toks, bp.normAddr.toks);
        if ((sim >= 0.5 || streetOverlap >= 1) && sim > bestSim) {
          bestSim = sim;
          matchedBizIdx = ci;
        }
      }
    }

    if (matchedBizIdx < 0) continue;

    const key = r.route + '|' + matchedBizIdx;
    const b = biz[matchedBizIdx];

    // Unit/Suite/Apt comparison between Manifest (r.address) and Directory (b.address)
    const manifestUnit = extractUnitStr(r.address);
    const directoryUnit = extractUnitStr(b.address);

    let isPossibleBusiness = false;
    let unitNote = '';

    if (manifestUnit && (!directoryUnit || manifestUnit !== directoryUnit)) {
      isPossibleBusiness = true;
      unitNote = `Possible Business (Manifest Unit: ${manifestUnit}${directoryUnit ? ', Directory: ' + directoryUnit : ''})`;
    } else if (matchedBySeq && b.address && r.address && r.address.trim().toUpperCase() !== b.address.trim().toUpperCase()) {
      isPossibleBusiness = true;
      unitNote = `Possible Business (Matched by Sequence)`;
    }

    // Always prefer Manifest address reference to capture exact unit/suite/apt
    const displayAddress = (r.address && r.address.trim()) ? r.address : b.address;

    if (!groups.has(key)) {
      groups.set(key, {
        route: r.route,
        seqs: [],
        address: displayAddress,
        closing: b.closing,
        instr: b.instr,
        unitNote: unitNote,
        isPossibleBusiness: isPossibleBusiness
      });
    }
    const grp = groups.get(key);
    if (!grp.seqs.includes(r.seq)) grp.seqs.push(r.seq);
    if (unitNote && !grp.unitNote) grp.unitNote = unitNote;
    if (isPossibleBusiness) grp.isPossibleBusiness = true;
  }

  const matches: any[] = [];
  for (const g of groups.values()) {
    matches.push({
      route: g.route,
      seq: formatSeqRange(g.seqs),
      seqCount: g.seqs.length,
      address: g.address,
      closing: g.closing,
      instr: g.instr,
      unitNote: g.unitNote,
      isPossibleBusiness: g.isPossibleBusiness
    });
  }
  return matches;
}

function sanitizeWinAnsi(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/[⚠️⚠]/g, '[!]')
    .replace(/⏰/g, '')
    .replace(/📌/g, '*')
    .replace(/·/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ')
    .trim();
}

// Wrap text helper for PDF-Lib layout
function wrapText(text: string, font: any, size: number, maxW: number): string[] {
  const words = sanitizeWinAnsi(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (font.widthOfTextAtSize(test, size) <= maxW) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      while (font.widthOfTextAtSize(cur, size) > maxW && cur.length > 1) {
        let i = cur.length - 1;
        while (i > 1 && font.widthOfTextAtSize(cur.slice(0, i), size) > maxW) i--;
        lines.push(cur.slice(0, i));
        cur = cur.slice(i);
      }
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// Generate the landscape summary PDF document
async function buildSummaryDoc(idcName: string, stops: any[], todayStr: string): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont('Helvetica');
  const bold = await doc.embedFont('Helvetica-Bold');
  const W = 792;
  const H = 612;

  // Custom theme colors matching design principles
  const TURQ = rgb(0, 0.651, 0.561);
  const TURQDK = rgb(0, 0.502, 0.427);
  const ORANGE = rgb(0.973, 0.510, 0.137);
  const PAPER = rgb(0.953, 0.961, 0.957);
  const GREY = rgb(0.8, 0.8, 0.8);
  const INK = rgb(0.04, 0.12, 0.11);

  const colX = [40, 125, 225];
  const colW = [80, 95, 527];
  const right = 752;

  let page: any;
  let y: number;

  function newPage() {
    page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 95, width: W, height: 95, color: TURQ });
    page.drawRectangle({ x: 0, y: H - 99, width: W, height: 4, color: TURQDK });
    page.drawText(sanitizeWinAnsi(`Business Stops on Your Routes Today - ${idcName}`).slice(0, 80), { x: 40, y: H - 52, size: 17, font: bold, color: rgb(1, 1, 1) });
    page.drawText(sanitizeWinAnsi(`Dragonfly / Intelcom - Kitchener (KTCH) Station - ${todayStr} - Prioritize these stops before closing time to reduce FDA.`), { x: 40, y: H - 72, size: 10, font: helv, color: rgb(1, 1, 1) });
    y = H - 125;
  }

  function tableHeader() {
    page.drawRectangle({ x: 40, y: y - 18, width: right - 40, height: 18, color: TURQDK });
    const hdrs = ['Route', 'Seq Range', 'Address - Instructions if Any'];
    hdrs.forEach((h, i) => page.drawText(h, { x: colX[i] + 4, y: y - 13, size: 8.5, font: bold, color: rgb(1, 1, 1) }));
    y -= 18;
  }

  newPage();

  if (stops.length === 0) {
    page.drawText('No reported business stops on your routes today.', { x: 40, y, size: 12, font: bold, color: TURQDK });
    y -= 18;
    page.drawText('If you deliver to any business today, report it — see the format below.', { x: 40, y, size: 10, font: helv, color: INK });
    y -= 24;
  } else {
    tableHeader();
    let alt = false;
    for (const s of stops) {
      const seqLines = wrapText(String(s.seq), bold, 8.5, colW[1] - 8);
      const addrLines = wrapText(s.address, bold, 8.5, colW[2] - 12);

      const notes = [];
      if (s.closing) notes.push(`Closes: ${s.closing}`);
      if (s.instr) notes.push(`Instruction: ${s.instr}`);
      if (s.unitNote) notes.push(s.unitNote);
      const noteStr = notes.join('  -  ');
      const noteLines = noteStr ? wrapText(noteStr, bold, 7.5, colW[2] - 16) : [];

      const textH = (addrLines.length * 10) + (noteLines.length ? (noteLines.length * 9 + 6) : 0) + 8;
      const rowH = Math.max(22, textH);

      if (y - rowH < 130) {
        newPage();
        tableHeader();
        alt = false;
      }

      if (alt) {
        page.drawRectangle({ x: 40, y: y - rowH, width: right - 40, height: rowH, color: PAPER });
      }
      page.drawLine({ start: { x: 40, y: y - rowH }, end: { x: right, y: y - rowH }, thickness: 0.4, color: GREY });
      let ty = y - 11;
      page.drawText(s.route, { x: colX[0] + 4, y: ty, size: 8.5, font: helv, color: INK });
      seqLines.forEach((l, i) => page.drawText(l, { x: colX[1] + 4, y: ty - i * 10, size: 8.5, font: bold, color: INK }));

      let aty = ty;
      addrLines.forEach((l) => {
        page.drawText(l, { x: colX[2] + 4, y: aty, size: 8.5, font: bold, color: INK });
        aty -= 10;
      });

      if (noteLines.length) {
        const boxH = noteLines.length * 9 + 4;
        const boxY = aty - boxH + 2;
        page.drawRectangle({
          x: colX[2] + 2,
          y: boxY,
          width: colW[2] - 8,
          height: boxH,
          color: rgb(0.99, 0.95, 0.88),
          borderColor: ORANGE,
          borderWidth: 0.6
        });
        let nty = aty - 5;
        noteLines.forEach((l) => {
          page.drawText(l, { x: colX[2] + 6, y: nty, size: 7.5, font: bold, color: ORANGE });
          nty -= 9;
        });
      }

      y -= rowH;
      alt = !alt;
    }
  }

  if (y < 175) {
    newPage();
  }
  y -= 22;
  page.drawText('Found an unreported business on your route?', { x: 40, y, size: 11.5, font: bold, color: TURQDK });
  y -= 15;
  page.drawText('Please inform your supervisor at the end of your shift using the standard format — route number, business', { x: 40, y, size: 9.5, font: helv, color: INK });
  y -= 12;
  page.drawText('sequence numbers, plus closing time and any delivery instructions if known:', { x: 40, y, size: 9.5, font: helv, color: INK });
  y -= 30;
  page.drawRectangle({ x: 40, y: y - 6, width: right - 40, height: 26, color: PAPER, borderColor: ORANGE, borderWidth: 1 });
  page.drawText('Example:  KTCH1230 Business seq — 4, 8, 19, 65  (seq 19 closes 5pm, back door)', { x: 50, y: y + 2, size: 9.5, font: bold, color: INK });

  return doc;
}

// Generate portrait phone-shaped WhatsApp PDF document
async function buildWhatsAppDoc(idcName: string, byRoute: any, routes: string[], todayStr: string): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont('Helvetica');
  const bold = await doc.embedFont('Helvetica-Bold');
  const mm = 2.83465;
  const W = 90 * mm;
  const H = 190 * mm;

  const TURQ = rgb(0, 0.651, 0.561);
  const TURQDK = rgb(0, 0.502, 0.427);
  const ORANGE = rgb(0.973, 0.510, 0.137);
  const PAPER = rgb(0.953, 0.961, 0.957);
  const BLUE = rgb(0.063, 0.412, 0.663);
  const INK = rgb(0.04, 0.12, 0.11);
  const GREY = rgb(0.87, 0.87, 0.87);
  const MUTE = rgb(0.2, 0.2, 0.2);

  const LM = 5 * mm;
  const RM = W - 5 * mm;
  const contentW = RM - LM;

  let page: any;
  let y: number;
  let pageNo = 0;

  const boxLines: [string, string, number, any][] = [
    ['Found an unreported business?', 'bold', 8, TURQDK],
    ['Text your supervisor at end of shift:', 'helv', 7.5, MUTE],
    ['Route + Business seq', 'bold', 7.5, INK],
    ['e.g. KTCH1230 seq — 4, 8, 19,', 'helv', 7.5, MUTE],
    ['closing time / Any instructions.', 'helv', 7.5, MUTE],
  ];
  const boxH = boxLines.length * 10 + 8;
  const BOX_BOTTOM = 8 * mm;
  const BOX_TOP = BOX_BOTTOM + boxH;
  const CONTENT_FLOOR = BOX_TOP + 6 * mm;

  function drawFooterBox(pg: any) {
    pg.drawRectangle({ x: LM, y: BOX_BOTTOM, width: contentW, height: boxH, color: PAPER, borderColor: ORANGE, borderWidth: 0.8 });
    let by2 = BOX_TOP - 12;
    boxLines.forEach(([t, f, sz, c]) => {
      pg.drawText(t, { x: LM + 6, y: by2, size: sz, font: (f === 'bold' ? bold : helv), color: c });
      by2 -= 10;
    });
  }

  function header() {
    pageNo++;
    page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 24 * mm, width: W, height: 24 * mm, color: TURQ });
    page.drawRectangle({ x: 0, y: H - 24.6 * mm, width: W, height: 0.6 * mm, color: TURQDK });
    page.drawText('Business Stops Today', { x: 6 * mm, y: H - 11 * mm, size: 12, font: bold, color: rgb(1, 1, 1) });
    page.drawText(idcName.slice(0, 44), { x: 6 * mm, y: H - 15.5 * mm, size: 7, font: helv, color: rgb(1, 1, 1) });
    page.drawText(sanitizeWinAnsi(`Dragonfly / Intelcom - KTCH - ${todayStr}`), { x: 6 * mm, y: H - 19.5 * mm, size: 6.5, font: helv, color: rgb(1, 1, 1) });
    page.drawText(`Page ${pageNo}`, { x: RM - 14, y: 5 * mm, size: 6, font: helv, color: rgb(0.6, 0.6, 0.6) });
    drawFooterBox(page);
    y = H - 30 * mm;
  }

  function ensure(space: number) {
    if (y - space < CONTENT_FLOOR) {
      header();
    }
  }

  header();
  const routesWith = routes.filter(rt => (byRoute[rt] || []).length);
  const total = routesWith.reduce((a, rt) => a + byRoute[rt].length, 0);

  if (total === 0) {
    page.drawText('No reported business stops on', { x: LM, y, size: 9, font: bold, color: TURQDK });
    y -= 13;
    page.drawText('your routes today.', { x: LM, y, size: 9, font: bold, color: TURQDK });
    y -= 16;
    wrapText('If you deliver to a business today, report it to your supervisor — see below.', helv, 8, contentW).forEach(l => {
      page.drawText(l, { x: LM, y, size: 8, font: helv, color: INK });
      y -= 10;
    });
  } else {
    wrapText(`${total} business stop${total !== 1 ? 's' : ''} across ${routesWith.length} route${routesWith.length !== 1 ? 's' : ''}. Prioritize before closing time.`, helv, 8, contentW)
      .forEach(l => {
        page.drawText(l, { x: LM, y, size: 8, font: helv, color: INK });
        y -= 10.5;
      });
    y -= 4;
    for (const rt of routesWith) {
      const stops = byRoute[rt];
      y -= 6;
      ensure(20);
      page.drawText(sanitizeWinAnsi(`${rt} - ${stops.length} stop${stops.length !== 1 ? 's' : ''}`), { x: LM, y, size: 9.5, font: bold, color: TURQDK });
      y -= 13;
      for (const s of stops) {
        const seqTxt = String(s.seq);
        const isMulti = seqTxt.length > 8 || (s.seqCount && s.seqCount > 1);
        const badgeW = isMulti ? Math.min(36 * mm, Math.max(12 * mm, bold.widthOfTextAtSize(seqTxt, 8) + 8)) : Math.max(8 * mm, Math.min(28 * mm, bold.widthOfTextAtSize(seqTxt, 8.5) + 8));
        const addrX = LM + badgeW + 2 * mm;
        const wrapW = RM - addrX;

        const seqLines = wrapText(seqTxt, bold, 7.5, badgeW - 4);
        const addrLines = wrapText(s.address, bold, 8, wrapW);
        const meta = [];
        if (s.unitNote) meta.push('[!] ' + s.unitNote);
        if (s.closing) meta.push('Closes: ' + s.closing);
        if (s.instr) meta.push('Instruction: ' + s.instr);
        const metaLines = meta.length ? wrapText(meta.join(' - '), bold, 7.5, wrapW - 4) : [];

        const badgeH = Math.max(6 * mm, seqLines.length * 9 + 4);
        const textH = addrLines.length * 9.5 + (metaLines.length ? metaLines.length * 8.5 + 6 : 0) + 6;
        const rowH = Math.max(textH, badgeH + 4);
        ensure(rowH);

        page.drawRectangle({ x: LM, y: y - badgeH + 1, width: badgeW, height: badgeH, color: BLUE });
        let bty = y - 7;
        seqLines.forEach(l => {
          const lsw = bold.widthOfTextAtSize(l, 7.5);
          page.drawText(l, { x: LM + Math.max(1.5, (badgeW - lsw) / 2), y: bty, size: 7.5, font: bold, color: rgb(1, 1, 1) });
          bty -= 9;
        });

        let ty = y;
        addrLines.forEach(l => {
          page.drawText(l, { x: addrX, y: ty - 7, size: 8, font: bold, color: INK });
          ty -= 9.5;
        });
        if (metaLines.length) {
          const mBoxH = metaLines.length * 8.5 + 3;
          page.drawRectangle({
            x: addrX - 2,
            y: ty - mBoxH - 3,
            width: wrapW + 2,
            height: mBoxH,
            color: rgb(0.99, 0.95, 0.88),
            borderColor: ORANGE,
            borderWidth: 0.5
          });
          metaLines.forEach(l => {
            page.drawText(l, { x: addrX, y: ty - 8, size: 7.5, font: bold, color: ORANGE });
            ty -= 8.5;
          });
        }
        y -= rowH;
        page.drawLine({ start: { x: LM, y: y + 2 }, end: { x: RM, y: y + 2 }, thickness: 0.3, color: GREY });
      }
      y -= 4;
    }
  }

  return doc;
}

// Generate Excel Summary Report (includes Route splits & Stats)
export const generateSummaryExcel = (summaryRows: any[], businessPackages: BusinessPackage[]): Blob => {
  const summaryWb = XLSX.utils.book_new();

  // Sheet 1: Route Summary
  const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(summaryWb, summaryWs, "Route Summary");

  // Sheet 2: IDC Stats
  const idcStats = new Map<string, { count: number; pages: number }>();
  summaryRows.forEach(row => {
    const curr = idcStats.get(row.IDC) || { count: 0, pages: 0 };
    curr.count += 1;
    curr.pages += row["Pages Found"] || 0;
    idcStats.set(row.IDC, curr);
  });

  const idcSummaryData = Array.from(idcStats.entries()).map(([idc, stats]) => ({
    IDC: idc,
    Total_Routes: stats.count,
    Total_Pages: stats.pages
  }));
  const idcWs = XLSX.utils.json_to_sheet(idcSummaryData);
  XLSX.utils.book_append_sheet(summaryWb, idcWs, "IDC Summary");

  // Sheet 3: Business Packages Summary
  if (businessPackages.length > 0) {
    const businessData = businessPackages.map(bp => {
      const notes = [
        bp.unitNote ? `⚠️ ${bp.unitNote}` : '',
        bp.closing ? `Closing Time: ${bp.closing}` : '',
        bp.instr ? `Instructions: ${bp.instr}` : ''
      ].filter(Boolean).join(' | ');

      return {
        IDC: bp.idc,
        Route: bp.route,
        "Sequence Range": bp.seq,
        "Package / Stop Count": bp.seqCount,
        "Address - Instructions if Any": notes ? `${bp.address} (${notes})` : bp.address
      };
    });
    const busWs = XLSX.utils.json_to_sheet(businessData);
    XLSX.utils.book_append_sheet(summaryWb, busWs, "Business Packages");
  }

  const summaryExcelBuffer = XLSX.write(summaryWb, { bookType: 'xlsx', type: 'array' });
  return new Blob([summaryExcelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

// Generate Master ZIP (Includes split IDC ZIPs, Consolidated Excel, and IDC Summaries)
export const generateMasterZip = async (result: ProcessingResult): Promise<Blob> => {
  const zip = new JSZip();

  // Master Summary Report
  zip.file(result.summaryName, result.summaryBlob);

  // Add all Individual IDC ZIP bundles
  result.idcBundles.forEach(bundle => {
    zip.file(bundle.filename, bundle.blob);
  });

  return await zip.generateAsync({ type: "blob" });
};

// Core Execution Orchestrator
export const processManifests = async (
  pdfFile: File,
  excelFile: File, // Route Config Mapping (Excel)
  bizFile: File, // Business Address Directory (Excel)
  qrFile: File | null,
  log: LogCallback,
  onProgress: (percent: number) => void,
  shouldStop: { current: boolean }
): Promise<ProcessingResult> => {
  try {
    const currentDateStr = new Date().toISOString().split('T')[0];

    // 1. Read Route Config mapping Excel
    if (shouldStop.current) throw new Error("Process stopped by user.");
    log("Reading Route Configuration Excel mapping...", "info");
    const routeConfigBuffer = await excelFile.arrayBuffer();
    const configWb = XLSX.read(routeConfigBuffer);
    const configWsName = configWb.SheetNames[0];
    const configData = XLSX.utils.sheet_to_json<any>(configWb.Sheets[configWsName]);

    if (!configData.length) throw new Error("Route Configuration Excel is empty.");

    let routeKey = findHeaderKey(configData[0], ['route', 'ktch', 'lndn', 'manifest', '#']);
    let idcKey = findHeaderKey(configData[0], ['idc', 'hub', 'depot', 'location']);

    // Fallback: search all rows for matching column keys
    if (!routeKey || !idcKey) {
      for (const row of configData) {
        if (!routeKey) routeKey = findHeaderKey(row, ['route', 'ktch', 'lndn', 'manifest', '#']);
        if (!idcKey) idcKey = findHeaderKey(row, ['idc', 'hub', 'depot', 'location']);
        if (routeKey && idcKey) break;
      }
    }

    // Direct fallback to common keys or first/second columns
    if (!routeKey) {
      const keys = configData[0] ? Object.keys(configData[0]) : [];
      routeKey = keys.find(k => ['route', 'route#', 'ktch', 'lndn', 'rt', 'manifest'].includes(k.toLowerCase())) || keys[0];
    }
    if (!idcKey) {
      const keys = configData[0] ? Object.keys(configData[0]) : [];
      idcKey = keys.find(k => ['idc', 'hub', 'depot', 'location', 'carrier'].includes(k.toLowerCase())) || keys[1];
    }

    if (!routeKey || !idcKey) {
      const found = configData[0] ? Object.keys(configData[0]).join(", ") : "none";
      throw new Error(`Route Config Excel columns 'Route' and 'IDC' not detected. Found: ${found}`);
    }

    log(`Mapped Route Config - Route column: '${routeKey}', IDC column: '${idcKey}'`, "success");

    const routeToIdc = new Map<string, string>();
    const orderedRoutes: string[] = [];
    configData.forEach(row => {
      const route = String(row[routeKey]).trim().toUpperCase();
      const idc = String(row[idcKey]).trim();
      if (route && idc) {
        routeToIdc.set(route, idc);
        orderedRoutes.push(route);
      }
    });

    log(`Loaded ${routeToIdc.size} route mappings.`, "success");
    onProgress(5);

    // 2. Read Business Address Directory Excel
    if (shouldStop.current) throw new Error("Process stopped by user.");
    log("Reading Business Address Directory...", "info");
    const bizBuffer = await bizFile.arrayBuffer();
    const bizWb = XLSX.read(bizBuffer, { cellDates: true });
    const bizWsName = bizWb.SheetNames[0];
    const bizRaw = XLSX.utils.sheet_to_json<any[]>(bizWb.Sheets[bizWsName], { header: 1, raw: false, defval: '' });

    if (!bizRaw || !bizRaw.length) throw new Error("Business Address Directory Excel is empty.");

    // Find header row hi by checking for address, sequence, location keywords in top rows
    let hi = bizRaw.findIndex(r => r && Array.isArray(r) && r.some((c: any) => {
      const s = String(c).trim().toLowerCase();
      return ['address', 'location', 'street', 'business', 'seq', 'sequence', 'stop', 'route', 'instruction', 'closing', 'possible'].some(k => s.includes(k));
    }));
    if (hi < 0) hi = 0;

    const hrow = bizRaw[hi] && Array.isArray(bizRaw[hi]) ? bizRaw[hi].map((c: any) => String(c).trim()) : [];
    const hrowUpper = hrow.map(c => c.toUpperCase());

    const findColIdx = (candidates: string[]) => {
      let idx = hrowUpper.findIndex(c => candidates.some(cand => c === cand || c.includes(cand)));
      if (idx < 0) {
        idx = hrowUpper.findIndex(c => candidates.some(cand => cand.includes(c) && c.length > 2));
      }
      return idx;
    };

    let ai = findColIdx(['ADDRESS', 'LOCATION', 'STREET', 'BUSINESS ADDRESS', 'DESTINATION', 'STOP ADDRESS', 'CUSTOMER ADDRESS']);
    let si = findColIdx(['SEQUENCE', 'SEQ', 'SEQ #', 'SEQUENCE NUMBER', 'SEQ RANGE', 'STOP #', 'STOP', 'POSSIBLE BUSINESS', 'POSSIBLE BUSINESSES', 'POSSIBLE BIZ', 'BIZ SEQ', 'BUSINESS SEQ', 'PACKAGE SEQ', 'SEQUENCE #', 'SEQS', 'POSSIBLE']);
    let ri = findColIdx(['ROUTE', 'RT', 'ROUTE #', 'RT #', 'DISPATCH ROUTE', 'DRAGONFLY ROUTE']);
    let ci = findColIdx(['CLOSING TIME', 'CLOSING', 'CLOSE TIME', 'CLOSE', 'HOURS', 'BUSINESS HOURS', 'OPEN/CLOSE', 'CUTOFF', 'SCHEDULE', 'TIME']);
    let ii = findColIdx(['SPECIAL INSTRUCTIONS', 'SPECIAL INSTRUCTION', 'INSTRUCTIONS', 'INSTRUCTION', 'DELIVERY INSTRUCTIONS', 'DRIVER NOTE', 'NOTES', 'NOTE', 'COMMENTS', 'COMMENT', 'DETAILS', 'SPECIAL', 'REMARKS', 'INFO']);

    const addressColName = ai >= 0 ? hrow[ai] : 'Manifest PDF Lookup';
    const seqColName = si >= 0 ? hrow[si] : 'None';
    const routeColName = ri >= 0 ? hrow[ri] : 'None';
    const closingColName = ci >= 0 ? hrow[ci] : 'None';
    const instrColName = ii >= 0 ? hrow[ii] : 'None';

    log(`Mapped Business Directory Columns — Sequence: '${seqColName}', Address: '${addressColName}', Route: '${routeColName}', Closing Time: '${closingColName}', Special Instructions: '${instrColName}'`, "success");

    const bizRows = bizRaw.slice(hi + 1)
      .map((r: any) => {
        if (!r || !Array.isArray(r)) return null;
        const address = ai >= 0 ? String(r[ai] || '').trim() : '';
        const seq = si >= 0 ? String(r[si] || '').trim() : '';
        const route = ri >= 0 ? String(r[ri] || '').trim() : '';
        let closing = ci >= 0 ? String(r[ci] || '').trim() : '';
        let instr = ii >= 0 ? String(r[ii] || '').trim() : '';

        // Clean up decimal time strings from Excel if needed
        if (closing && /^\d+(\.\d+)?$/.test(closing)) {
          const num = parseFloat(closing);
          if (num > 0 && num < 1) {
            const totalMin = Math.round(num * 24 * 60);
            const hrs = Math.floor(totalMin / 60);
            const mins = totalMin % 60;
            closing = `${hrs}:${mins < 10 ? '0' : ''}${mins}`;
          }
        }

        return { address, seq, route, closing, instr };
      })
      .filter((r: any) => r && (r.address.length > 3 || r.seq.length > 0));

    log(`Loaded ${bizRows.length} active business directory / possible sequence rules.`, "success");
    onProgress(10);

    // 3. Scan & Parse Manifest PDF (using high-fidelity column parsing)
    if (shouldStop.current) throw new Error("Process stopped by user.");
    log("Parsing Manifest PDF (high-fidelity extraction)...", "info");
    const pdfBytes = new Uint8Array(await pdfFile.arrayBuffer());

    const { records, routePages, declared, numPages } = await parseManifest(pdfBytes, (p, n) => {
      onProgress(10 + Math.floor((p / n) * 30)); // 10% to 40%
    });

    log(`Manifest scanned successfully. Parsed ${records.length} packages across ${Object.keys(routePages).length} routes (${numPages} pages).`, "success");

    // Perform validation check
    const parsedCounts: { [key: string]: number } = {};
    records.forEach(r => {
      parsedCounts[r.route] = (parsedCounts[r.route] || 0) + 1;
    });
    let mismatchCount = 0;
    for (const rt of Object.keys(parsedCounts).sort()) {
      if (declared[rt] !== undefined && declared[rt] !== parsedCounts[rt]) {
        mismatchCount++;
        log(`Route ${rt}: parsed ${parsedCounts[rt]} packages vs declared total ${declared[rt]}`, "warning");
      }
    }
    if (mismatchCount === 0) {
      log("All route package counts match the manifest's declared totals perfectly.", "success");
    } else {
      log(`${mismatchCount} route(s) package counts differ from declared totals.`, "warning");
    }

    // 4. Address Cross-matching
    if (shouldStop.current) throw new Error("Process stopped by user.");
    log("Cross-matching packages against Business Address Directory...", "info");
    const matches = crossMatch(records, bizRows);
    matches.sort((a, b) => {
      if (a.route === b.route) {
        return (parseInt(a.seq) || 9999) - (parseInt(b.seq) || 9999);
      }
      return a.route.localeCompare(b.route);
    });

    log(`Matched ${matches.length} business stops on today's routes.`, "success");
    onProgress(45);

    // Group business packages by route & IDC
    const byRoute: { [key: string]: any[] } = {};
    matches.forEach(m => {
      const idc = routeToIdc.get(m.route) || "Unassigned";
      m.idc = idc;
      (byRoute[m.route] = byRoute[m.route] || []).push(m);
    });

    // 5. Optionally load QR PDF
    let qrRoutePages = new Map<string, number[]>();
    let qrPdfDoc: PDFDocument | null = null;
    if (qrFile) {
      log("Reading QR PDF...", "info");
      const qrBytes = await qrFile.arrayBuffer();
      const qrDoc = await pdfjsLib.getDocument({ data: qrBytes.slice() }).promise;
      
      for (let i = 1; i <= qrDoc.numPages; i++) {
        const page = await qrDoc.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ');
        const match = text.match(/(KTCH\s*\d+)/i) || text.match(/([A-Z0-9_-]{3,10}\s*\d+)/i);
        if (match) {
          const rawRoute = match[1];
          const normalizedRoute = rawRoute.replace(/\s+/g, '').toUpperCase();
          if (!qrRoutePages.has(normalizedRoute)) {
            qrRoutePages.set(normalizedRoute, []);
          }
          qrRoutePages.get(normalizedRoute)!.push(i - 1);
        }
      }
      qrPdfDoc = await PDFDocument.load(qrBytes);
      log(`Successfully mapped QR codes for ${qrRoutePages.size} routes.`, "success");
    }

    // 6. Split Manifest PDF & Create IDC Packages
    if (shouldStop.current) throw new Error("Process stopped by user.");
    log("Splitting PDF manifest pages, embedding QR codes, and building IDC ZIP bundles...", "info");

    const sourcePdfDoc = await PDFDocument.load(pdfBytes);
    const idcGroups = new Map<string, string[]>();
    orderedRoutes.forEach(route => {
      const idc = routeToIdc.get(route) || "Unassigned";
      if (!idcGroups.has(idc)) {
        idcGroups.set(idc, []);
      }
      idcGroups.get(idc)!.push(route);
    });

    const summaryRows: any[] = [];
    const idcBundles: IdcBundle[] = [];
    let processedCount = 0;
    const totalRoutes = orderedRoutes.length;

    for (const [idc, routes] of idcGroups) {
      if (shouldStop.current) throw new Error("Process stopped by user.");
      const idcZip = new JSZip();
      let filesAddedToZip = 0;

      // Filter matches specifically for this IDC
      const idcStops = routes.flatMap(rt => byRoute[rt] || []);

      // Build WhatsApp portrait PDF
      const whatsappDoc = await buildWhatsAppDoc(idc, byRoute, routes, currentDateStr);
      const whatsappBytes = await whatsappDoc.save();
      const idcSafeName = idc.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
      idcZip.file(`${idcSafeName}_WhatsApp_${currentDateStr}.pdf`, whatsappBytes);

      // Build Landscape Business Stops summary PDF
      const landscapeDoc = await buildSummaryDoc(idc, idcStops, currentDateStr);
      const landscapeBytes = await landscapeDoc.save();
      idcZip.file(`${idcSafeName}_Business_Stops_Landscape_${currentDateStr}.pdf`, landscapeBytes);

      for (const route of routes) {
        if (shouldStop.current) throw new Error("Process stopped by user.");

        const manifestPages = routePages[route];
        const qrPages = qrRoutePages.get(route);
        processedCount++;

        // Update progress (45% to 95%)
        onProgress(45 + Math.floor((processedCount / totalRoutes) * 50));

        if (manifestPages && manifestPages.length > 0) {
          try {
            const newPdf = await PDFDocument.create();

            // Add QR Code Page first if available
            if (qrPdfDoc && qrPages && qrPages.length > 0) {
              const copiedQrPages = await newPdf.copyPages(qrPdfDoc, qrPages);
              copiedQrPages.forEach(p => newPdf.addPage(p));
            }

            // Add Route Manifest Pages
            const copiedManifestPages = await newPdf.copyPages(sourcePdfDoc, manifestPages);
            copiedManifestPages.forEach(p => newPdf.addPage(p));

            const routePdfBytes = await newPdf.save();
            const filename = `${route}_${currentDateStr}.pdf`;

            idcZip.file(filename, routePdfBytes);
            filesAddedToZip++;

            summaryRows.push({
              Route: route,
              IDC: idc,
              "Pages Found": manifestPages.length,
              "QR Attached": (qrPages && qrPages.length > 0) ? "Yes" : "No",
              "Business Stops": (byRoute[route] || []).length,
              Status: "Included"
            });
          } catch (e: any) {
            log(`Error generating PDF for route ${route}: ${e.message}`, "error");
            summaryRows.push({
              Route: route,
              IDC: idc,
              "Pages Found": 0,
              "Business Stops": 0,
              Status: `Error: ${e.message}`
            });
          }
        } else {
          summaryRows.push({
            Route: route,
            IDC: idc,
            "Pages Found": 0,
            "Business Stops": 0,
            Status: "Missing in PDF"
          });
        }
      }

      if (filesAddedToZip > 0) {
        const zipBlob = await idcZip.generateAsync({ type: "blob" });
        idcBundles.push({
          name: idc,
          filename: `${idcSafeName}_${currentDateStr}.zip`,
          blob: zipBlob,
          routeCount: filesAddedToZip
        });
        log(`Packaged IDC: ${idc} with ${filesAddedToZip} routes and business stops packet.`, "success");
      }
    }

    // 7. Generate Master Consolidated Summary Report Excel
    const summaryBlob = generateSummaryExcel(summaryRows, matches);

    onProgress(100);

    return {
      idcBundles,
      summaryBlob,
      summaryName: `IDC_Summary_Report_${currentDateStr}.xlsx`,
      businessPackages: matches,
      routeTextData: [],
      summaryRows
    };

  } catch (error: any) {
    if (error.message === "Process stopped by user.") {
      throw error;
    }
    log(`Process failed: ${error.message}`, "error");
    throw error;
  }
};
