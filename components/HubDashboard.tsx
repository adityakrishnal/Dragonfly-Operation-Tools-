import React from 'react';
import { StationCode, OperatorProfile, DESIGNATION_OPTIONS } from '../types';
import { DragonflyLogoGraphic } from './DragonflyLogo';
import { 
  FileText, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  FileSpreadsheet, 
  Printer, 
  Package,
  Calendar,
  User,
  SlidersHorizontal,
  ChevronRight,
  Boxes,
  QrCode
} from 'lucide-react';

interface HubDashboardProps {
  currentStation: StationCode;
  onSelectStation: (station: StationCode) => void;
  operatorProfile: OperatorProfile;
  onUpdateOperator: (profile: OperatorProfile) => void;
  currentDate: string;
  onSelectDate: (date: string) => void;
  onNavigate: (view: 'manifest' | 'generator' | 'bigbox' | 'feedback') => void;
  processedRoutesCount: number;
  hasManifestResults: boolean;
}

export const HubDashboard: React.FC<HubDashboardProps> = ({
  currentStation,
  onSelectStation,
  operatorProfile,
  onUpdateOperator,
  currentDate,
  onSelectDate,
  onNavigate,
  processedRoutesCount,
  hasManifestResults,
}) => {
  const stationName = currentStation === 'KTCH' ? 'Kitchener Depot' : 'London Depot';
  const routePrefix = currentStation === 'KTCH' ? 'KTCH' : 'LNDN';

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full text-slate-100">
      {/* Hero Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-dragonfly-turquoise/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <DragonflyLogoGraphic height={32} />
              <div className="h-5 w-[1px] bg-slate-700"></div>
              <span className="text-xs font-black tracking-widest uppercase text-dragonfly-turquoise bg-dragonfly-turquoise/10 px-2.5 py-1 rounded-full border border-dragonfly-turquoise/20">
                Operations Hub
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
              Dragonfly | Intelcom Operational Tools Hub
            </h1>
            <p className="text-sm md:text-base text-gray-400 max-w-2xl leading-relaxed">
              Unified workstation for station dispatch operations, automated IDC manifest parsing, 2-up driver card generation, and oversized Big Box staging floor mapping.
            </p>
          </div>

          {/* Quick Station & Date Bar */}
          <div className="bg-slate-950/80 backdrop-blur border border-slate-800 rounded-xl p-4 flex flex-col gap-3 min-w-[290px]">
            <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal size={13} className="text-dragonfly-turquoise" />
                Station Selection
              </span>
              <span className="text-[10px] text-dragonfly-turquoise font-mono">Prefix: {routePrefix}*</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSelectStation('KTCH')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                  currentStation === 'KTCH'
                    ? 'bg-dragonfly-turquoise/15 border-dragonfly-turquoise text-white shadow-lg shadow-dragonfly-turquoise/10 font-bold ring-1 ring-dragonfly-turquoise'
                    : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <span className="text-sm font-black tracking-wider">KITCHENER</span>
                <span className="text-[10px] font-mono text-dragonfly-turquoise mt-0.5">KTCH Hub</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectStation('LNDN')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                  currentStation === 'LNDN'
                    ? 'bg-dragonfly-lightblue/15 border-dragonfly-lightblue text-white shadow-lg shadow-dragonfly-lightblue/10 font-bold ring-1 ring-dragonfly-lightblue'
                    : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <span className="text-sm font-black tracking-wider">LONDON</span>
                <span className="text-[10px] font-mono text-dragonfly-lightblue mt-0.5">LNDN Hub</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Operator Identity & Date Configuration Row */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs shadow-md">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <User size={16} className="text-dragonfly-turquoise" />
            <span className="text-gray-400 font-semibold">Operator Name:</span>
            <input
              type="text"
              value={operatorProfile.name}
              onChange={(e) => onUpdateOperator({ ...operatorProfile, name: e.target.value })}
              placeholder="Enter your name"
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-semibold focus:border-dragonfly-turquoise focus:outline-none w-48"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-semibold">Designation:</span>
            <select
              value={operatorProfile.designation}
              onChange={(e) => onUpdateOperator({ ...operatorProfile, designation: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:border-dragonfly-turquoise focus:outline-none cursor-pointer"
            >
              {DESIGNATION_OPTIONS.map((des) => (
                <option key={des} value={des}>
                  {des}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
            <Calendar size={14} className="text-dragonfly-turquoise" />
            <span className="text-gray-400 font-medium">Date:</span>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => onSelectDate(e.target.value)}
              className="bg-transparent text-xs text-white font-mono focus:outline-none cursor-pointer"
            />
          </div>

          <div className="text-[11px] text-gray-400 hidden sm:block">
            Station: <strong className="text-white">{stationName} ({currentStation})</strong>
          </div>
        </div>
      </div>

      {/* Operational Apps Grid - EXACTLY 3 APPS */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Boxes size={20} className="text-dragonfly-turquoise" />
            Operational Tools
          </h2>
          <p className="text-xs md:text-sm text-gray-400">The three core logistics workstation applications for {currentStation === 'KTCH' ? 'Kitchener' : 'London'} station operations.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* App 1: IDC Manifest Processor */}
          <div className="group relative flex flex-col bg-slate-900/90 border border-slate-800 hover:border-dragonfly-turquoise/60 rounded-2xl p-6 transition-all duration-200 hover:shadow-xl hover:shadow-dragonfly-turquoise/5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-dragonfly-turquoise/10 border border-dragonfly-turquoise/20 flex items-center justify-center text-dragonfly-turquoise group-hover:scale-105 transition-transform">
                <Layers size={26} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-dragonfly-turquoise/15 text-dragonfly-turquoise border border-dragonfly-turquoise/30">
                3 Uploads
              </span>
            </div>

            <div className="space-y-2 mb-6 flex-1">
              <h3 className="text-lg font-bold text-white group-hover:text-dragonfly-turquoise transition-colors flex items-center justify-between">
                IDC Manifest Processor
                <ChevronRight size={18} className="text-gray-500 group-hover:text-dragonfly-turquoise group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Split daily master manifest PDFs into individual route PDFs organized into IDC depot folders. Cross-matches business packages, builds WhatsApp dispatch summaries, and generates consolidated Excel reports.
              </p>

              <div className="pt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Required Files (3 Files):</div>
                <div className="grid grid-cols-1 gap-1 text-[11px] text-gray-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <FileText size={12} className="text-red-400 shrink-0" />
                    <span>1. Overall Manifest (PDF)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileSpreadsheet size={12} className="text-emerald-400 shrink-0" />
                    <span>2. Route Config (Excel)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileSpreadsheet size={12} className="text-amber-400 shrink-0" />
                    <span>3. Business Database (Excel)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs text-gray-400 font-medium">
                {hasManifestResults ? (
                  <span className="text-dragonfly-turquoise font-semibold flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    {processedRoutesCount} routes parsed
                  </span>
                ) : (
                  <span>Ready to process</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigate('manifest')}
                className="px-3.5 py-1.5 bg-dragonfly-turquoise text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-[#008f7a] transition-colors flex items-center gap-1.5 shadow-md shadow-dragonfly-turquoise/20"
              >
                Open Tool
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* App 2: Check-In / Check-Out Card Generator */}
          <div className="group relative flex flex-col bg-slate-900/90 border border-slate-800 hover:border-dragonfly-lightblue/60 rounded-2xl p-6 transition-all duration-200 hover:shadow-xl hover:shadow-dragonfly-lightblue/5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-dragonfly-lightblue/10 border border-dragonfly-lightblue/20 flex items-center justify-center text-dragonfly-lightblue group-hover:scale-105 transition-transform">
                <Printer size={26} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-dragonfly-lightblue/15 text-dragonfly-lightblue border border-dragonfly-lightblue/30">
                2-Up Cards
              </span>
            </div>

            <div className="space-y-2 mb-6 flex-1">
              <h3 className="text-lg font-bold text-white group-hover:text-dragonfly-lightblue transition-colors flex items-center justify-between">
                Check-In / Out Card Generator
                <ChevronRight size={18} className="text-gray-500 group-hover:text-dragonfly-lightblue group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Choose Dragonfly's official check-in/out card template (or custom template) and upload Route Manifest PDF to auto-detect routes with QR codes and generate 2-up printable driver cards.
              </p>

              <div className="pt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Workflow:</div>
                <div className="grid grid-cols-1 gap-1 text-[11px] text-gray-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <FileText size={12} className="text-dragonfly-turquoise shrink-0" />
                    <span>1. Official Dragonfly Card Template</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <QrCode size={12} className="text-dragonfly-lightblue shrink-0" />
                    <span>2. Route Manifest PDF (QR Auto-Detect)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs text-gray-400 font-medium">
                <span>Printable 2-up slips</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('generator')}
                className="px-3.5 py-1.5 bg-dragonfly-lightblue text-slate-950 text-xs font-black uppercase tracking-wider rounded-lg hover:bg-[#34b6e4] transition-colors flex items-center gap-1.5 shadow-md shadow-dragonfly-lightblue/20"
              >
                Open Tool
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* App 3: Big Box Map Creator */}
          <div className="group relative flex flex-col bg-slate-900/90 border border-slate-800 hover:border-amber-500/60 rounded-2xl p-6 transition-all duration-200 hover:shadow-xl hover:shadow-amber-500/5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                <Package size={26} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Staging Floor
              </span>
            </div>

            <div className="space-y-2 mb-6 flex-1">
              <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors flex items-center justify-between">
                Big Box Map Creator
                <ChevronRight size={18} className="text-gray-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Warehouse staging floor map across bays 1-10 for oversized packages (furniture, mattresses, tires). Manage delivery zone clusters, 2-person heavy lift alerts, and van load sequencing.
              </p>

              <div className="pt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Features:</div>
                <div className="grid grid-cols-1 gap-1 text-[11px] text-gray-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Boxes size={12} className="text-amber-400 shrink-0" />
                    <span>Warehouse Floor Bays 1-10</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-dragonfly-turquoise shrink-0" />
                    <span>5 Regional Delivery Zones</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs text-gray-400 font-medium">
                <span>Heavy-lift & staging</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('bigbox')}
                className="px-3.5 py-1.5 bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-1.5 shadow-md shadow-amber-500/20"
              >
                Open Tool
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Station Quick Guide */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={16} className="text-dragonfly-turquoise" />
              Dragonfly Operational Standards & Station Prefix Rules
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('feedback')}
            className="text-xs text-dragonfly-turquoise hover:underline flex items-center gap-1"
          >
            Submit Feedback / Support Issue
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 text-xs text-gray-400">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 space-y-1">
            <div className="font-bold text-dragonfly-turquoise flex items-center gap-1.5">
              <span>📍 Kitchener Station (KTCH)</span>
            </div>
            <p className="text-gray-300">
              Routes begin with <strong>KTCH</strong> (e.g. <code className="text-amber-400 font-mono">KTCH101</code>, <code className="text-amber-400 font-mono">KTCH1200</code>).
            </p>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 space-y-1">
            <div className="font-bold text-dragonfly-lightblue flex items-center gap-1.5">
              <span>📍 London Station (LNDN)</span>
            </div>
            <p className="text-gray-300">
              Routes begin with <strong>LNDN</strong> (e.g. <code className="text-amber-400 font-mono">LNDN101</code>, <code className="text-amber-400 font-mono">LNDN1200</code>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HubDashboard;
