import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import {
  BigBoxManifestPackage,
  BigBoxScannedItem,
  BigBoxSheet1Row,
  BigBoxSheet2Row,
  BigBoxSheet3Row
} from '../types';

// ---------------------------------------------------------------------------
// Sorting helpers
// ---------------------------------------------------------------------------

export function naturalSort(a: string, b: string): number {
  const numA = Number(a);
  const numB = Number(b);
  if (!isNaN(numA) && !isNaN(numB)) {
    return numA - numB;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortIndices(indices: (string | number)[]): string[] {
  return Array.from(new Set(indices.map(i => String(i).trim())))
    .sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return naturalSort(a, b);
    });
}

// ---------------------------------------------------------------------------
// Column header detection (for tabular manifest parsing)
// ---------------------------------------------------------------------------

function isRouteHeader(str: string): boolean {
  const s = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [
    'route', 'routeno', 'routenumber', 'rt', 'rtno', 'rtnumber',
    'driverroute', 'assignedroute', 'vanroute', 'humanresource',
    'dsproute', 'targetroute'
  ].includes(s);
}

function isIndexHeader(str: string): boolean {
  const s = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [
    'index', 'manifestindex', 'idx', 'stop', 'stopno', 'stopnumber',
    'seq', 'seqno', 'sequence', 'packageno', 'packageindex',
    'itemindex', 'itemno', 'sortindex', 'routeindex'
  ].includes(s);
}

function isTrackingHeader(str: string): boolean {
  const s = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [
    'tracking', 'trackingid', 'trackingnumber', 'trackingno', 'trackingnum',
    'trackingcode', 'barcode', 'packageid', 'pkgid', 'itemid', 'awb',
    'label', 'pkglabel', 'scancode', 'pieceid', 'parcelid', 'orderid',
    'waybill', 'trkid', 'tbanumber', 'tba', 'sid', 'id', 'shipmentid',
    'ref', 'referencenumber', 'referenceno'
  ].includes(s);
}

// ---------------------------------------------------------------------------
// Manifest parsing (.xlsx / .xls / .csv, tabular or "Route: X" sectional)
// ---------------------------------------------------------------------------

