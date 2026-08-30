import React, { useState, useRef, useCallback } from 'react';
import { StationCode, ProcessingStatus, ProcessingResult, LogEntry } from '../types';
import { processManifests, generateMasterZip } from '../services/manifestService';
import { DragonflyLogoGraphic } from './DragonflyLogo';
import FileUploader from './FileUploader';
import LogConsole from './LogConsole';
import { saveAs } from 'file-saver';
import {
  FileSpreadsheet,
  FileText,
  Play,
  Download,
  RefreshCw,
  Layers,
  Package,
  FileArchive,
  Zap,
  Truck,
  Globe,
  Clock,
  MapPin,
  Database,
  ArrowLeft,
  Square,
  Sparkles,
  QrCode,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface ManifestProcessorViewProps {
  currentStation: StationCode;
  onSelectStation: (station: StationCode) => void;
  onBackToHub: () => void;
  onNavigateToCards: () => void;
  onProcessingCompleted: (result: ProcessingResult) => void;
  initialResults: ProcessingResult | null;
}

export const ManifestProcessorView: React.FC<ManifestProcessorViewProps> = ({
  currentStation,
  onSelectStation,
  onBackToHub,
  onNavigateToCards,
  onProcessingCompleted,
  initialResults,
}) => {
  // File states (Exact 3 files required)
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [bizFile, setBizFile] = useState<File | null>(null);

  // Processing states
  const [status, setStatus] = useState<ProcessingStatus>(
    initialResults ? ProcessingStatus.COMPLETED : ProcessingStatus.IDLE
  );
  const [progress, setProgress] = useState(initialResults ? 100 : 0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<ProcessingResult | null>(initialResults);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shouldStopRef = useRef(false);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString(),
        message,
        type,
      },
    ]);
  }, []);

  const handleProcess = async () => {
    if (!pdfFile || !excelFile || !bizFile) return;

    shouldStopRef.current = false;
    setStatus(ProcessingStatus.READING_FILES);
    setLogs([]);
    setProgress(0);
    setResults(null);
    setErrorMessage(null);

    const stationLabel = currentStation === 'KTCH' ? 'Kitchener (KTCH)' : 'London (LNDN)';
    addLog(`Process initialized for Station: ${stationLabel}`, 'info');

    try {
      const res = await processManifests(
        pdfFile,
        excelFile,
        bizFile,
        null, // QR PDF is optional, handled client-side or omitted
        currentStation,
        addLog,
        p => setProgress(p),
        shouldStopRef
      );

      setResults(res);
      setStatus(ProcessingStatus.COMPLETED);
      addLog('All operations completed successfully.', 'success');
      onProcessingCompleted(res);
    } catch (error: any) {
      if (error.message === 'Process stopped by user.') {
        setStatus(ProcessingStatus.IDLE);
        addLog('Process was stopped by user.', 'warning');
      } else {
        setStatus(ProcessingStatus.ERROR);
        setErrorMessage(error.message || 'An unknown error occurred.');
        addLog(`Fatal Error: ${error.message}`, 'error');
      }
    }
  };

  const handleStop = () => {
    shouldStopRef.current = true;
    addLog('Stopping process upon user request...', 'warning');
  };

  const handleReset = () => {
    setPdfFile(null);
    setExcelFile(null);
    setBizFile(null);
    setLogs([]);
    setStatus(ProcessingStatus.IDLE);
    setResults(null);
    setProgress(0);
    setErrorMessage(null);
  };

  const handleDownloadMasterZip = async () => {
    if (results) {
      addLog('Preparing Master ZIP package...', 'info');
      const masterZipBlob = await generateMasterZip(results);
      const dateStr = new Date().toISOString().split('T')[0];
      saveAs(masterZipBlob, `Dragonfly_${currentStation}_Complete_Output_${dateStr}.zip`);
      addLog('Master ZIP download initiated.', 'success');
    }
  };

  const isProcessing =
    status !== ProcessingStatus.IDLE &&
    status !== ProcessingStatus.COMPLETED &&
    status !== ProcessingStatus.ERROR;

  const stationName = currentStation === 'KTCH' ? 'Kitchener' : 'London';
  const routePrefix = currentStation === 'KTCH' ? 'KTCH' : 'LNDN';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
          >
            <ArrowLeft size={16} />
            Hub
          </button>
          <div className="h-6 w-[1px] bg-slate-800"></div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <Layers size={22} className="text-dragonfly-turquoise" />
                IDC Manifest Processor
              </h1>
              <span className="text-xs font-black uppercase tracking-wider bg-dragonfly-turquoise/15 text-dragonfly-turquoise border border-dragonfly-turquoise/30 px-2 py-0.5 rounded-full">
                {currentStation}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Station {stationName} • Route Prefix: <strong className="text-white font-mono">{routePrefix}</strong> (e.g. {routePrefix}101, {routePrefix}102...)
            </p>
          </div>
        </div>

        {/* Station Switcher Pille */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onSelectStation('KTCH')}
              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                currentStation === 'KTCH'
                  ? 'bg-dragonfly-turquoise text-white shadow-md shadow-dragonfly-turquoise/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Kitchener (KTCH)
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onSelectStation('LNDN')}
              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                currentStation === 'LNDN'
                  ? 'bg-dragonfly-lightblue text-slate-950 shadow-md shadow-dragonfly-lightblue/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              London (LNDN)
            </button>
          </div>

          {results && (
            <button
              type="button"
              onClick={onNavigateToCards}
              className="px-3.5 py-1.5 bg-dragonfly-lightblue hover:bg-[#34b6e4] text-slate-950 font-black text-xs uppercase tracking-wider rounded-lg flex items-center gap-1.5 shadow-md shadow-dragonfly-lightblue/20 transition-all"
            >
              <QrCode size={15} />
              Open Card Creator →
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Area (Split Screen: Upload/Results on Left, Terminal on Right) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Left Section: Upload & Operations */}
        <div className="w-full lg:w-3/5 flex flex-col min-h-0 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8 space-y-6">
          {/* Station Context Banner */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-dragonfly-turquoise/10 border border-dragonfly-turquoise/20 flex items-center justify-center text-dragonfly-turquoise shrink-0">
                <MapPin size={20} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Target Station Mode</div>
                <div className="text-sm font-extrabold text-white">
                  {currentStation === 'KTCH' ? 'Kitchener Station' : 'London Station'} — Route numbers match <span className="text-dragonfly-turquoise font-mono">{routePrefix}*</span>
                </div>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <span className="text-[11px] font-bold text-gray-400 block uppercase">Requirements</span>
              <span className="text-xs font-semibold text-gray-200">3 Core Files Upload</span>
            </div>
          </div>

          {/* Upload Grid or Results Screen */}
          {status !== ProcessingStatus.COMPLETED ? (
            <div className="space-y-6 flex-1 flex flex-col">
              {/* Exactly 3 Required Upload Boxes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Overall Manifest (PDF) */}
                <FileUploader
                  id="pdf-upload"
                  label="1. IDC Manifest (Overall)"
                  accept=".pdf"
                  file={pdfFile}
                  onFileSelect={setPdfFile}
                  icon={<FileText className="text-red-400" size={28} />}
                  description="Daily Overall Manifest PDF"
                  required
                />

                {/* 2. Route Configuration File (Excel) */}
                <FileUploader
                  id="excel-upload"
                  label="2. Route Config File"
                  accept=".xlsx, .xls, .csv"
                  file={excelFile}
                  onFileSelect={setExcelFile}
                  icon={<FileSpreadsheet className="text-emerald-400" size={28} />}
                  description="Route to IDC Mapping (Excel)"
                  required
                />

                {/* 3. Business Database (Excel) */}
                <FileUploader
                  id="biz-upload"
                  label="3. Business Database"
                  accept=".xlsx, .xls, .csv"
                  file={bizFile}
                  onFileSelect={setBizFile}
                  icon={<FileSpreadsheet className="text-amber-400" size={28} />}
                  description="Business Directory & Seq Rules"
                  required
                />
              </div>

              {/* Error Message if any */}
              {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3 text-red-300 text-xs font-medium">
                  <AlertTriangle size={18} className="shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Button Bar */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
                <div className="text-xs text-gray-400">
                  {pdfFile && excelFile && bizFile ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 size={14} />
                      All 3 files ready for processing
                    </span>
                  ) : (
                    <span>Please upload all 3 files to start splitting</span>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {isProcessing ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                    >
                      <Square size={14} fill="currentColor" />
                      Stop Processing
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleProcess}
                      disabled={!pdfFile || !excelFile || !bizFile}
                      className={`w-full sm:w-auto px-8 py-3 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg ${
                        pdfFile && excelFile && bizFile
                          ? 'bg-dragonfly-turquoise hover:bg-[#008f7a] text-white shadow-dragonfly-turquoise/20 cursor-pointer'
                          : 'bg-slate-800 text-gray-500 cursor-not-allowed border border-slate-700'
                      }`}
                    >
                      <Play size={16} fill="currentColor" />
                      Process Manifest
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Results View */
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider mb-1">
                      <CheckCircle2 size={16} />
                      Processing Complete
                    </div>
                    <h2 className="text-2xl font-black text-white">Manifest Successfully Split</h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Station: <strong className="text-white">{stationName} ({currentStation})</strong> • Generated {results?.idcBundles.length} IDC ZIP bundles and consolidated summary.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw size={14} />
                      New Batch
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadMasterZip}
                      className="px-5 py-2 bg-dragonfly-turquoise hover:bg-[#008f7a] text-white text-xs font-black uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-dragonfly-turquoise/20"
                    >
                      <Download size={15} />
                      Master ZIP
                    </button>
                  </div>
                </div>

                {/* Prominent Next Action: Send to Check-in Check-out Creator */}
                <div className="bg-gradient-to-r from-dragonfly-lightblue/15 via-slate-950 to-slate-950 border border-dragonfly-lightblue/30 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <QrCode size={18} className="text-dragonfly-lightblue" />
                      <span className="text-xs font-black uppercase tracking-wider text-dragonfly-lightblue">
                        Next Operational Step
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">Generate Driver Check-in / Check-out Cards</h3>
                    <p className="text-xs text-gray-400">
                      Export all {results?.summaryRows.length} extracted routes & QR barcodes directly into the Check-in Card Creator.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onNavigateToCards}
                    className="px-5 py-2.5 bg-dragonfly-lightblue hover:bg-[#34b6e4] text-slate-950 font-black text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-md shadow-dragonfly-lightblue/20 transition-all shrink-0"
                  >
                    Open Card Creator
                    <ArrowRight size={16} />
                  </button>
                </div>

                {/* IDC Bundles Grid */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Generated IDC Depot Packages ({results?.idcBundles.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {results?.idcBundles.map((bundle, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-dragonfly-turquoise/10 border border-dragonfly-turquoise/20 flex items-center justify-center text-dragonfly-turquoise shrink-0">
                            <FileArchive size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{bundle.name}</div>
                            <div className="text-[11px] text-gray-400">
                              {bundle.routeCount} route PDFs + WhatsApp & Landscape PDF
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => saveAs(bundle.blob, bundle.filename)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-dragonfly-turquoise rounded-lg transition-colors"
                          title="Download IDC ZIP"
                        >
                          <Download size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary Report Download */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <FileSpreadsheet size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{results?.summaryName}</div>
                      <div className="text-[11px] text-gray-400">Consolidated Master Excel Report</div>
                    </div>
                  </div>
                  {results && (
                    <button
                      type="button"
                      onClick={() => saveAs(results.summaryBlob, results.summaryName)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Download size={14} />
                      Download Excel
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Real-time Terminal Log Console */}
        <div className="w-full lg:w-2/5 flex flex-col min-h-0 bg-[#1e293b] border-t lg:border-t-0 lg:border-l border-slate-800">
          <LogConsole logs={logs} />
        </div>
      </div>
    </div>
  );
};

export default ManifestProcessorView;
