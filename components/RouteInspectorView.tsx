import React, { useState, useMemo } from 'react';
import { StationCode, ProcessingResult, BusinessPackage } from '../types';
import { DragonflyLogoGraphic } from './DragonflyLogo';
import {
  Search,
  ArrowLeft,
  Filter,
  MapPin,
  Clock,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Calendar,
  ExternalLink,
  ChevronRight,
  TrendingUp
} from 'lucide-react';

interface RouteInspectorViewProps {
  currentStation: StationCode;
  onSelectStation: (station: StationCode) => void;
  results: ProcessingResult | null;
  onBackToHub: () => void;
  onNavigateToManifest: () => void;
  onNavigateToCards: () => void;
}

export const RouteInspectorView: React.FC<RouteInspectorViewProps> = ({
  currentStation,
  onSelectStation,
  results,
  onBackToHub,
  onNavigateToManifest,
  onNavigateToCards,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIdcFilter, setSelectedIdcFilter] = useState<string>('all');
  const [onlyBusinessStops, setOnlyBusinessStops] = useState(false);

  const routePrefix = currentStation === 'KTCH' ? 'KTCH' : 'LNDN';
  const summaryRows = results?.summaryRows || [];
  const businessPackages = results?.businessPackages || [];

  // Extract unique IDCs
  const uniqueIdcs = useMemo(() => {
    const set = new Set<string>();
    summaryRows.forEach(r => {
      if (r.IDC) set.add(String(r.IDC));
    });
    return Array.from(set).sort();
  }, [summaryRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return summaryRows.filter(r => {
      const routeStr = String(r.Route || '').toUpperCase();
      const idcStr = String(r.IDC || '').toUpperCase();
      const searchUpper = searchTerm.trim().toUpperCase();

      const matchesSearch = !searchUpper || routeStr.includes(searchUpper) || idcStr.includes(searchUpper);
      const matchesIdc = selectedIdcFilter === 'all' || r.IDC === selectedIdcFilter;
      const matchesBiz = !onlyBusinessStops || (Number(r["Business Stops"]) > 0);

      return matchesSearch && matchesIdc && matchesBiz;
    });
  }, [summaryRows, searchTerm, selectedIdcFilter, onlyBusinessStops]);

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
                <Search size={22} className="text-dragonfly-orange" />
                Dispatch & Route Inspector
              </h1>
              <span className="text-xs font-black uppercase tracking-wider bg-dragonfly-orange/15 text-dragonfly-orange border border-dragonfly-orange/30 px-2 py-0.5 rounded-full">
                {currentStation}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Live route breakdown, sequence validation & business delivery stop directory
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateToCards}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
          >
            Check-In Cards →
          </button>
          <button
            type="button"
            onClick={onNavigateToManifest}
            className="px-3 py-1.5 bg-dragonfly-turquoise hover:bg-[#008f7a] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
          >
            Manifest Processor →
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Search & Filter Bar */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder={`Search by route (e.g. ${routePrefix}101) or IDC...`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-dragonfly-orange"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* IDC Select Filter */}
            {uniqueIdcs.length > 0 && (
              <select
                value={selectedIdcFilter}
                onChange={e => setSelectedIdcFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-dragonfly-orange"
              >
                <option value="all">All IDCs / Depots</option>
                {uniqueIdcs.map(idc => (
                  <option key={idc} value={idc}>
                    {idc}
                  </option>
                ))}
              </select>
            )}

            {/* Only business checkbox */}
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
              <input
                type="checkbox"
                checked={onlyBusinessStops}
                onChange={e => setOnlyBusinessStops(e.target.checked)}
                className="accent-dragonfly-orange rounded"
              />
              <span>Has Business Stops</span>
            </label>
          </div>
        </div>

        {/* Empty state if no manifest results loaded yet */}
        {!results || summaryRows.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 p-8 space-y-4">
            <Layers size={48} className="mx-auto text-gray-600" />
            <div>
              <h3 className="text-lg font-bold text-white mb-1">No Manifest Loaded Yet</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Run the IDC Manifest Processor to populate live route sequences, package counts, and business stop mappings for {currentStation}.
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToManifest}
              className="px-5 py-2.5 bg-dragonfly-turquoise text-white font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-[#008f7a] shadow-lg shadow-dragonfly-turquoise/20 inline-flex items-center gap-2"
            >
              Open Manifest Processor
              <ChevronRight size={15} />
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Routes</span>
                <strong className="text-2xl font-black text-white">{summaryRows.length}</strong>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">IDC Depot Bundles</span>
                <strong className="text-2xl font-black text-dragonfly-turquoise">{results.idcBundles.length}</strong>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Business Package Stops</span>
                <strong className="text-2xl font-black text-amber-400">{businessPackages.length}</strong>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Included in Manifest</span>
                <strong className="text-2xl font-black text-emerald-400">
                  {summaryRows.filter(r => r.Status === 'Included').length}
                </strong>
              </div>
            </div>

            {/* Route List Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-dragonfly-turquoise" />
                  Routes & Sequence Inventory ({filteredRows.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-gray-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Route ID</th>
                      <th className="py-3 px-4">Assigned IDC</th>
                      <th className="py-3 px-4">Packages</th>
                      <th className="py-3 px-4">Sequence Range</th>
                      <th className="py-3 px-4">Pages in PDF</th>
                      <th className="py-3 px-4">Business Stops</th>
                      <th className="py-3 px-4">Manifest Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-black text-white text-sm text-dragonfly-turquoise font-mono">
                          {r.Route}
                        </td>
                        <td className="py-3 px-4 text-gray-200 font-semibold">{r.IDC}</td>
                        <td className="py-3 px-4 font-bold text-white">{r.packageCount || '—'}</td>
                        <td className="py-3 px-4 font-mono text-gray-300">{r.seqRange || '—'}</td>
                        <td className="py-3 px-4 text-gray-300">{r["Pages Found"]} page(s)</td>
                        <td className="py-3 px-4">
                          {Number(r["Business Stops"]) > 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded text-[11px]">
                              <AlertTriangle size={11} />
                              {r["Business Stops"]} Stop(s)
                            </span>
                          ) : (
                            <span className="text-gray-500">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              r.Status === 'Included'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-red-500/15 text-red-400 border-red-500/30'
                            }`}
                          >
                            {r.Status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteInspectorView;
