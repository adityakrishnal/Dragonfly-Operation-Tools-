import React, { useEffect, useMemo, useState } from 'react';
import { StationCode, OperatorProfile, DESIGNATION_OPTIONS, BigBoxManifestPackage, BigBoxScannedItem, BigBoxSessionState } from '../types';
import { BigBoxScanner } from './BigBoxScanner';
import FileUploader from './FileUploader';
import {
  deriveBigBoxData,
  parseManifestFromFile,
  parseColumnWiseTrackingSheet,
  createMasterWorkbook,
  workbookToBlob,
  ScanResolution
} from '../services/bigBoxMappingService';
import { saveAs } from 'file-saver';
import {
  Package,
  Download,
  Search,
  AlertTriangle,
  Clock,
  User,
  Calendar,
  FileSpreadsheet,
  ChevronRight,
  Table,
  X,
  RefreshCcw,
  CheckCircle2,
  Sparkles,
  UploadCloud
} from 'lucide-react';

interface BigBoxMapCreatorProps {
  currentStation: StationCode;
  onSelectStation: (station: StationCode) => void;
  operatorProfile: OperatorProfile;
  onUpdateOperator: (profile: OperatorProfile) => void;
  currentDate: string;
  onSelectDate: (date: string) => void;
  onBackToHub: () => void;
  logActivity?: (action: string, details?: string) => void;
}

const storageKey = (station: StationCode, date: string) => `dragonfly_bigbox_${station}_${date}`;

function loadSession(station: StationCode, date: string): BigBoxSessionState {
  try {
    const raw = localStorage.getItem(storageKey(station, date));
    if (raw) {
      const parsed = JSON.parse(raw) as BigBoxSessionState;
      return {
        date,
        station,
        scannedItems: parsed.scannedItems || [],
        manifestPackages: parsed.manifestPackages || []
      };
    }
  } catch {
    // fall through to a fresh session
  }
  return { date, station, scannedItems: [], manifestPackages: [] };
}

function saveSession(state: BigBoxSessionState) {
  try {
    localStorage.setItem(storageKey(state.station, state.date), JSON.stringify(state));
  } catch {
    // best-effort — localStorage may be unavailable (private browsing, quota)
  }
}

