import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StationCode, DispatchCard, BusinessPackage, RouteSummaryItem } from '../types';
import { createDispatchCardsFromManifest, createManualDispatchCard, generateQrDataUrl } from '../services/qrCardService';
import { DragonflyLogoGraphic } from './DragonflyLogo';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  QrCode,
  Printer,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  User,
  Truck,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  Calendar,
  Layers,
  Phone,
  AlertTriangle,
  FileText,
  Scan,
  Zap,
  CheckSquare,
  XCircle,
  Copy,
  ExternalLink
} from 'lucide-react';

interface CheckInOutCardCreatorProps {
  currentStation: StationCode;
  onSelectStation: (station: StationCode) => void;
  manifestSummaryRows: any[];
  businessPackages: BusinessPackage[];
  onBackToHub: () => void;
  onNavigateToManifest: () => void;
}

export const CheckInOutCardCreator: React.FC<CheckInOutCardCreatorProps> = ({
  currentStation,
  onSelectStation,
  manifestSummaryRows,
  businessPackages,
  onBackToHub,
  onNavigateToManifest,
}) => {
  const [cards, setCards] = useState<DispatchCard[]>([]);
  const [activeTab, setActiveTab] = useState<'cards' | 'print' | 'scanner' | 'table'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'checked_out' | 'checked_in'>('all');
  const [printLayout, setPrintLayout] = useState<'2up' | '4up' | '1up'>('2up');
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [editingCard, setEditingCard] = useState<DispatchCard | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRouteInput, setNewRouteInput] = useState('');
  const [newIdcInput, setNewIdcInput] = useState('Primary Hub');
  const [newPkgInput, setNewPkgInput] = useState('120');
  const [newSeqInput, setNewSeqInput] = useState('1 - 120');
  const [newDriverInput, setNewDriverInput] = useState('');

  // Scanner Terminal state
  const [scanInput, setScanInput] = useState('');
  const [scanMessage, setScanMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Initialize with sample cards or manifest routes
  useEffect(() => {
    const initCards = async () => {
      if (manifestSummaryRows && manifestSummaryRows.length > 0) {
        const generated = await createDispatchCardsFromManifest(
          currentStation,
          manifestSummaryRows,
          businessPackages
        );
        setCards(generated);
      } else {
        // Create initial default sample cards for the selected station
        const defaultPrefix = currentStation === 'KTCH' ? 'KTCH' : 'LNDN';
        const sample1 = await createManualDispatchCard(currentStation, `${defaultPrefix}101`, 'IDC-1 Waterloo', 142, '1 - 142', 'Alex Miller');
        const sample2 = await createManualDispatchCard(currentStation, `${defaultPrefix}102`, 'IDC-1 Waterloo', 118, '1 - 118', 'Sarah Jenkins');
        const sample3 = await createManualDispatchCard(currentStation, `${defaultPrefix}103`, 'IDC-2 Cambridge', 156, '1 - 156', 'David Chen');
        const sample4 = await createManualDispatchCard(currentStation, `${defaultPrefix}104`, 'IDC-2 Cambridge', 98, '1 - 98', 'Marcus Vance');
        setCards([sample1, sample2, sample3, sample4]);
      }
    };
    initCards();
  }, [currentStation, manifestSummaryRows, businessPackages]);

  // Sync from manifest manually
  const handleSyncFromManifest = async () => {
    if (!manifestSummaryRows.length) return;
    const generated = await createDispatchCardsFromManifest(
      currentStation,
      manifestSummaryRows,
      businessPackages
    );
    setCards(generated);
    setScanMessage({ text: `Successfully synced ${generated.length} routes from manifest!`, type: 'success' });
    setTimeout(() => setScanMessage(null), 3000);
  };

  // Filtered Cards
  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      const matchesSearch =
        card.route.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.idc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (card.vehicleNumber && card.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' ? true : card.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [cards, searchQuery, statusFilter]);

  // Handle Quick Status Changes
  const handleCheckOut = (cardId: string) => {
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setCards(prev =>
      prev.map(c => (c.id === cardId ? { ...c, status: 'checked_out', checkOutTime: timeNow } : c))
    );
  };

  const handleCheckIn = (cardId: string) => {
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setCards(prev =>
      prev.map(c =>
        c.id === cardId
          ? {
              ...c,
              status: 'checked_in',
              checkInTime: timeNow,
              deliveredCount: c.packageCount,
              returnedCount: 0,
            }
          : c
      )
    );
  };

  const handleDeleteCard = (cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId));
  };

  // Add Manual Card
  const handleAddManualCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteInput.trim()) return;
    const newCard = await createManualDispatchCard(
      currentStation,
      newRouteInput.trim(),
      newIdcInput.trim() || 'Primary Hub',
      parseInt(newPkgInput) || 0,
      newSeqInput.trim() || `1 - ${newPkgInput}`,
      newDriverInput.trim()
    );
    setCards(prev => [newCard, ...prev]);
    setShowAddModal(false);
    setNewRouteInput('');
    setNewDriverInput('');
  };

  // Scanner Terminal Action
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = scanInput.trim().toUpperCase();
    if (!query) return;

    // Support scanning raw route e.g. KTCH101 or full payload DFLY|CARD|...
    let targetRoute = query;
    if (query.includes('DFLY|CARD|')) {
      const parts = query.split('|');
      if (parts[3]) targetRoute = parts[3].toUpperCase();
    }

    const matchedCard = cards.find(c => c.route === targetRoute || c.id === query);
    if (!matchedCard) {
      setScanMessage({ text: `Route "${targetRoute}" not found in current dispatch cards.`, type: 'error' });
      return;
    }

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (matchedCard.status === 'pending') {
      // Check Out
      setCards(prev =>
        prev.map(c => (c.id === matchedCard.id ? { ...c, status: 'checked_out', checkOutTime: timeNow } : c))
      );
      setScanMessage({
        text: `✓ [CHECK-OUT SUCCESS] Route ${matchedCard.route} checked out at ${timeNow}. Driver: ${matchedCard.driverName || 'Unassigned'}`,
        type: 'success',
      });
    } else if (matchedCard.status === 'checked_out') {
      // Check In
      setCards(prev =>
        prev.map(c =>
          c.id === matchedCard.id
            ? { ...c, status: 'checked_in', checkInTime: timeNow, deliveredCount: c.packageCount, returnedCount: 0 }
            : c
        )
      );
      setScanMessage({
        text: `✓ [CHECK-IN RETURN SUCCESS] Route ${matchedCard.route} returned and checked in at ${timeNow}.`,
        type: 'success',
      });
    } else {
      setScanMessage({
        text: `ℹ Route ${matchedCard.route} is already marked as Completed / Checked In at ${matchedCard.checkInTime}.`,
        type: 'info',
      });
    }
    setScanInput('');
  };

  // Export Cards to Excel
  const handleExportExcel = () => {
    const data = cards.map(c => ({
      Route: c.route,
      Station: c.station,
      IDC: c.idc,
      Date: c.date,
      "Driver Name": c.driverName,
      "Package Count": c.packageCount,
      "Sequence Range": c.seqRange,
      "Business Stops": c.businessStopsCount,
      Status: c.status,
      "Check-Out Time": c.checkOutTime || '',
      "Check-In Time": c.checkInTime || '',
      "Delivered Packages": c.deliveredCount ?? '',
      "Returned Packages": c.returnedCount ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dispatch Cards");
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Dragonfly_${currentStation}_Dispatch_Cards_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Trigger Print
  const handlePrint = () => {
    window.print();
  };

  const stationPrefix = currentStation === 'KTCH' ? 'KTCH' : 'LNDN';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Header Bar */}
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
                <QrCode size={22} className="text-dragonfly-lightblue" />
                Check-in / Check-out Card Creator
              </h1>
              <span className="text-xs font-black uppercase tracking-wider bg-dragonfly-lightblue/15 text-dragonfly-lightblue border border-dragonfly-lightblue/30 px-2 py-0.5 rounded-full">
                {currentStation}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Station {currentStation === 'KTCH' ? 'Kitchener' : 'London'} • Generate QR dispatch cards & track driver return status
            </p>
          </div>
        </div>

        {/* Action Controls & Station Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Station Switcher Pill */}
          <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center">
            <button
              type="button"
              onClick={() => onSelectStation('KTCH')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                currentStation === 'KTCH'
                  ? 'bg-dragonfly-turquoise text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              KTCH
            </button>
            <button
              type="button"
              onClick={() => onSelectStation('LNDN')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                currentStation === 'LNDN'
                  ? 'bg-dragonfly-lightblue text-slate-950 shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              LNDN
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
          >
            <Plus size={14} className="text-dragonfly-turquoise" />
            Add Route Card
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
          >
            <Download size={14} className="text-emerald-400" />
            Export Excel
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('print');
              setTimeout(() => handlePrint(), 300);
            }}
            className="px-4 py-1.5 bg-dragonfly-lightblue hover:bg-[#34b6e4] text-slate-950 rounded-lg transition-colors text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-dragonfly-lightblue/20"
          >
            <Printer size={15} />
            Print Cards
          </button>
        </div>
      </div>

      {/* Sync Banner if Manifest Processor has routes ready */}
      {manifestSummaryRows && manifestSummaryRows.length > 0 && (
        <div className="bg-gradient-to-r from-dragonfly-turquoise/15 via-slate-900 to-slate-900 border-b border-dragonfly-turquoise/30 px-4 md:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-dragonfly-turquoise">
            <Sparkles size={16} />
            <span>
              <strong>Manifest Link Ready:</strong> {manifestSummaryRows.length} routes available from IDC Manifest Processor.
            </span>
          </div>
          <button
            type="button"
            onClick={handleSyncFromManifest}
            className="px-3 py-1 bg-dragonfly-turquoise text-white font-bold rounded hover:bg-[#008f7a] transition-colors flex items-center gap-1 shadow-sm"
          >
            <RefreshCw size={12} />
            Sync All {manifestSummaryRows.length} Routes
          </button>
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-4 md:px-8 flex items-center justify-between overflow-x-auto">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('cards')}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'cards'
                ? 'border-dragonfly-lightblue text-dragonfly-lightblue'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers size={14} />
            Card Grid ({cards.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'table'
                ? 'border-dragonfly-lightblue text-dragonfly-lightblue'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileSpreadsheet size={14} />
            Dispatch Sheet Table
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scanner')}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'scanner'
                ? 'border-dragonfly-lightblue text-dragonfly-lightblue'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Scan size={14} />
            Live Scan Terminal
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('print')}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'print'
                ? 'border-dragonfly-lightblue text-dragonfly-lightblue'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Printer size={14} />
            Print Preview Sheets
          </button>
        </div>

        {activeTab === 'print' && (
          <div className="flex items-center gap-2 py-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Sheet Layout:</span>
            <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPrintLayout('1up')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded ${printLayout === '1up' ? 'bg-slate-700 text-white' : 'text-gray-400'}`}
              >
                1 Per Page
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('2up')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded ${printLayout === '2up' ? 'bg-slate-700 text-white' : 'text-gray-400'}`}
              >
                2 Per Page
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('4up')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded ${printLayout === '4up' ? 'bg-slate-700 text-white' : 'text-gray-400'}`}
              >
                4 Per Page (Quarter)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
        {/* ================= VIEW 1: CARDS GRID ================= */}
        {activeTab === 'cards' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div className="relative w-full md:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search route, driver, or IDC..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-dragonfly-lightblue"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1 rounded font-bold transition-colors ${statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-gray-400'}`}
                  >
                    All ({cards.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1 rounded font-bold transition-colors ${statusFilter === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'text-gray-400'}`}
                  >
                    Pending ({cards.filter(c => c.status === 'pending').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('checked_out')}
                    className={`px-3 py-1 rounded font-bold transition-colors ${statusFilter === 'checked_out' ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400'}`}
                  >
                    Out on Road ({cards.filter(c => c.status === 'checked_out').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('checked_in')}
                    className={`px-3 py-1 rounded font-bold transition-colors ${statusFilter === 'checked_in' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400'}`}
                  >
                    Checked In ({cards.filter(c => c.status === 'checked_in').length})
                  </button>
                </div>
              </div>
            </div>

            {/* Cards Grid */}
            {filteredCards.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 p-8">
                <QrCode size={48} className="mx-auto text-gray-600 mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">No dispatch cards match your filter</h3>
                <p className="text-xs text-gray-400 mb-4">Add a new route card manually or sync routes from the manifest processor.</p>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-dragonfly-turquoise text-white text-xs font-bold uppercase rounded-lg"
                >
                  Create New Card
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredCards.map(card => (
                  <div
                    key={card.id}
                    className="relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col hover:border-slate-700 transition-all"
                  >
                    {/* Card Top Brand Banner */}
                    <div className="bg-slate-950 p-3.5 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DragonflyLogoGraphic height={20} />
                        <span className="text-[9px] font-black uppercase tracking-wider bg-slate-800 text-gray-400 px-1.5 py-0.5 rounded">
                          {card.station}
                        </span>
                      </div>
                      {/* Status Tag */}
                      <span
                        className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          card.status === 'checked_in'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : card.status === 'checked_out'
                            ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {card.status === 'checked_in'
                          ? '✓ Checked In'
                          : card.status === 'checked_out'
                          ? '🚚 Out on Road'
                          : '⏱ Pending Out'}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 space-y-4 flex-1 flex flex-col">
                      {/* Route & QR Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Route ID</div>
                          <div className="text-2xl font-black text-white tracking-tight text-dragonfly-turquoise">
                            {card.route}
                          </div>
                          <div className="text-xs font-semibold text-gray-300 mt-0.5 flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-dragonfly-lightblue"></span>
                            {card.idc}
                          </div>
                        </div>

                        {/* High-res QR code thumbnail */}
                        {card.qrDataUrl && (
                          <div className="bg-white p-1 rounded-lg border border-slate-700 shrink-0 shadow-inner">
                            <img src={card.qrDataUrl} alt={card.route} className="w-16 h-16 object-contain" />
                          </div>
                        )}
                      </div>

                      {/* Route Key Metrics */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-xs">
                        <div>
                          <span className="text-[10px] text-gray-400 block font-medium">Packages</span>
                          <strong className="text-white text-sm">{card.packageCount} pkgs</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block font-medium">Sequence</span>
                          <strong className="text-gray-200 text-xs font-mono">{card.seqRange}</strong>
                        </div>
                      </div>

                      {/* Driver & Vehicle Assigned */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-gray-400">
                          <span className="flex items-center gap-1">
                            <User size={12} className="text-gray-400" />
                            Driver:
                          </span>
                          <input
                            type="text"
                            placeholder="Assign Driver..."
                            value={card.driverName}
                            onChange={e => {
                              const val = e.target.value;
                              setCards(prev =>
                                prev.map(c => (c.id === card.id ? { ...c, driverName: val } : c))
                              );
                            }}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-right text-xs text-white placeholder-gray-600 focus:outline-none focus:border-dragonfly-turquoise w-32"
                          />
                        </div>

                        {card.businessStopsCount > 0 && (
                          <div className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded flex items-center gap-1">
                            <AlertTriangle size={11} />
                            {card.businessStopsCount} Business Stop{card.businessStopsCount > 1 ? 's' : ''} (Check Hours)
                          </div>
                        )}
                      </div>

                      {/* Check-Out / Check-In Log Details */}
                      <div className="text-[11px] bg-slate-950/40 p-2 rounded border border-slate-800/60 space-y-1 text-gray-400 mt-auto">
                        <div className="flex justify-between">
                          <span>Check-Out:</span>
                          <strong className="text-gray-200">{card.checkOutTime || '—'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Check-In Return:</span>
                          <strong className="text-gray-200">{card.checkInTime || '—'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="bg-slate-950 p-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                      {card.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => handleCheckOut(card.id)}
                          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1"
                        >
                          <Truck size={12} />
                          Check Out
                        </button>
                      ) : card.status === 'checked_out' ? (
                        <button
                          type="button"
                          onClick={() => handleCheckIn(card.id)}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 size={12} />
                          Check In Return
                        </button>
                      ) : (
                        <span className="flex-1 py-1.5 bg-emerald-500/10 text-emerald-400 font-bold text-[11px] uppercase tracking-wider rounded text-center border border-emerald-500/20">
                          Completed
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteCard(card.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 rounded transition-colors"
                        title="Delete Card"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= VIEW 2: TABLE / DISPATCH SHEET ================= */}
        {activeTab === 'table' && (
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-gray-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Route ID</th>
                      <th className="py-3 px-4">Station</th>
                      <th className="py-3 px-4">IDC Location</th>
                      <th className="py-3 px-4">Packages</th>
                      <th className="py-3 px-4">Sequence</th>
                      <th className="py-3 px-4">Assigned Driver</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Check-Out Time</th>
                      <th className="py-3 px-4">Return Time</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredCards.map(c => (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-black text-white text-sm text-dragonfly-turquoise">
                          {c.route}
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-300">{c.station}</td>
                        <td className="py-3 px-4 text-gray-300">{c.idc}</td>
                        <td className="py-3 px-4 font-bold text-white">{c.packageCount}</td>
                        <td className="py-3 px-4 font-mono text-gray-300">{c.seqRange}</td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            placeholder="Assign Driver..."
                            value={c.driverName}
                            onChange={e => {
                              const val = e.target.value;
                              setCards(prev =>
                                prev.map(item => (item.id === c.id ? { ...item, driverName: val } : item))
                              );
                            }}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-dragonfly-turquoise w-36"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              c.status === 'checked_in'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : c.status === 'checked_out'
                                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-300">{c.checkOutTime || '—'}</td>
                        <td className="py-3 px-4 font-medium text-gray-300">{c.checkInTime || '—'}</td>
                        <td className="py-3 px-4 text-right">
                          {c.status === 'pending' ? (
                            <button
                              type="button"
                              onClick={() => handleCheckOut(c.id)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold"
                            >
                              Check Out
                            </button>
                          ) : c.status === 'checked_out' ? (
                            <button
                              type="button"
                              onClick={() => handleCheckIn(c.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold"
                            >
                              Check In
                            </button>
                          ) : (
                            <span className="text-emerald-400 text-xs font-bold">Done</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW 3: LIVE SCAN TERMINAL ================= */}
        {activeTab === 'scanner' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-dragonfly-lightblue/10 border border-dragonfly-lightblue/30 rounded-2xl flex items-center justify-center text-dragonfly-lightblue mx-auto">
                  <Scan size={30} />
                </div>
                <h2 className="text-xl font-bold text-white">Live Station QR / Barcode Scan Terminal</h2>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Scan driver check-in / check-out cards using a handheld 2D barcode scanner or type route number directly to log timestamps.
                </p>
              </div>

              {/* Terminal Form */}
              <form onSubmit={handleScanSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    placeholder={`Scan QR or type route (e.g., ${stationPrefix}101)...`}
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    className="w-full pl-4 pr-24 py-3.5 bg-slate-950 border-2 border-slate-700 rounded-xl text-base font-mono text-white placeholder-gray-600 focus:outline-none focus:border-dragonfly-lightblue shadow-inner"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-dragonfly-lightblue text-slate-950 font-black text-xs uppercase tracking-wider rounded-lg hover:bg-[#34b6e4] transition-colors"
                  >
                    Enter Scan
                  </button>
                </div>
              </form>

              {/* Notification Message */}
              {scanMessage && (
                <div
                  className={`p-4 rounded-xl border text-xs font-bold leading-relaxed transition-all ${
                    scanMessage.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : scanMessage.type === 'error'
                      ? 'bg-red-500/15 border-red-500/30 text-red-300'
                      : 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                  }`}
                >
                  {scanMessage.text}
                </div>
              )}

              {/* Live Summary Counter */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800 text-center">
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Pending Out</span>
                  <span className="text-xl font-black text-amber-400">
                    {cards.filter(c => c.status === 'pending').length}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Out on Road</span>
                  <span className="text-xl font-black text-blue-400">
                    {cards.filter(c => c.status === 'checked_out').length}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Returned / Done</span>
                  <span className="text-xl font-black text-emerald-400">
                    {cards.filter(c => c.status === 'checked_in').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW 4: PRINT PREVIEW SHEET ================= */}
        {activeTab === 'print' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Print Header Controls (Hidden during native print) */}
            <div className="print:hidden bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white">Print Layout Ready</h3>
                <p className="text-xs text-gray-400">
                  Optimized for standard letter paper (8.5" x 11"). Select layout and click Print.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-5 py-2 bg-dragonfly-lightblue hover:bg-[#34b6e4] text-slate-950 font-black text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-lg shadow-dragonfly-lightblue/20"
                >
                  <Printer size={16} />
                  Print Now
                </button>
              </div>
            </div>

            {/* Printable Area - Standard Letter Styling */}
            <div id="printable-cards-area" className="space-y-8 bg-white text-slate-950 p-6 md:p-8 rounded-xl shadow-2xl">
              <div
                className={`grid gap-6 ${
                  printLayout === '1up'
                    ? 'grid-cols-1'
                    : printLayout === '2up'
                    ? 'grid-cols-1 md:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-2'
                }`}
              >
                {filteredCards.map(card => (
                  <div
                    key={card.id}
                    className="border-2 border-dashed border-gray-400 rounded-xl p-5 bg-white flex flex-col justify-between space-y-4 page-break-inside-avoid relative shadow-sm"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between border-b-2 border-gray-900 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <img src="/Dragonfly%20logo.svg" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Dragonfly%20logo.png'; }} alt="Dragonfly" className="h-6 w-auto object-contain" />
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-gray-200 text-gray-800 rounded">
                            {card.station} DISPATCH
                          </span>
                        </div>
                        <div className="text-xs font-bold text-gray-600 mt-1">
                          Date: {card.date} • Shift: {card.shift}
                        </div>
                      </div>

                      {/* Scannable QR Code */}
                      {card.qrDataUrl && (
                        <div className="border border-gray-300 p-1 rounded bg-white shrink-0">
                          <img src={card.qrDataUrl} alt={card.route} className="w-16 h-16 object-contain" />
                        </div>
                      )}
                    </div>

                    {/* Route ID & Package Details */}
                    <div className="grid grid-cols-3 gap-2 bg-gray-100 p-2.5 rounded-lg border border-gray-300">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-500 block">Route #</span>
                        <strong className="text-2xl font-black text-gray-950 leading-none">{card.route}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-500 block">Packages</span>
                        <strong className="text-lg font-bold text-gray-900">{card.packageCount}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-500 block">Sequence</span>
                        <strong className="text-xs font-mono font-bold text-gray-800">{card.seqRange}</strong>
                      </div>
                    </div>

                    {/* Depot and Business Warnings */}
                    <div className="text-xs font-bold text-gray-700 flex items-center justify-between">
                      <span>Depot: <strong>{card.idc}</strong></span>
                      {card.businessStopsCount > 0 && (
                        <span className="text-red-700 font-extrabold text-[11px] bg-red-100 px-2 py-0.5 rounded border border-red-200">
                          ⚠ {card.businessStopsCount} Business Stop(s)
                        </span>
                      )}
                    </div>

                    {/* Driver & Van Assignment Line */}
                    <div className="grid grid-cols-2 gap-3 text-xs border-t border-gray-200 pt-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-500 block">Driver Name:</span>
                        <div className="border-b border-gray-400 pb-1 font-bold text-gray-900 min-h-[20px]">
                          {card.driverName || '____________________'}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-500 block">Van / Vehicle #:</span>
                        <div className="border-b border-gray-400 pb-1 font-bold text-gray-900 min-h-[20px]">
                          {card.vehicleNumber || '____________________'}
                        </div>
                      </div>
                    </div>

                    {/* Sign-off Boxes: Check Out & Check In */}
                    <div className="grid grid-cols-2 gap-3 bg-gray-50 p-2.5 rounded-lg border border-gray-300 text-[10px]">
                      <div className="space-y-1">
                        <strong className="text-gray-900 uppercase block font-black">1. Check-Out Verification</strong>
                        <div>Time Out: ___________</div>
                        <div>Odometer Out: _________</div>
                        <div className="pt-2">Driver Sig: ________________</div>
                      </div>

                      <div className="space-y-1 border-l border-gray-300 pl-3">
                        <strong className="text-gray-900 uppercase block font-black">2. Return Check-In</strong>
                        <div>Time In: ___________</div>
                        <div>Odometer In: _________</div>
                        <div>Delivered: ____ Returns: ____</div>
                        <div className="pt-1">Dispatcher Sig: ___________</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Manual Route Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus size={18} className="text-dragonfly-turquoise" />
                Add Dispatch Route Card
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddManualCard} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                  Route Number ({stationPrefix} Prefix)
                </label>
                <input
                  type="text"
                  required
                  placeholder={`e.g. ${stationPrefix}105`}
                  value={newRouteInput}
                  onChange={e => setNewRouteInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-dragonfly-turquoise"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">IDC Depot</label>
                  <input
                    type="text"
                    value={newIdcInput}
                    onChange={e => setNewIdcInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-dragonfly-turquoise"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Package Count</label>
                  <input
                    type="number"
                    value={newPkgInput}
                    onChange={e => setNewPkgInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-dragonfly-turquoise"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Sequence Range</label>
                <input
                  type="text"
                  value={newSeqInput}
                  onChange={e => setNewSeqInput(e.target.value)}
                  placeholder="e.g. 1 - 120"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-dragonfly-turquoise"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Driver Name (Optional)</label>
                <input
                  type="text"
                  value={newDriverInput}
                  onChange={e => setNewDriverInput(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-dragonfly-turquoise"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-gray-300 font-bold text-xs uppercase rounded-lg hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-dragonfly-turquoise text-white font-bold text-xs uppercase rounded-lg hover:bg-[#008f7a]"
                >
                  Generate Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckInOutCardCreator;