export async function parseManifestFromFile(file: File): Promise<BigBoxManifestPackage[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const packages: BigBoxManifestPackage[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    let routeCol = -1;
    let indexCol = -1;
    let trackCol = -1;
    let headerRow = -1;

    for (let r = 0; r < Math.min(40, data.length); r++) {
      const row = data[r];
      if (Array.isArray(row)) {
        row.forEach((cellVal, c) => {
          const s = String(cellVal || '').trim();
          if (isRouteHeader(s)) routeCol = c;
          if (isIndexHeader(s)) indexCol = c;
          if (isTrackingHeader(s)) trackCol = c;
        });
        if (routeCol !== -1 && indexCol !== -1) {
          headerRow = r;
          break;
        }
      }
    }

    if (headerRow !== -1 && routeCol !== -1 && indexCol !== -1) {
      // Tabular layout: Route / Index / Tracking ID columns
      for (let r = headerRow + 1; r < data.length; r++) {
        const row = data[r];
        if (!Array.isArray(row)) continue;
        const routeVal = String(row[routeCol] || '').trim();
        const indexVal = String(row[indexCol] || '').trim();
        const trackVal = trackCol !== -1 ? String(row[trackCol] || '').trim() : '';

        if (routeVal && indexVal && routeVal.toLowerCase() !== 'route' && routeVal !== '0000') {
          packages.push({
            route: routeVal,
            manifestIndex: indexVal,
            trackingId: trackVal || `TRK-${routeVal}-${indexVal}-${r}`
          });
        }
      }
      continue;
    }

    // Fallback 1: object-row shape (sheet_to_json with header inference)
    const objRows: any[] = XLSX.utils.sheet_to_json(sheet);
    if (objRows.length > 0) {
      const first = objRows[0];
      const keys = Object.keys(first);
      const rKey = keys.find(k => isRouteHeader(k));
      const iKey = keys.find(k => isIndexHeader(k));
      const tKey = keys.find(k => isTrackingHeader(k));

      if (rKey && iKey) {
        objRows.forEach((row, rIdx) => {
          const rVal = String(row[rKey] || '').trim();
          const iVal = String(row[iKey] || '').trim();
          const tVal = tKey ? String(row[tKey] || '').trim() : '';
          if (rVal && iVal && rVal.toLowerCase() !== 'route' && rVal !== '0000') {
            packages.push({
              route: rVal,
              manifestIndex: iVal,
              trackingId: tVal || `TRK-${rVal}-${iVal}-${rIdx}`
            });
          }
        });
        continue;
      }
    }

    // Fallback 2: sectional scan, e.g. a "Route: 1755" heading followed by
    // rows whose first number is the stop index.
    let currentRoute = '';
    data.forEach(row => {
      if (!Array.isArray(row)) return;
      const rowText = row.map(c => String(c || '').trim()).filter(Boolean).join(' ');
      const routeMatch = rowText.match(/route\s*[:#-]?\s*([A-Za-z0-9_-]+)/i);
      if (routeMatch && routeMatch[1]) {
        currentRoute = routeMatch[1].trim();
        return;
      }
      if (currentRoute) {
        const numbers = rowText.match(/\b\d+\b/g);
        if (numbers && numbers.length > 0) {
          const idxCandidate = numbers[0];
          packages.push({
            route: currentRoute,
            manifestIndex: idxCandidate,
            trackingId: `TRK-${currentRoute}-${idxCandidate}`
          });
        }
      }
    });
  }

  return packages;
}

// ---------------------------------------------------------------------------
// Column-sorted tracking ID sheet parsing
// Column A = physical staging column 1, Column B = column 2, etc. Each cell
// is one tracking ID (or route number) scanned into that physical column.
// ---------------------------------------------------------------------------

export interface ColumnSheetParseResult {
  scannedItems: Omit<BigBoxScannedItem, 'id' | 'position'>[];
  underscoreAlerts: { trackingId: string; column: number; row: number }[];
  unmatchedCount: number;
  totalItems: number;
  columnsCount: number;
}

export async function parseColumnWiseTrackingSheet(
  file: File,
  manifestPackages: BigBoxManifestPackage[]
): Promise<ColumnSheetParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const trackingLookup = new Map<string, BigBoxManifestPackage>();
  const routePackages = new Map<string, BigBoxManifestPackage[]>();
  manifestPackages.forEach(p => {
    const trk = String(p.trackingId || '').trim();
    if (trk) {
      trackingLookup.set(trk.toLowerCase(), p);
      const clean = trk.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (clean) trackingLookup.set(clean, p);
    }
    const r = String(p.route || '').trim();
    if (r) {
      if (!routePackages.has(r.toLowerCase())) routePackages.set(r.toLowerCase(), []);
      routePackages.get(r.toLowerCase())!.push(p);
    }
  });

  const scannedItems: Omit<BigBoxScannedItem, 'id' | 'position'>[] = [];
  const underscoreAlerts: { trackingId: string; column: number; row: number }[] = [];
  let unmatchedCount = 0;
  let totalItems = 0;

  if (data.length === 0) {
    return { scannedItems: [], underscoreAlerts: [], unmatchedCount: 0, totalItems: 0, columnsCount: 0 };
  }

  let maxCols = 0;
  data.forEach(row => {
    if (Array.isArray(row)) maxCols = Math.max(maxCols, row.length);
  });

  const columnsData: { colIndex: number; items: { text: string; row: number }[] }[] = [];
  for (let c = 0; c < maxCols; c++) {
    const colItems: { text: string; row: number }[] = [];
    for (let r = 0; r < data.length; r++) {
      const cellVal = String(data[r]?.[c] || '').trim();
      if (!cellVal) continue;
      if (r === 0) {
        const lower = cellVal.toLowerCase();
        if (
          lower === 'col' || lower === 'column' ||
          lower.startsWith('col ') || lower.startsWith('column ') ||
          lower.startsWith('staging ') ||
          lower === `col ${c + 1}` || lower === `col${c + 1}` ||
          lower === `column ${c + 1}` || lower === `${c + 1}`
        ) {
          continue;
        }
      }
      colItems.push({ text: cellVal, row: r + 1 });
    }
    if (colItems.length > 0) columnsData.push({ colIndex: c + 1, items: colItems });
  }

  columnsData.forEach((colGroup, groupIdx) => {
    const physicalCol = groupIdx + 1;

    colGroup.items.forEach(({ text, row }) => {
      totalItems++;
      const rawLower = text.toLowerCase();
      const rawClean = text.replace(/[^a-z0-9]/gi, '').toLowerCase();

      if (text.includes('_')) {
        underscoreAlerts.push({ trackingId: text, column: physicalCol, row });
      }

      let matchedPkg = trackingLookup.get(rawLower) || (rawClean ? trackingLookup.get(rawClean) : undefined);

      if (!matchedPkg) {
        matchedPkg = manifestPackages.find((p) => {
          const pTrk = String(p.trackingId || '').trim().toLowerCase();
          if (!pTrk) return false;
          const pTrkClean = pTrk.replace(/[^a-z0-9]/gi, '');
          return (
            (pTrk.length >= 6 && rawLower.endsWith(pTrk)) ||
            (pTrk.length >= 6 && rawLower.startsWith(pTrk)) ||
            (rawClean.length >= 6 && pTrkClean.endsWith(rawClean)) ||
            (rawClean.length >= 6 && rawClean.endsWith(pTrkClean))
          );
        });
      }

      if (matchedPkg) {
        scannedItems.push({
          route: String(matchedPkg.route).trim(),
          boxId: `BB-${matchedPkg.route}`,
          trackingId: matchedPkg.trackingId || text,
          manifestIndex: String(matchedPkg.manifestIndex || '').trim()
        });
      } else {
        const routeList = routePackages.get(rawLower);
        if (routeList && routeList.length > 0) {
          const pkg = routeList[0];
          scannedItems.push({
            route: String(pkg.route).trim(),
            boxId: `BB-${pkg.route}`,
            trackingId: pkg.trackingId || '',
            manifestIndex: String(pkg.manifestIndex || '').trim()
          });
        } else {
          unmatchedCount++;
          const parsedRoute = text.replace(/^(route|rt|bb|box)[\s:#_-]*/i, '').trim();
          scannedItems.push({
            route: parsedRoute || text,
            boxId: `BB-${parsedRoute || text}`,
            trackingId: text,
            manifestIndex: ''
          });
        }
      }
    });

    if (groupIdx < columnsData.length - 1) {
      scannedItems.push({ route: 'NEXT COLUMN', boxId: 'COLUMN_BREAK', trackingId: '', manifestIndex: '' });
    }
  });

  return { scannedItems, underscoreAlerts, unmatchedCount, totalItems, columnsCount: columnsData.length };
}

// ---------------------------------------------------------------------------
// Scan resolution — one physical scan (tracking ID barcode or a typed route
// number) resolved against the manifest and the boxes already scanned today.
// ---------------------------------------------------------------------------

export interface ScanResolution {
  route: string;
  boxId: string;
  trackingId?: string;
  manifestIndex?: string;
  detectedFromTracking: boolean;
  hasUnderscore: boolean;
}

export function resolveScan(
  rawInput: string,
  manifestPackages: BigBoxManifestPackage[],
  existingItems: BigBoxScannedItem[]
): ScanResolution {
  const raw = rawInput.trim();
  const hasUnderscore = raw.includes('_');
  if (!raw) return { route: '', boxId: '', detectedFromTracking: false, hasUnderscore };

  const rawLower = raw.toLowerCase();
  const rawClean = raw.replace(/[^a-z0-9]/gi, '').toLowerCase();

  // 1. Direct / fuzzy match against manifest tracking IDs
  const matchedByTracking = manifestPackages.find(p => {
    const trk = String(p.trackingId || '').trim().toLowerCase();
    if (!trk) return false;
    const trkClean = trk.replace(/[^a-z0-9]/gi, '');
    return (
      trk === rawLower ||
      trkClean === rawClean ||
      (rawClean.length >= 6 && trkClean.length >= 6 && rawClean.endsWith(trkClean)) ||
      (rawClean.length >= 6 && trkClean.length >= 6 && rawClean.startsWith(trkClean)) ||
      (trkClean.length >= 6 && rawClean.length >= 6 && trkClean.endsWith(rawClean)) ||
      (trkClean.length >= 6 && rawClean.length >= 6 && trkClean.startsWith(rawClean))
    );
  });

  if (matchedByTracking) {
    return {
      route: String(matchedByTracking.route).trim(),
      boxId: `BB-${matchedByTracking.route}`,
      trackingId: matchedByTracking.trackingId || raw,
      manifestIndex: String(matchedByTracking.manifestIndex || ''),
      detectedFromTracking: true,
      hasUnderscore
    };
  }

  // 2. Typed as a bare route number — assign the next manifest package for
  // that route which hasn't been scanned yet today.
  const routePackages = manifestPackages.filter(p => String(p.route).trim().toLowerCase() === rawLower);
  if (routePackages.length > 0) {
    const existingTrackings = new Set(
      existingItems.map(b => String(b.trackingId || '').trim().toLowerCase()).filter(Boolean)
    );
    const unassigned = routePackages.find(p => !existingTrackings.has(String(p.trackingId || '').trim().toLowerCase()));
    const pkg = unassigned || routePackages[0];
    return {
      route: String(pkg.route).trim(),
      boxId: `BB-${pkg.route}`,
      trackingId: pkg.trackingId || raw,
      manifestIndex: String(pkg.manifestIndex || ''),
      detectedFromTracking: false,
      hasUnderscore
    };
  }

  // 3. Route with a stripped prefix ("Route:", "RT-", "BB-", "#")
  let parsed = raw.replace(/^(route|rt|bb|box|driver|dsp)[\s:#_-]*/i, '').trim();
  parsed = parsed.replace(/^#+/, '').trim();
  const finalRoute = parsed || raw;

  return {
    route: finalRoute,
    boxId: `BB-${finalRoute}`,
    trackingId: raw,
    detectedFromTracking: false,
    hasUnderscore
  };
}

// ---------------------------------------------------------------------------
// Derived sheet data (shared by the live preview and the exported workbook)
// ---------------------------------------------------------------------------

export interface DerivedBigBoxData {
  itemsWithCol: (BigBoxScannedItem & { isBreak: boolean; physicalCol: number })[];
  validItems: (BigBoxScannedItem & { physicalCol: number })[];
  scannedByRoute: Record<string, (BigBoxScannedItem & { physicalCol: number })[]>;
  activeRoutes: string[];
  sheet1Rows: BigBoxSheet1Row[];
  sheet2Rows: BigBoxSheet2Row[];
  sheet3Rows: BigBoxSheet3Row[];
  underscoreItems: BigBoxScannedItem[];
  columnsUsed: number;
}

export function deriveBigBoxData(
  scannedItems: BigBoxScannedItem[],
  manifestPackages: BigBoxManifestPackage[],
  currentDate: string
): DerivedBigBoxData {
  const manifestTrackingMap = new Map<string, BigBoxManifestPackage>();
  manifestPackages.forEach(p => {
    const trk = String(p.trackingId || '').trim();
    if (trk) {
      manifestTrackingMap.set(trk.toLowerCase(), p);
      const clean = trk.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (clean) manifestTrackingMap.set(clean, p);
    }
  });

  let currentPhysicalCol = 1;
  const itemsWithCol = scannedItems.map(item => {
    if (item.route === 'NEXT COLUMN' || item.boxId === 'COLUMN_BREAK') {
      const breakCol = currentPhysicalCol;
      currentPhysicalCol++;
      return { ...item, isBreak: true, physicalCol: breakCol };
    }
    return { ...item, isBreak: false, physicalCol: currentPhysicalCol };
  });

  const validItems = itemsWithCol.filter(b => !b.isBreak && b.route && b.route !== '0000');
  const columnBreaksCount = scannedItems.filter(b => b.route === 'NEXT COLUMN' || b.boxId === 'COLUMN_BREAK').length;
  const columnsUsed = validItems.length > 0 ? columnBreaksCount + 1 : 0;

  const underscoreItems = validItems.filter(b =>
    String(b.trackingId || '').includes('_') || String(b.route || '').includes('_')
  );

  const sheet1Rows: BigBoxSheet1Row[] = validItems.map((box) => {
    const rawTrk = String(box.trackingId || '').trim();
    const rawLower = rawTrk.toLowerCase();
    const rawClean = rawLower.replace(/[^a-z0-9]/gi, '');
    const matchedPkg = manifestTrackingMap.get(rawLower) || (rawClean ? manifestTrackingMap.get(rawClean) : undefined);
    const isMatched = !!matchedPkg;
    const hasUnderscore = rawTrk.includes('_') || String(box.route || '').includes('_');
    const manifestIndex = matchedPkg?.manifestIndex || box.manifestIndex || '-';

    return {
      date: currentDate,
      position: box.position,
      physicalCol: box.physicalCol,
      boxId: box.boxId || `BB-${box.route}`,
      route: String(box.route).trim(),
      tracking_id: isMatched ? (matchedPkg?.trackingId || rawTrk) : '',
      raw_tracking_id: rawTrk,
      isMatched,
      hasUnderscore,
      manifest_index: isMatched ? manifestIndex : '-'
    };
  });

  const scannedByRoute: Record<string, (BigBoxScannedItem & { physicalCol: number })[]> = {};
  validItems.forEach(item => {
    const r = String(item.route).trim();
    if (!r || r === '0000' || r === 'NEXT COLUMN') return;
    if (!scannedByRoute[r]) scannedByRoute[r] = [];
    scannedByRoute[r].push(item);
  });

  const activeRoutes = Object.keys(scannedByRoute).sort(naturalSort);

  const sheet3Rows: BigBoxSheet3Row[] = activeRoutes.map(route => {
    const items = scannedByRoute[route] || [];
    const rawIndices = items.map(i => i.manifestIndex).filter((idx): idx is string => !!idx && idx !== '-');
    return { route, count: items.length, indices: sortIndices(rawIndices).join(', ') };
  });

  const sheet2Rows: BigBoxSheet2Row[] = activeRoutes.map(route => {
    const items = scannedByRoute[route] || [];
    const colCounts: Record<number, number> = {};
    items.forEach(i => {
      const colNum = i.physicalCol || 1;
      if (colNum >= 1 && colNum <= 30) colCounts[colNum] = (colCounts[colNum] || 0) + 1;
    });
    return { route, routeTotal: items.length, totalArea: items.length, colCounts };
  });

  return {
    itemsWithCol,
    validItems,
    scannedByRoute,
    activeRoutes,
    sheet1Rows,
    sheet2Rows,
    sheet3Rows,
    underscoreItems,
    columnsUsed
  };
}

// ---------------------------------------------------------------------------
// Styled 3-sheet Excel workbook export (INPUT / BIG BOX LIST / MAPPED INDICES)
// ---------------------------------------------------------------------------

export async function createMasterWorkbook(
  derived: DerivedBigBoxData,
  currentDate: string
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dragonfly Operational Tools Hub';
  workbook.lastModifiedBy = 'Dragonfly Operational Tools Hub';
  workbook.created = new Date();
  workbook.modified = new Date();

  const { validItems, sheet2Rows, sheet3Rows } = derived;

  // Sheet 1: INPUT
  const sheet1 = workbook.addWorksheet('INPUT', { views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }] });
  const headerRow1 = sheet1.addRow(['Date', 'Position', 'Big Box ID', 'Route', 'Tracking ID', 'Index', 'Status']);
  headerRow1.height = 24;
  headerRow1.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF0F172A' }, name: 'Calibri', size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
  });
  sheet1.columns = [
    { key: 'date', width: 14 },
    { key: 'position', width: 12 },
    { key: 'boxId', width: 22 },
    { key: 'route', width: 14 },
    { key: 'trackingId', width: 28 },
    { key: 'index', width: 12 },
    { key: 'status', width: 14 }
  ];

  let rowIdx = 0;
  validItems.forEach((box) => {
    rowIdx++;
    const rawTracking = String(box.trackingId || '').trim();
    const rawLower = rawTracking.toLowerCase();
    const rawClean = rawLower.replace(/[^a-z0-9]/gi, '');
    const isMatched = derived.sheet1Rows.find(r => r.position === box.position)?.isMatched ?? false;
    const trackingIdForExcel = isMatched ? rawTracking : '';
    const manifestIndex = isMatched ? (box.manifestIndex || '-') : '-';

    const row = sheet1.addRow([
      currentDate,
      box.position,
      box.boxId || `BB-${box.route}`,
      String(box.route).trim(),
      trackingIdForExcel,
      manifestIndex,
      isMatched ? 'Assigned' : 'Unmatched'
    ]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.alignment = { vertical: 'middle', horizontal: colNum === 5 ? 'left' : 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFF1F5F9' } },
        bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } },
        left: { style: 'thin', color: { argb: 'FFF1F5F9' } },
        right: { style: 'thin', color: { argb: 'FFF1F5F9' } }
      };
      if (rowIdx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  // Sheet 2: BIG BOX LIST
  const sheet2 = workbook.addWorksheet('BIG BOX LIST', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1, activeCell: 'B2' }] });
  const header2 = ['R#', 'ROUTE TOTAL', 'TOTAL AREA', ...Array.from({ length: 30 }, (_, i) => String(i + 1))];
  const headerRow2 = sheet2.addRow(header2);
  headerRow2.height = 26;
  headerRow2.eachCell((cell, colNum) => {
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF64748B' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } }
    };
    if (colNum === 1) {
      cell.font = { bold: true, color: { argb: 'FF0F172A' }, name: 'Calibri', size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    } else if (colNum === 2) {
      cell.font = { bold: true, color: { argb: 'FF14532D' }, name: 'Calibri', size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } };
    } else if (colNum === 3) {
      cell.font = { bold: true, color: { argb: 'FF000000' }, name: 'Calibri', size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    } else {
      cell.font = { bold: true, color: { argb: 'FF0F172A' }, name: 'Calibri', size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    }
  });
  sheet2.columns = [
    { key: 'route', width: 10 },
    { key: 'routeTotal', width: 14 },
    { key: 'totalArea', width: 14 },
    ...Array.from({ length: 30 }, (_, i) => ({ key: `col_${i + 1}`, width: 5.5 }))
  ];

  sheet2Rows.forEach((row, rowIndex) => {
    const rowValues = [
      row.route,
      row.routeTotal,
      row.totalArea,
      ...Array.from({ length: 30 }, (_, i) => row.colCounts[i + 1] ?? '')
    ];
    const excelRow = sheet2.addRow(rowValues);
    excelRow.height = 21;
    const isLightGrey = rowIndex % 2 === 1;
    const defaultBgArgb = isLightGrey ? 'FFF8FAFC' : 'FFFFFFFF';

    excelRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (colNum === 1) {
        cell.font = { bold: true, color: { argb: 'FF0F172A' }, name: 'Calibri', size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBgArgb } };
      } else if (colNum === 2) {
        cell.font = { bold: true, color: { argb: 'FF14532D' }, name: 'Calibri', size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
      } else if (colNum === 3) {
        cell.font = { bold: true, color: { argb: 'FF000000' }, name: 'Calibri', size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      } else {
        const cellValue = cell.value;
        if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
          cell.font = { bold: true, color: { argb: 'FF7C2D12' }, name: 'Calibri', size: 11 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } };
        } else {
          cell.font = { bold: false, color: { argb: 'FF64748B' }, name: 'Calibri', size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBgArgb } };
        }
      }
    });
  });

  // Sheet 3: MAPPED INDICES
  const sheet3 = workbook.addWorksheet('MAPPED INDICES', { views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }] });
  const headerRow3 = sheet3.addRow(['Route Number', 'Count', 'Index']);
  headerRow3.height = 24;
  headerRow3.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF0F172A' }, name: 'Calibri', size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });
  sheet3.columns = [
    { key: 'routeNumber', width: 18 },
    { key: 'count', width: 12 },
    { key: 'index', width: 45 }
  ];

  sheet3Rows.forEach((row, rowIndex) => {
    const excelRow = sheet3.addRow([row.route, row.count, row.indices]);
    excelRow.height = 20;
    const isLightGrey = rowIndex % 2 === 1;
    const bgArgb = isLightGrey ? 'FFF8FAFC' : 'FFFFFFFF';
    excelRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      if (colNum === 1) {
        cell.font = { bold: true, color: { argb: 'FF0F172A' }, name: 'Calibri', size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum === 2) {
        cell.font = { bold: true, color: { argb: 'FF334155' }, name: 'Calibri', size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.font = { bold: false, color: { argb: 'FF1E293B' }, name: 'Calibri', size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  return workbook;
}

export async function workbookToBlob(workbook: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