export const BigBoxMapCreator: React.FC<BigBoxMapCreatorProps> = ({
  currentStation,
  onSelectStation,
  operatorProfile,
  onUpdateOperator,
  currentDate,
  onSelectDate,
  onBackToHub,
  logActivity
}) => {
  const [scannedItems, setScannedItems] = useState<BigBoxScannedItem[]>([]);
  const [manifestPackages, setManifestPackages] = useState<BigBoxManifestPackage[]>([]);
  const [activeSheetTab, setActiveSheetTab] = useState<'sheet3' | 'sheet2' | 'sheet1'>('sheet3');
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRoute, setEditRoute] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Load / persist a session per station + date so a page refresh on the
  // warehouse floor doesn't lose an in-progress scanning batch.
  useEffect(() => {
    const session = loadSession(currentStation, currentDate);
    setScannedItems(session.scannedItems);
    setManifestPackages(session.manifestPackages);
    setConfirmClear(false);
    setMessage('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStation, currentDate]);

  useEffect(() => {
    saveSession({ date: currentDate, station: currentStation, scannedItems, manifestPackages });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannedItems, manifestPackages]);

  const derived = useMemo(
    () => deriveBigBoxData(scannedItems, manifestPackages, currentDate),
    [scannedItems, manifestPackages, currentDate]
  );

  const manifestRouteCount = useMemo(() => {
    const set = new Set(manifestPackages.map(p => String(p.route || '').trim()).filter(r => r && r !== '0000'));
    return set.size;
  }, [manifestPackages]);

  const nextPosition = scannedItems.length + 1;

  const handleScan = (resolution: ScanResolution) => {
    const item: BigBoxScannedItem = {
      id: `box_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      position: nextPosition,
      boxId: resolution.boxId,
      route: resolution.route,
      trackingId: resolution.trackingId,
      manifestIndex: resolution.manifestIndex
    };
    setScannedItems(prev => [...prev, item]);
    logActivity?.('scan', `Route ${resolution.route}${resolution.trackingId ? ` (${resolution.trackingId})` : ''}`);
  };

  const handleNextColumn = () => {
    setScannedItems(prev => [
      ...prev,
      { id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, position: prev.length + 1, boxId: 'COLUMN_BREAK', route: 'NEXT COLUMN' }
    ]);
  };

  const handleDeleteItem = (id: string) => {
    setScannedItems(prev => prev.filter(b => b.id !== id).map((b, idx) => ({ ...b, position: idx + 1 })));
  };

  const startEditing = (id: string, route: string) => {
    setEditingId(id);
    setEditRoute(route);
  };

  const saveEditedRoute = (id: string) => {
    setEditingId(null);
    if (!editRoute.trim()) return;
    setScannedItems(prev => prev.map(b => (b.id === id ? { ...b, route: editRoute.trim() } : b)));
  };

  const handleManifestUpload = async (file: File) => {
    setLoading('manifest');
    setMessage('Processing manifest file...');
    try {
      const packages = await parseManifestFromFile(file);
      setManifestPackages(packages);
      const routes = new Set(packages.map(p => p.route)).size;
      setMessage(
        packages.length > 0
          ? `Manifest processed successfully! Loaded ${packages.length} packages across ${routes} routes.`
          : 'Manifest uploaded, but no package rows found. Check column headers (Route, Index, Tracking ID).'
      );
      logActivity?.('upload', `Manifest: ${file.name} (${packages.length} packages)`);
    } catch (err: any) {
      setMessage(`Error processing manifest: ${err.message || 'Upload failed'}`);
    } finally {
      setLoading(null);
    }
  };

  const handleColumnSheetUpload = async (file: File) => {
    setLoading('columns');
    setMessage('Processing column-sorted tracking IDs...');
    try {
      const result = await parseColumnWiseTrackingSheet(file, manifestPackages);
      const withIds: BigBoxScannedItem[] = result.scannedItems.map((item, idx) => ({
        ...item,
        id: `box_${Date.now()}_${idx}`,
        position: idx + 1
      }));
      setScannedItems(withIds);

      let msg = `Loaded ${result.totalItems} tracking IDs across ${result.columnsCount} staging columns!`;
      if (result.unmatchedCount > 0) msg += ` (${result.unmatchedCount} unmatched with manifest — omitted from Excel tracking ID column)`;
      if (result.underscoreAlerts.length > 0) msg += ` RED ALERT: ${result.underscoreAlerts.length} tracking IDs have invalid underscores!`;
      setMessage(msg);
      logActivity?.('upload', `Column Sheet: ${file.name} (${result.totalItems} items, ${result.columnsCount} columns)`);
    } catch (err: any) {
      setMessage(`Error uploading column sheet: ${err.message || 'Upload failed'}`);
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadExcel = async () => {
    setLoading('excel');
    setMessage('Building master Excel workbook...');
    try {
      const workbook = await createMasterWorkbook(derived, currentDate);
      const blob = await workbookToBlob(workbook);
      const filename = `Dragonfly_${currentStation}_BigBox_Master_${currentDate}.xlsx`;
      saveAs(blob, filename);
      logActivity?.('download', filename);
      setMessage(`Excel workbook downloaded! Mapped ${derived.validItems.length} items across ${derived.activeRoutes.length} routes.`);
    } catch (err: any) {
      setMessage(`Error generating Excel: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(null);
    }
  };

  const handleClearSession = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setConfirmClear(false);
    setScannedItems([]);
    setManifestPackages([]);
    setMessage('Started a new session for this station and date.');
    logActivity?.('reset', `New Big Box session for ${currentStation} ${currentDate}`);
  };

  const filteredSequence = useMemo(() => {
    if (!searchQuery.trim()) return derived.itemsWithCol;
    const q = searchQuery.toLowerCase();
    return derived.itemsWithCol.filter(
      b => b.isBreak || b.route.toLowerCase().includes(q) || (b.trackingId || '').toLowerCase().includes(q)
    );
  }, [derived.itemsWithCol, searchQuery]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6 w-full text-slate-100">
      {/* Top Navigation & Global Station Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-gray-400 hover:text-white transition-colors"
            title="Back to Hub Dashboard"
          >
            <ChevronRight className="rotate-180" size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/5">
            <Package size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Big Box Mapping &amp; Excel Automation
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Physical Column Sequence
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Scan Big Boxes into staging columns, verify against the manifest, and export the 3-sheet master workbook for {currentStation === 'KTCH' ? 'Kitchener' : 'London'}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => onSelectStation('KTCH')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                currentStation === 'KTCH' ? 'bg-dragonfly-turquoise text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              KTCH (Kitchener)
            </button>
            <button
              type="button"
              onClick={() => onSelectStation('LNDN')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                currentStation === 'LNDN' ? 'bg-dragonfly-lightblue text-slate-950 shadow-sm font-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              LNDN (London)
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <Calendar size={14} className="text-dragonfly-turquoise" />
            <input
              type="date"
              value={currentDate}
              onChange={(e) => onSelectDate(e.target.value)}
              className="bg-transparent text-xs text-white font-mono focus:outline-none cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={loading === 'excel'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 text-xs font-bold transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet size={14} />
            {loading === 'excel' ? 'Building...' : 'Download Master Excel'}
          </button>

          <button
            type="button"
            onClick={handleClearSession}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
              confirmClear
                ? 'bg-red-600 text-white border-red-500'
                : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
            }`}
            title="Clear scanned boxes and manifest for this station and date"
          >
            <RefreshCcw size={14} />
            {confirmClear ? 'Confirm New Day' : 'New Day'}
          </button>
        </div>
      </div>

      {/* Operator Details & Stats Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <User size={15} className="text-dragonfly-turquoise" />
            <span className="text-gray-400 font-medium">Logged in Dispatcher:</span>
            <input
              type="text"
              value={operatorProfile.name}
              onChange={(e) => onUpdateOperator({ ...operatorProfile, name: e.target.value })}
              placeholder="Your Full Name"
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-dragonfly-turquoise focus:outline-none w-44 font-semibold"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium">Designation:</span>
            <select
              value={operatorProfile.designation}
              onChange={(e) => onUpdateOperator({ ...operatorProfile, designation: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-dragonfly-turquoise focus:outline-none cursor-pointer"
            >
              {DESIGNATION_OPTIONS.map((des) => (
                <option key={des} value={des}>{des}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 text-gray-400">
          <span>Scanned: <strong className="text-white">{derived.activeRoutes.length} Big Boxes</strong> ({derived.validItems.length} pos)</span>
          <span className="w-1 h-1 rounded-full bg-slate-600"></span>
          <span>Staging Columns: <strong className="text-dragonfly-turquoise">{derived.columnsUsed || 0}</strong></span>
          <span className="w-1 h-1 rounded-full bg-slate-600"></span>
          <span>Manifest Routes: <strong className="text-gray-200">{manifestRouteCount}</strong></span>
        </div>
      </div>

      {message && (
        <div className="bg-dragonfly-turquoise/10 border border-dragonfly-turquoise/30 text-dragonfly-turquoise px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} />
            <span>{message}</span>
          </div>
          <button type="button" onClick={() => setMessage('')} className="text-dragonfly-turquoise/60 hover:text-dragonfly-turquoise shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Scanner */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <BigBoxScanner
            manifestPackages={manifestPackages}
            scannedItems={scannedItems}
            onScan={handleScan}
            onNextColumn={handleNextColumn}
          />
        </div>

        {/* Physical Column Sequence */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Physical Column Sequence (Top to Bottom)</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter sequence..."
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-[11px] text-white placeholder-gray-500 focus:border-dragonfly-turquoise focus:outline-none w-40"
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-dragonfly-turquoise bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                Col {derived.columnsUsed || 1}
              </span>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto items-center pb-1 bg-slate-950/60 p-2 rounded-xl border border-slate-800 min-h-[52px]">
            {filteredSequence.length === 0 ? (
              <span className="text-xs text-gray-500 italic px-2">No items scanned yet. Scan tracking IDs or route numbers to begin.</span>
            ) : (
              filteredSequence.map((b) => {
                if (b.isBreak) {
                  return (
                    <div key={b.id} className="relative group shrink-0 w-9 h-9 bg-dragonfly-turquoise/10 rounded-lg flex items-center justify-center border-2 border-dragonfly-turquoise/40" title="Physical Column Break">
                      <div className="w-1 h-5 bg-dragonfly-turquoise rounded-full"></div>
                      <button
                        onClick={() => handleDeleteItem(b.id)}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  );
                }
                const hasUnderscore = String(b.trackingId || '').includes('_') || String(b.route || '').includes('_');
                return (
                  <div
                    key={b.id}
                    className={`relative group shrink-0 w-28 h-9 rounded-lg flex items-center justify-center font-mono text-xs border ${
                      hasUnderscore
                        ? 'bg-red-500/15 text-red-300 border-red-500/50 ring-2 ring-red-500/30 font-bold'
                        : 'bg-slate-950 text-gray-200 border-slate-800'
                    }`}
                  >
                    {editingId === b.id ? (
                      <input
                        type="text"
                        value={editRoute}
                        onChange={(e) => setEditRoute(e.target.value)}
                        onBlur={() => saveEditedRoute(b.id)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditedRoute(b.id)}
                        className="w-16 px-1 text-center border-b-2 border-dragonfly-turquoise bg-transparent outline-none text-dragonfly-turquoise font-bold"
                        autoFocus
                      />
                    ) : (
                      <span className="cursor-pointer hover:text-dragonfly-turquoise font-bold flex items-center gap-1" onClick={() => startEditing(b.id, b.route)} title="Click to edit route">
                        {hasUnderscore && <AlertTriangle size={11} className="text-red-400 shrink-0" />}
                        {b.route}
                      </span>
                    )}
                    <span className="ml-1 opacity-40 text-[9px]">P{b.position}</span>
                    <button
                      onClick={() => handleDeleteItem(b.id)}
                      className="absolute -top-1.5 -right-1.5 bg-slate-800 text-red-400 rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-red-500/30 hover:bg-red-500 hover:text-white"
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Manifest & Data Ingestion */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Manifest &amp; Data Ingestion</h3>
            <span className="text-[10px] text-gray-500 font-medium">Excel / CSV Parser</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-[9px] text-gray-500 font-bold uppercase mb-0.5">Manifest Items</div>
              <div className="text-lg font-black text-white">{manifestPackages.length}</div>
            </div>
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-[9px] text-gray-500 font-bold uppercase mb-0.5">Manifest Routes</div>
              <div className="text-lg font-black text-white">{manifestRouteCount}</div>
            </div>
            <div className="p-2 bg-dragonfly-turquoise/10 rounded-xl border border-dragonfly-turquoise/30">
              <div className="text-[9px] text-dragonfly-turquoise font-bold uppercase mb-0.5">Staging Cols</div>
              <div className="text-lg font-black text-dragonfly-turquoise">{derived.columnsUsed || 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <FileUploader
              id="bigbox-manifest-upload"
              label="Upload Manifest"
              accept=".xlsx,.xls,.csv"
              file={null}
              onFileSelect={handleManifestUpload}
              icon={<UploadCloud className="text-dragonfly-turquoise" />}
              description="Route + Index + Tracking ID"
              compact
            />
            <FileUploader
              id="bigbox-column-upload"
              label="Upload Column Sheet"
              accept=".xlsx,.xls,.csv"
              file={null}
              onFileSelect={handleColumnSheetUpload}
              icon={<FileSpreadsheet className="text-amber-400" />}
              description="Col A = Col 1, Col B = Col 2..."
              compact
            />
          </div>
          {loading && (
            <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-dragonfly-turquoise animate-pulse"></span>
              Processing...
            </div>
          )}
        </div>

        {/* Validation Summary */}
        <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Validation Summary</h3>
          </div>
          <div className="flex justify-between items-center text-xs p-2 rounded-lg border bg-dragonfly-turquoise/10 text-dragonfly-turquoise border-dragonfly-turquoise/30 font-bold">
            <span>Scanned Big Boxes</span>
            <span className="font-black text-[11px] bg-dragonfly-turquoise text-white px-2 py-0.5 rounded-full">
              {derived.activeRoutes.length} ({derived.validItems.length} pos)
            </span>
          </div>
          <div className="flex justify-between items-center text-xs p-2 bg-slate-950 text-gray-300 rounded-lg border border-slate-800">
            <span className="font-medium">Manifest-Matched Items</span>
            <span className="font-bold text-emerald-400">
              {derived.sheet1Rows.filter(r => r.isMatched).length} / {derived.validItems.length}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs p-2 bg-slate-950 text-gray-300 rounded-lg border border-slate-800">
            <span className="font-medium">Total Manifest Routes</span>
            <span className="font-bold text-white">{manifestRouteCount}</span>
          </div>
          {derived.underscoreItems.length > 0 && (
            <div className="flex justify-between items-center text-xs p-2 bg-red-500/10 text-red-300 rounded-lg border border-red-500/30">
              <span className="font-bold">Underscore Alerts</span>
              <span className="font-black">{derived.underscoreItems.length}</span>
            </div>
          )}
        </div>

        {/* Excel Synchronization */}
        <div className="lg:col-span-4 bg-gradient-to-br from-dragonfly-turquoise/15 to-slate-900 border border-dragonfly-turquoise/20 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-dragonfly-turquoise/20 rounded-lg flex items-center justify-center text-dragonfly-turquoise">
                <FileSpreadsheet size={16} />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-300">Excel Synchronization</h2>
            </div>
            <div className="text-xs font-bold text-gray-200">3-Sheet Master Workbook</div>
            <div className="mt-1 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${derived.validItems.length > 0 ? 'bg-emerald-400' : 'bg-slate-600'}`}></div>
              <span className={`text-[10px] font-bold ${derived.validItems.length > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                {derived.validItems.length > 0 ? 'READY TO EXPORT' : 'AWAITING SCANS'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              Builds INPUT, BIG BOX LIST (30 staging columns), and MAPPED INDICES sheets from what's currently scanned.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={loading === 'excel'}
            className="w-full mt-4 bg-white text-slate-950 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-gray-100 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <Download size={15} />
            {loading === 'excel' ? 'Building...' : 'Download Master Workbook'}
          </button>
        </div>

        {/* Live Sheet Viewer */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col overflow-hidden">
          {derived.underscoreItems.length > 0 && (
            <div className="mb-3 bg-red-600 border border-red-500 text-white p-3 rounded-xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={18} className="text-yellow-300 shrink-0" />
                <div>
                  <div className="text-xs font-black uppercase tracking-wider">
                    RED ALERT: {derived.underscoreItems.length} Invalid Tracking ID(s) with Underscores
                  </div>
                  <div className="text-[11px] font-medium flex flex-wrap gap-1.5 mt-1">
                    {derived.underscoreItems.map((b) => (
                      <span key={b.id} className="inline-flex items-center gap-1 bg-red-950 text-yellow-300 px-2 py-0.5 rounded font-mono font-bold text-[10px] border border-red-400">
                        {b.trackingId || b.route} (Pos #{b.position})
                        <button onClick={() => handleDeleteItem(b.id)} className="bg-red-700 hover:bg-red-500 text-white rounded px-1">
                          <X size={9} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Table size={16} className="text-dragonfly-turquoise" />
              <h2 className="text-xs font-black text-gray-200 uppercase tracking-wider">Excel Workbook Live Preview</h2>
            </div>
            <div className="flex bg-slate-950 p-1 rounded-xl gap-1 border border-slate-800">
              {(['sheet3', 'sheet2', 'sheet1'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveSheetTab(tab)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                    activeSheetTab === tab ? 'bg-dragonfly-turquoise text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab === 'sheet3' ? 'Sheet 3: Route Summary' : tab === 'sheet2' ? 'Sheet 2: Big Box List' : 'Sheet 1: Input Mappings'}
                </button>
              ))}
            </div>
          </div>

          {activeSheetTab === 'sheet3' && (
            <div className="flex-1 overflow-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-950 text-gray-400 uppercase text-[10px] font-black border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 text-center w-36 border-r border-slate-800">Route Number</th>
                    <th className="py-2.5 px-4 text-center w-24 border-r border-slate-800">Count</th>
                    <th className="py-2.5 px-4">Index (e.g. 5, 26, 180)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {derived.sheet3Rows.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-8 text-gray-500 italic">No scanned Big Boxes yet.</td></tr>
                  ) : (
                    derived.sheet3Rows.map((row, idx) => (
                      <tr key={row.route} className={idx % 2 === 1 ? 'bg-slate-950/50' : ''}>
                        <td className="py-2 px-4 text-center font-bold text-white border-r border-slate-800/60 font-mono">{row.route}</td>
                        <td className="py-2 px-4 text-center font-bold text-dragonfly-turquoise border-r border-slate-800/60">{row.count}</td>
                        <td className="py-2 px-4 text-gray-300 font-mono text-xs">{row.indices || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeSheetTab === 'sheet2' && (
            <div className="flex-1 overflow-auto border border-slate-800 rounded-xl">
              <table className="min-w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-950 text-gray-300 uppercase text-[10px] font-black border-b border-slate-700 z-10">
                  <tr>
                    <th className="sticky left-0 bg-slate-900 py-2.5 px-3 text-center w-20 border-r border-slate-700 z-20 font-black">R#</th>
                    <th className="py-2.5 px-2 text-center w-20 border-r border-slate-800 bg-emerald-500/15 text-emerald-300 font-black text-[9px] leading-tight">ROUTE<br />TOTAL</th>
                    <th className="py-2.5 px-2 text-center w-20 border-r border-slate-700 bg-amber-500/20 text-amber-200 font-black text-[9px] leading-tight">TOTAL<br />AREA</th>
                    {Array.from({ length: 30 }, (_, i) => (
                      <th key={i + 1} className="py-2 px-1.5 text-center min-w-[28px] border-r border-slate-800 text-gray-400 text-[10px] font-black">{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {derived.sheet2Rows.length === 0 ? (
                    <tr><td colSpan={33} className="text-center py-8 text-gray-500 italic">No scanned items yet.</td></tr>
                  ) : (
                    derived.sheet2Rows.map((row, idx) => {
                      const stickyBg = idx % 2 === 1 ? 'bg-slate-900' : 'bg-slate-950';
                      return (
                        <tr key={row.route} className={idx % 2 === 1 ? 'bg-slate-950/40' : ''}>
                          <td className={`sticky left-0 ${stickyBg} py-2 px-3 text-center font-black text-white border-r-2 border-slate-700 font-mono text-xs`}>{row.route}</td>
                          <td className="py-2 px-2 text-center font-black text-emerald-300 bg-emerald-500/10 border-r border-slate-800 font-mono text-xs">{row.routeTotal}</td>
                          <td className="py-2 px-2 text-center font-black text-amber-200 bg-amber-500/10 border-r-2 border-slate-700 font-mono text-xs">{row.totalArea}</td>
                          {Array.from({ length: 30 }, (_, i) => {
                            const val = row.colCounts[i + 1];
                            return (
                              <td key={i + 1} className={`py-2 px-1 text-center font-mono text-xs border-r border-slate-800 ${val ? 'bg-amber-500/20 text-amber-200 font-black' : 'text-gray-600'}`}>
                                {val || ''}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeSheetTab === 'sheet1' && (
            <div className="flex-1 overflow-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-950 text-gray-400 uppercase text-[10px] font-black border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3 text-center w-24 border-r border-slate-800">Date</th>
                    <th className="py-2 px-3 text-center w-16 border-r border-slate-800">Pos</th>
                    <th className="py-2 px-3 text-center w-28 border-r border-slate-800">Box ID</th>
                    <th className="py-2 px-3 text-center w-20 border-r border-slate-800">Route</th>
                    <th className="py-2 px-3 border-r border-slate-800">Tracking ID (Manifest Matched Only)</th>
                    <th className="py-2 px-3 text-center w-16 border-r border-slate-800">Index</th>
                    <th className="py-2 px-3 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {derived.sheet1Rows.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-500 italic">No packages mapped yet.</td></tr>
                  ) : (
                    derived.sheet1Rows.map((row, idx) => {
                      const highlight = row.hasUnderscore
                        ? 'bg-red-500/10 text-red-200'
                        : !row.isMatched
                          ? 'bg-amber-500/5 text-gray-300'
                          : idx % 2 === 1 ? 'bg-slate-950/40' : '';
                      return (
                        <tr key={idx} className={highlight}>
                          <td className="py-1.5 px-3 text-center text-gray-500 border-r border-slate-800/60">{row.date}</td>
                          <td className="py-1.5 px-3 text-center font-bold text-gray-300 border-r border-slate-800/60">{row.position}</td>
                          <td className="py-1.5 px-3 text-center font-mono text-[10px] text-gray-400 border-r border-slate-800/60">{row.boxId}</td>
                          <td className="py-1.5 px-3 text-center font-bold text-dragonfly-turquoise border-r border-slate-800/60 font-mono">{row.route}</td>
                          <td className="py-1.5 px-3 font-mono text-[11px] border-r border-slate-800/60">
                            {row.hasUnderscore ? (
                              <span className="flex items-center gap-1.5 text-red-300 font-black">
                                <AlertTriangle size={13} className="shrink-0" />
                                {row.raw_tracking_id || row.route}
                                <span className="text-[9px] bg-red-500/20 px-1 py-0.2 rounded font-sans">UNDERSCORE ERROR</span>
                              </span>
                            ) : row.isMatched ? (
                              <span className="text-gray-200 font-medium">{row.tracking_id}</span>
                            ) : (
                              <span className="text-gray-500 italic text-[10px] flex items-center gap-1">
                                <span className="line-through font-mono">{row.raw_tracking_id || 'Unmatched'}</span>
                                <span className="text-amber-400 font-bold font-sans text-[9px]">(Not in Manifest)</span>
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-3 text-center font-bold text-white border-r border-slate-800/60">{row.manifest_index}</td>
                          <td className="py-1.5 px-3 text-center font-bold text-[10px]">
                            {row.hasUnderscore ? (
                              <span className="text-red-300 bg-red-500/20 px-1.5 py-0.5 rounded">Invalid (_)</span>
                            ) : row.isMatched ? (
                              <span className="text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">Assigned</span>
                            ) : (
                              <span className="text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded">Unmatched</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-gray-500 font-medium">
            <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-400" /> Excel generator: active</span>
            <span>Format: 3-sheet structure</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
        <Clock size={12} />
        Session persists in your browser for {currentStation} on {currentDate}. Click "New Day" to clear it.
      </div>
    </div>
  );
};

export default BigBoxMapCreator;
