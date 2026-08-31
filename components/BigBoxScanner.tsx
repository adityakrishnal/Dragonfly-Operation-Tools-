import React, { useEffect, useRef, useState } from 'react';
import { BigBoxManifestPackage, BigBoxScannedItem } from '../types';
import { resolveScan, ScanResolution } from '../services/bigBoxMappingService';
import { Barcode, ArrowRight, CheckCircle2, AlertTriangle, Sparkles, Plus } from 'lucide-react';

interface BigBoxScannerProps {
  manifestPackages: BigBoxManifestPackage[];
  scannedItems: BigBoxScannedItem[];
  onScan: (resolution: ScanResolution) => void;
  onNextColumn: () => void;
}

export const BigBoxScanner: React.FC<BigBoxScannerProps> = ({
  manifestPackages,
  scannedItems,
  onScan,
  onNextColumn
}) => {
  const [scanInput, setScanInput] = useState('');
  const [lastDetection, setLastDetection] = useState<ScanResolution | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [scannedItems.length]);

  const knownRoutesCount = React.useMemo(() => {
    const set = new Set<string>();
    manifestPackages.forEach(p => {
      const r = String(p.route || '').trim();
      if (r && r !== '0000') set.add(r);
    });
    return set.size;
  }, [manifestPackages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    const result = resolveScan(scanInput, manifestPackages, scannedItems);
    if (result.route) {
      onScan(result);
      setLastDetection(result);
    }
    setScanInput('');
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const hasUnderscoreDraft = scanInput.includes('_');

  return (
    <div className="w-full h-full flex flex-col p-5">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Barcode Scanner</h2>
          <p className="text-[10px] text-gray-500">Scan either Tracking ID or Route barcode</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNextColumn}
            className="bg-dragonfly-turquoise/15 hover:bg-dragonfly-turquoise/25 text-dragonfly-turquoise px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 border border-dragonfly-turquoise/30"
            title="Start next physical staging column"
          >
            <Plus size={12} />
            Next Col
          </button>
          <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> READY
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-14 h-14 bg-dragonfly-turquoise/10 rounded-2xl flex items-center justify-center mb-2 border-2 border-dragonfly-turquoise/20 shadow-sm relative">
          <Barcode size={28} className="text-dragonfly-turquoise" />
          {manifestPackages.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
              <Sparkles size={10} />
            </span>
          )}
        </div>

        <p className="text-[11px] font-medium text-gray-400 mb-2 text-center max-w-xs">
          Scan <strong className="text-gray-200">Tracking ID</strong> barcode (auto-detects Route) or enter <strong className="text-gray-200">Route #</strong>
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Scan Tracking ID or Route #"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            className={`w-full border-2 rounded-xl px-3 py-2 text-center text-base font-mono font-bold outline-none transition-all placeholder:text-gray-500 placeholder:text-xs placeholder:font-sans bg-slate-950 ${
              hasUnderscoreDraft
                ? 'border-red-500 text-red-300 ring-4 ring-red-500/20'
                : 'border-dragonfly-turquoise/40 text-white focus:border-dragonfly-turquoise focus:ring-4 focus:ring-dragonfly-turquoise/20'
            }`}
            autoFocus
          />

          {hasUnderscoreDraft && (
            <div className="bg-red-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm">
              <AlertTriangle size={14} className="shrink-0" />
              <span>Underscore Detected: "{scanInput}"</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2 bg-dragonfly-turquoise hover:bg-[#008f7a] text-white text-xs font-bold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5"
          >
            <span>Record Scan</span>
            <ArrowRight size={14} />
          </button>
        </form>

        {lastDetection && (
          <div className={`mt-2.5 text-[11px] px-3 py-1.5 rounded-xl border flex flex-col items-center gap-0.5 text-center max-w-xs ${
            lastDetection.hasUnderscore
              ? 'bg-red-500/10 text-red-300 border-red-500/30'
              : lastDetection.detectedFromTracking
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-dragonfly-turquoise/10 text-dragonfly-turquoise border-dragonfly-turquoise/30'
          }`}>
            <div className="flex items-center gap-1 font-bold">
              {lastDetection.hasUnderscore ? (
                <AlertTriangle size={14} className="text-red-400" />
              ) : (
                <CheckCircle2 size={14} className="text-emerald-400" />
              )}
              <span>Assigned Route <strong className="font-mono text-xs underline decoration-2">{lastDetection.route}</strong></span>
              {lastDetection.manifestIndex && (
                <span className="text-[10px] bg-slate-950 px-1.5 py-0.2 rounded border border-emerald-500/30 text-emerald-300">
                  Stop #{lastDetection.manifestIndex}
                </span>
              )}
            </div>
            {lastDetection.trackingId && (
              <span className="text-[10px] font-mono truncate max-w-[240px] text-gray-400">
                {lastDetection.hasUnderscore ? 'Invalid ID with _: ' : 'Matched ID: '} {lastDetection.trackingId}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-slate-800 pt-2 flex justify-between items-center text-[10px] text-gray-500 font-medium">
        <span>Position #{scannedItems.length + 1}</span>
        <div className="flex gap-2">
          <span>{manifestPackages.length} pkgs loaded</span>
          <span>•</span>
          <span>{knownRoutesCount} routes</span>
        </div>
      </div>
    </div>
  );
};

export default BigBoxScanner;
