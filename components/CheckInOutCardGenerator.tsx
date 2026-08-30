import React, { useState, useRef, useMemo } from 'react';
import {
  StationCode,
  ParsedManifestRoute,
  CardGeneratorSettings,
  OperatorProfile,
  DESIGNATION_OPTIONS
} from '../types';
import {
  DEFAULT_CARD_SETTINGS,
  parseManifestPdfForRoutes,
  generateCheckInOutCardsPdf
} from '../services/cardGeneratorPdfService';
import { DragonflyLogoGraphic } from './DragonflyLogo';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Printer,
  Download,
  SlidersHorizontal,
  RefreshCw,
  Plus,
  Trash2,
  ArrowRight,
  Clock,
  MapPin,
  FileSpreadsheet,
  QrCode,
  Check,
  X,
  Search,
  Filter,
  Layers,
  ChevronRight,
  ExternalLink,
  User,
  Calendar,
  ShieldCheck,
  FileCheck
} from 'lucide-react';

interface CheckInOutCardGeneratorProps {
  currentStation: StationCode;
  onSelectStation: (station: StationCode) => void;
  operatorProfile: OperatorProfile;
  onUpdateOperator: (profile: OperatorProfile) => void;
  currentDate: string;
  onSelectDate: (date: string) => void;
  onBackToHub: () => void;
}

export const CheckInOutCardGenerator: React.FC<CheckInOutCardGeneratorProps> = ({
  currentStation,
  onSelectStation,
  operatorProfile,
  onUpdateOperator,
  currentDate,
  onSelectDate,
  onBackToHub
}) => {
  // File states
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateArrayBuffer, setTemplateArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [useBuiltInTemplate, setUseBuiltInTemplate] = useState<boolean>(true);
  const [showCustomTemplateUpload, setShowCustomTemplateUpload] = useState<boolean>(false);

  // Analysis & Route review states
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisStatusText, setAnalysisStatusText] = useState<string>('');
  const [parsedRoutes, setParsedRoutes] = useState<ParsedManifestRoute[]>([]);
  const [activeFilter, setActiveFilter] = useState<'qr_only' | 'all' | 'flagged' | 'no_qr'>('qr_only');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Generation states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationStatusText, setGenerationStatusText] = useState<string>('');
  const [generatedPdfBlob, setGeneratedPdfBlob] = useState<Blob | null>(null);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [generationStats, setGenerationStats] = useState<{ totalCards: number; totalPages: number } | null>(null);

  // Settings state
  const [settings, setSettings] = useState<CardGeneratorSettings>(DEFAULT_CARD_SETTINGS);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'coordinates'>('general');

  // New Route Modal
  const [showAddRouteModal, setShowAddRouteModal] = useState<boolean>(false);
  const [newRouteCode, setNewRouteCode] = useState<string>('');
  const [newRouteWave, setNewRouteWave] = useState<string>('Wave 1');
  const [newRouteIdc, setNewRouteIdc] = useState<string>(`${currentStation} Central Depot`);
  const [newRoutePkgs, setNewRoutePkgs] = useState<number>(95);
  const [newRouteHasQr, setNewRouteHasQr] = useState<boolean>(true);

  const templateInputRef = useRef<HTMLInputElement>(null);
  const manifestInputRef = useRef<HTMLInputElement>(null);

  // Handle Template File Upload
  const handleTemplateUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a valid PDF template file.');
      return;
    }
    setTemplateFile(file);
    const buffer = await file.arrayBuffer();
    setTemplateArrayBuffer(buffer);
    setUseBuiltInTemplate(false);
    setSettings(prev => ({ ...prev, useCustomTemplate: true }));
  };

  // Handle Manifest File Upload
  const handleManifestUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a valid PDF manifest file.');
      return;
    }
    setManifestFile(file);
    setGeneratedPdfBlob(null);
    setGeneratedPdfUrl(null);
  };

  // Analyze Manifest Action
  const handleAnalyzeManifest = async () => {
    if (!manifestFile) {
      alert('Please upload a Route Manifest PDF first.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(5);
    setAnalysisStatusText('Initializing manifest parser and QR code scanner...');

    try {
      const parseResult = await parseManifestPdfForRoutes(
        manifestFile,
        currentStation,
        (progress, text) => {
          setAnalysisProgress(progress);
          setAnalysisStatusText(text);
        }
      );

      const routes = parseResult.routes;
      if (parseResult.manifestDate) {
        onSelectDate(parseResult.manifestDate);
      }
      setParsedRoutes(routes);

      // Default active filter to qr_only if QR codes were detected
      const qrCount = routes.filter(r => r.hasQr).length;
      if (qrCount > 0) {
        setActiveFilter('qr_only');
      } else {
        setActiveFilter('all');
      }
    } catch (err: any) {
      console.error('Manifest analysis error:', err);
      alert(`Failed to parse manifest PDF: ${err.message || 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Load Built-In Sample Manifest for quick testing
  const handleLoadSampleManifest = () => {
    const prefix = currentStation === 'KTCH' ? 'KTCH' : 'LNDN';
    const samples: ParsedManifestRoute[] = [
      {
        id: 'sample-1',
        routeCode: `${prefix}101`,
        station: currentStation,
        rawHeading: `ROUTE ${prefix}101 - WAVE 1 (MORNING DISPATCH)`,
        packageCount: 114,
        stopCount: 82,
        seqRange: '1 - 114',
        idcName: `${currentStation} West Hub`,
        waveNumber: 'Wave 1',
        waveTime: '07:30 AM',
        driverNumber: 'DRV-108',
        notes: 'Priority residential & commercial sequence',
        isFlagged: false,
        selected: true,
        hasQr: true,
        qrConfidence: 'confirmed',
        qrPayloadPreview: `${prefix}101|${currentDate}|W1|114PKGS`,
        pageNumber: 1,
        confidence: 'high'
      },
      {
        id: 'sample-2',
        routeCode: `${prefix}102`,
        station: currentStation,
        rawHeading: `ROUTE ${prefix}102 - WAVE 1`,
        packageCount: 98,
        stopCount: 71,
        seqRange: '1 - 98',
        idcName: `${currentStation} West Hub`,
        waveNumber: 'Wave 1',
        waveTime: '07:30 AM',
        driverNumber: 'DRV-204',
        notes: 'Downtown route with 4 business stops',
        isFlagged: false,
        selected: true,
        hasQr: true,
        qrConfidence: 'confirmed',
        qrPayloadPreview: `${prefix}102|${currentDate}|W1|98PKGS`,
        pageNumber: 1,
        confidence: 'high'
      },
      {
        id: 'sample-3',
        routeCode: `${prefix}103`,
        station: currentStation,
        rawHeading: `ROUTE ${prefix}103 - WAVE 2`,
        packageCount: 132,
        stopCount: 95,
        seqRange: '1 - 132',
        idcName: `${currentStation} North Depot`,
        waveNumber: 'Wave 2',
        waveTime: '08:15 AM',
        driverNumber: 'DRV-319',
        notes: 'Rural delivery area',
        isFlagged: false,
        selected: true,
        hasQr: true,
        qrConfidence: 'confirmed',
        qrPayloadPreview: `${prefix}103|${currentDate}|W2|132PKGS`,
        pageNumber: 2,
        confidence: 'high'
      },
      {
        id: 'sample-4',
        routeCode: `${prefix}104`,
        station: currentStation,
        rawHeading: `ROUTE ${prefix}104 - WAVE 2`,
        packageCount: 88,
        stopCount: 64,
        seqRange: '1 - 88',
        idcName: `${currentStation} North Depot`,
        waveNumber: 'Wave 2',
        waveTime: '08:15 AM',
        driverNumber: 'DRV-402',
        notes: 'Industrial park deliveries',
        isFlagged: false,
        selected: true,
        hasQr: true,
        qrConfidence: 'confirmed',
        qrPayloadPreview: `${prefix}104|${currentDate}|W2|88PKGS`,
        pageNumber: 2,
        confidence: 'high'
      },
      {
        id: 'sample-5',
        routeCode: `${prefix}1200`,
        station: currentStation,
        rawHeading: `ROUTE ${prefix}1200 - WAVE 3 (SWEEP ROUTE)`,
        packageCount: 42,
        stopCount: 30,
        seqRange: '1 - 42',
        idcName: `${currentStation} Central`,
        waveNumber: 'Wave 3',
        waveTime: '09:00 AM',
        driverNumber: 'DRV-512',
        notes: 'Afternoon overflow sweep',
        isFlagged: false,
        selected: true,
        hasQr: true,
        qrConfidence: 'confirmed',
        qrPayloadPreview: `${prefix}1200|${currentDate}|W3|42PKGS`,
        pageNumber: 3,
        confidence: 'high'
      },
      {
        id: 'sample-6',
        routeCode: `${prefix}199`,
        station: currentStation,
        rawHeading: `ROUTE ${prefix}199 - UNASSIGNED (NO BARCODE)`,
        packageCount: 15,
        stopCount: 12,
        seqRange: '1 - 15',
        idcName: `${currentStation} Central`,
        waveNumber: 'Wave 3',
        waveTime: '09:00 AM',
        driverNumber: '',
        notes: 'Special handoff route',
        isFlagged: true,
        flagReason: 'No QR barcode found in manifest for this section',
        selected: false,
        hasQr: false,
        qrConfidence: 'none',
        pageNumber: 3,
        confidence: 'medium'
      }
    ];

    setParsedRoutes(samples);
    setActiveFilter('qr_only');
  };

  // Generate Check-In / Out Cards Action
  const handleGenerateCards = async () => {
    const selected = parsedRoutes.filter(r => r.selected);
    if (selected.length === 0) {
      alert('Please select at least one route from the review list.');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(5);
    setGenerationStatusText('Preparing 2-Up card layouts with operator signatures...');

    try {
      const pdfBytes = await generateCheckInOutCardsPdf({
        routes: parsedRoutes,
        templateArrayBuffer: useBuiltInTemplate ? null : templateArrayBuffer,
        station: currentStation,
        dateStr: currentDate,
        operatorName: operatorProfile.name,
        operatorDesignation: operatorProfile.designation,
        settings: {
          ...settings,
          useCustomTemplate: !useBuiltInTemplate,
          defaultApprovedBy: operatorProfile.name || settings.defaultApprovedBy
        },
        onProgress: (progress, text) => {
          setGenerationProgress(progress);
          setGenerationStatusText(text);
        }
      });

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setGeneratedPdfBlob(blob);
      setGeneratedPdfUrl(url);
      setGenerationStats({
        totalCards: selected.length,
        totalPages: Math.ceil(selected.length / 2)
      });
    } catch (err: any) {
      console.error('PDF generation error:', err);
      alert(`Error generating cards PDF: ${err.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = () => {
    if (!generatedPdfBlob) return;
    const filename = `Dragonfly_${currentStation}_CheckInOut_Cards_2Up_${currentDate}.pdf`;
    saveAs(generatedPdfBlob, filename);
  };

  // Export Parsed Routes to Excel
  const handleExportRoutesExcel = () => {
    if (parsedRoutes.length === 0) return;
    const rows = parsedRoutes.map((r, idx) => ({
      '#': idx + 1,
      'Station': r.station,
      'Route Code': r.routeCode,
      'Has QR': r.hasQr ? 'YES' : 'NO',
      'QR Confidence': r.qrConfidence ? `${Math.round(r.qrConfidence * 100)}%` : 'N/A',
      'Wave #': r.waveNumber || 'Wave 1',
      'Wave Time': r.waveTime || '07:30 AM',
      'IDC / Depot': r.idcName || '',
      'Packages': r.packageCount || 0,
      'Stops': r.stopCount || 0,
      'Sequence Range': r.seqRange || '',
      'Driver Assigned': r.driverNumber || 'Unassigned',
      'Approved By / Operator': `${operatorProfile.name} (${operatorProfile.designation})`,
      'Notes': r.notes || '',
      'Flagged': r.isFlagged ? `Yes (${r.flagReason})` : 'No',
      'Selected for Print': r.selected ? 'YES' : 'NO'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parsed Routes');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Dragonfly_${currentStation}_Parsed_Routes_${currentDate}.xlsx`);
  };

  // Toggle Route Selection
  const toggleRouteSelect = (id: string) => {
    setParsedRoutes(prev =>
      prev.map(r => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  // Select QR Only
  const selectOnlyQrRoutes = () => {
    setParsedRoutes(prev =>
      prev.map(r => ({ ...r, selected: !!r.hasQr }))
    );
  };

  // Toggle All Selection
  const toggleSelectAll = (select: boolean) => {
    setParsedRoutes(prev => prev.map(r => ({ ...r, selected: select })));
  };

  // Update Route Field
  const updateRouteField = (id: string, field: keyof ParsedManifestRoute, value: any) => {
    setParsedRoutes(prev =>
      prev.map(r => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // Delete Route
  const handleDeleteRoute = (id: string) => {
    setParsedRoutes(prev => prev.filter(r => r.id !== id));
  };

  // Add Custom Route
  const handleAddCustomRoute = () => {
    if (!newRouteCode.trim()) {
      alert('Please enter a Route Code.');
      return;
    }

    const prefix = currentStation === 'KTCH' ? 'KTCH' : 'LNDN';
    let formattedCode = newRouteCode.trim().toUpperCase();
    if (!formattedCode.startsWith(prefix)) {
      formattedCode = `${prefix}${formattedCode.replace(/[^0-9]/g, '') || formattedCode}`;
    }

    const newRoute: ParsedManifestRoute = {
      id: `custom-${Date.now()}`,
      routeCode: formattedCode,
      station: currentStation,
      rawHeading: `Custom Added Route: ${formattedCode}`,
      packageCount: newRoutePkgs,
      stopCount: Math.round(newRoutePkgs * 0.75),
      seqRange: `1 - ${newRoutePkgs}`,
      idcName: newRouteIdc,
      waveNumber: newRouteWave,
      waveTime: newRouteWave === 'Wave 1' ? '07:30 AM' : newRouteWave === 'Wave 2' ? '08:15 AM' : '09:00 AM',
      notes: 'Custom manual route entry',
      isFlagged: false,
      selected: true,
      hasQr: newRouteHasQr,
      qrConfidence: newRouteHasQr ? 'confirmed' : 'none',
      confidence: 'high'
    };

    setParsedRoutes(prev => [newRoute, ...prev]);
    setNewRouteCode('');
    setShowAddRouteModal(false);
  };

  // Filtered routes
  const filteredRoutes = useMemo(() => {
    return parsedRoutes.filter(r => {
      const matchesSearch =
        r.routeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.idcName && r.idcName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.driverNumber && r.driverNumber.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeFilter === 'qr_only') return r.hasQr;
      if (activeFilter === 'no_qr') return !r.hasQr;
      if (activeFilter === 'flagged') return r.isFlagged;
      return true;
    });
  }, [parsedRoutes, searchQuery, activeFilter]);

  const qrCount = parsedRoutes.filter(r => r.hasQr).length;
  const noQrCount = parsedRoutes.filter(r => !r.hasQr).length;
  const flaggedCount = parsedRoutes.filter(r => r.isFlagged).length;
  const selectedCount = parsedRoutes.filter(r => r.selected).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-gray-100 overflow-hidden">
      {/* Top Header Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 md:px-8 py-3 shrink-0 flex flex-wrap items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="p-1.5 rounded-lg bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Back to Operational Tools Hub"
          >
            <ChevronRight className="rotate-180" size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <Printer size={20} className="text-dragonfly-turquoise" />
                Check-In / Out Card Generator
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-dragonfly-turquoise/20 text-dragonfly-turquoise border border-dragonfly-turquoise/30 uppercase tracking-wider">
                2-Up Letter Cards
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Parse route manifest PDFs, auto-detect QR codes, and generate printable 2-up driver check-in/out cards for {currentStation === 'KTCH' ? 'Kitchener' : 'London'}.
            </p>
          </div>
        </div>

        {/* Global Controls: Station & Date */}
        <div className="flex items-center gap-2.5">
          {/* Station Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => onSelectStation('KTCH')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                currentStation === 'KTCH'
                  ? 'bg-dragonfly-turquoise text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              KTCH (Kitchener)
            </button>
            <button
              type="button"
              onClick={() => onSelectStation('LNDN')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                currentStation === 'LNDN'
                  ? 'bg-dragonfly-lightblue text-slate-950 font-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              LNDN (London)
            </button>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
            <Calendar size={13} className="text-dragonfly-turquoise" />
            <input
              type="date"
              value={currentDate}
              onChange={e => onSelectDate(e.target.value)}
              className="bg-transparent text-gray-200 font-mono text-xs focus:outline-none cursor-pointer"
            />
          </div>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-xl bg-slate-800 text-gray-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700 flex items-center gap-1.5 text-xs font-semibold"
            title="Card Generation Settings"
          >
            <Settings size={15} />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* Operator Identity & Role Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 md:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <User size={15} className="text-dragonfly-turquoise" />
            <span className="text-gray-400 font-medium">Operator Name:</span>
            <input
              type="text"
              value={operatorProfile.name}
              onChange={(e) => onUpdateOperator({ ...operatorProfile, name: e.target.value })}
              placeholder="Enter your name"
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:border-dragonfly-turquoise focus:outline-none font-semibold w-48"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium">Designation:</span>
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

        <div className="flex items-center gap-3 text-gray-400 text-[11px]">
          <span>Station: <strong className="text-white font-mono">{currentStation}</strong></span>
          <span className="w-1 h-1 rounded-full bg-slate-600"></span>
          <span>Date: <strong className="text-dragonfly-turquoise font-mono">{currentDate}</strong></span>
          <span className="w-1 h-1 rounded-full bg-slate-600"></span>
          <span>Approved By: <strong className="text-white">{operatorProfile.name}</strong></span>
        </div>
      </div>

      {/* Main Workspace Area (Split Panels) */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-0 overflow-hidden">
        {/* Left Side (4 Cols on XL): Template Selection & Manifest Analysis Console */}
        <div className="xl:col-span-4 bg-slate-900/40 border-r border-slate-800 p-4 md:p-6 overflow-y-auto space-y-5">
          {/* Step 1: Template Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                <FileCheck size={16} className="text-dragonfly-turquoise" />
                1. Check-In / Out Card Template
              </h2>
              <span className="text-[10px] font-mono text-gray-500">2-UP PER PAGE</span>
            </div>

            {/* Template Card Selection Box */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              {/* Option 1 (Default): Built-in Official Dragonfly Template */}
              <div
                onClick={() => {
                  setUseBuiltInTemplate(true);
                  setTemplateFile(null);
                  setTemplateArrayBuffer(null);
                  setShowCustomTemplateUpload(false);
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  useBuiltInTemplate
                    ? 'bg-dragonfly-turquoise/15 border-dragonfly-turquoise text-white ring-1 ring-dragonfly-turquoise/30'
                    : 'bg-slate-900/50 border-slate-800 text-gray-400 hover:border-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                  useBuiltInTemplate ? 'border-dragonfly-turquoise bg-dragonfly-turquoise text-white' : 'border-slate-700'
                }`}>
                  {useBuiltInTemplate && <Check size={12} />}
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      Dragonfly Official Card Template
                    </span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-dragonfly-turquoise/20 text-dragonfly-turquoise">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Official Dragonfly 2-up printable letter format with Station, Route, Wave, Time, tracking table, and signature sign-offs.
                  </p>
                </div>
              </div>

              {/* Option 2: Custom PDF Template Upload */}
              <div
                onClick={() => {
                  setShowCustomTemplateUpload(true);
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all space-y-3 ${
                  !useBuiltInTemplate || showCustomTemplateUpload
                    ? 'bg-slate-900 border-slate-700'
                    : 'bg-slate-900/30 border-slate-800/80 text-gray-500 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <Upload size={14} /> Upload Custom 2-Up PDF Template (Secondary)
                  </span>
                  {templateFile && (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check size={10} /> Loaded
                    </span>
                  )}
                </div>

                {showCustomTemplateUpload && (
                  <div className="space-y-2 pt-1 animate-fadeIn">
                    <input
                      ref={templateInputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && handleTemplateUpload(e.target.files[0])}
                    />

                    <div
                      onClick={() => templateInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        if (e.dataTransfer.files?.[0]) handleTemplateUpload(e.dataTransfer.files[0]);
                      }}
                      className="border-2 border-dashed border-slate-700 rounded-lg p-3 text-center cursor-pointer hover:border-slate-600 bg-slate-950/60 transition-all"
                    >
                      {templateFile ? (
                        <div className="flex items-center justify-between text-left">
                          <div className="flex items-center gap-2 truncate">
                            <FileText size={16} className="text-dragonfly-turquoise shrink-0" />
                            <div className="truncate">
                              <p className="text-xs font-bold text-white truncate">{templateFile.name}</p>
                              <p className="text-[10px] text-gray-400">{(templateFile.size / 1024).toFixed(1)} KB • Custom Template</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setTemplateFile(null);
                              setTemplateArrayBuffer(null);
                              setUseBuiltInTemplate(true);
                            }}
                            className="p-1 hover:bg-slate-800 rounded text-gray-400 hover:text-red-400"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">Click to choose a custom template PDF file</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Route Manifest PDF Upload */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                  <QrCode size={16} className="text-dragonfly-lightblue" />
                  2. Route Manifest PDF (With QR Codes)
                </h2>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <input
                  ref={manifestInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleManifestUpload(e.target.files[0])}
                />

                <div
                  onClick={() => manifestInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) handleManifestUpload(e.dataTransfer.files[0]);
                  }}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                    manifestFile
                      ? 'border-dragonfly-lightblue/40 bg-dragonfly-lightblue/5'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/50'
                  }`}
                >
                  {manifestFile ? (
                    <div className="flex items-center justify-between text-left">
                      <div className="flex items-center gap-2 truncate">
                        <FileText size={18} className="text-dragonfly-lightblue shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-bold text-white truncate">{manifestFile.name}</p>
                          <p className="text-[10px] text-gray-400">{(manifestFile.size / 1024).toFixed(1)} KB • Manifest PDF Ready</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setManifestFile(null);
                        }}
                        className="p-1 hover:bg-slate-800 rounded text-gray-400 hover:text-red-400"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <QrCode size={24} className="mx-auto text-dragonfly-lightblue/70 mb-1" />
                      <p className="text-xs font-semibold text-gray-200">Upload Station Route Manifest PDF</p>
                      <p className="text-[10px] text-gray-400">Detects {currentStation} route codes and QR barcodes automatically</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleLoadSampleManifest}
                    className="text-[11px] font-semibold text-dragonfly-lightblue hover:underline flex items-center gap-1"
                  >
                    <Sparkles size={11} /> Load sample {currentStation} manifest routes
                  </button>
                </div>
              </div>
            </div>

            {/* Analyze Button */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleAnalyzeManifest}
                disabled={isAnalyzing || !manifestFile}
                className={`w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
                  isAnalyzing || !manifestFile
                    ? 'bg-slate-800 text-gray-500 cursor-not-allowed border border-slate-700'
                    : 'bg-dragonfly-turquoise text-white hover:bg-[#008f7a] shadow-dragonfly-turquoise/20'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw size={15} className="animate-spin text-white" />
                    <span>Analyzing Manifest & QR Codes... ({analysisProgress}%)</span>
                  </>
                ) : (
                  <>
                    <Search size={15} />
                    <span>Analyze Manifest & Auto-Select QR Routes</span>
                  </>
                )}
              </button>

              {isAnalyzing && (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">{analysisStatusText}</span>
                    <span className="font-mono text-dragonfly-turquoise font-bold">{analysisProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-dragonfly-turquoise transition-all duration-200"
                      style={{ width: `${analysisProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Card Generation Action */}
            {parsedRoutes.length > 0 && (
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3 pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Printer size={15} className="text-dragonfly-lightblue" />
                    <span>3. Generate Check-In / Out Cards</span>
                  </div>
                  <span className="text-[10px] font-mono text-dragonfly-lightblue">
                    {selectedCount} Selected ({Math.ceil(selectedCount / 2)} Pages)
                  </span>
                </div>

                <p className="text-[11px] text-gray-400">
                  Outputs 2 cards per sheet, filled with route numbers, date ({currentDate}), operator signature ({operatorProfile.name}), and scannable QR codes.
                </p>

                <button
                  type="button"
                  onClick={handleGenerateCards}
                  disabled={isGenerating || selectedCount === 0}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
                    isGenerating || selectedCount === 0
                      ? 'bg-slate-800 text-gray-500 cursor-not-allowed border border-slate-700'
                      : 'bg-dragonfly-lightblue text-slate-950 font-black hover:bg-[#34b6e4] shadow-dragonfly-lightblue/20'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw size={15} className="animate-spin text-slate-950" />
                      <span>Generating Cards PDF... ({generationProgress}%)</span>
                    </>
                  ) : (
                    <>
                      <Printer size={15} />
                      <span>Generate {selectedCount} Check-In/Out Cards (PDF)</span>
                    </>
                  )}
                </button>

                {isGenerating && (
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-300">{generationStatusText}</span>
                      <span className="font-mono text-dragonfly-lightblue font-bold">{generationProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-dragonfly-lightblue transition-all duration-200"
                        style={{ width: `${generationProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* PDF Ready Download Bar */}
                {generatedPdfBlob && (
                  <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-3.5 space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs text-emerald-400 font-bold">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 size={15} />
                        PDF Ready for Printing!
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        {generationStats?.totalPages} Pages ({generationStats?.totalCards} Cards)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadPdf}
                        className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-colors"
                      >
                        <Download size={14} />
                        Download PDF (2-Up)
                      </button>
                      {generatedPdfUrl && (
                        <a
                          href={generatedPdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded-lg text-xs font-bold border border-slate-700 flex items-center gap-1"
                          title="Open PDF Preview in new tab"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side (8 Cols on XL): Route Review List & QR Selection Console */}
        <div className="xl:col-span-8 bg-slate-950 p-4 md:p-6 flex flex-col min-h-0 overflow-hidden space-y-4">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-dragonfly-turquoise" />
                  Review Manifest Routes ({parsedRoutes.length} Total Detected)
                </h2>
              </div>
              <p className="text-xs text-gray-400">
                Routes displaying a QR code in the manifest are auto-selected for driver card generation.
              </p>
            </div>

            {/* Table Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddRouteModal(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors border border-slate-700 flex items-center gap-1.5"
              >
                <Plus size={13} className="text-dragonfly-turquoise" />
                Add Custom Route
              </button>

              <button
                type="button"
                onClick={handleExportRoutesExcel}
                disabled={parsedRoutes.length === 0}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors border border-slate-700 flex items-center gap-1.5 disabled:opacity-50"
                title="Export Route Table to Excel"
              >
                <FileSpreadsheet size={13} className="text-emerald-400" />
                Export Excel
              </button>
            </div>
          </div>

          {/* Filter Tabs & Quick Select */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveFilter('qr_only')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeFilter === 'qr_only'
                    ? 'bg-dragonfly-turquoise text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <QrCode size={12} />
                With QR Code ({qrCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  activeFilter === 'all'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All Detected ({parsedRoutes.length})
              </button>

              {noQrCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('no_qr')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    activeFilter === 'no_qr'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-gray-400 hover:text-amber-300'
                  }`}
                >
                  No QR ({noQrCount})
                </button>
              )}

              {flaggedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('flagged')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                    activeFilter === 'flagged'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'text-gray-400 hover:text-red-300'
                  }`}
                >
                  <AlertTriangle size={12} className="text-red-400" />
                  Flagged ({flaggedCount})
                </button>
              )}
            </div>

            {/* Quick Actions & Search */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Filter route, IDC, driver..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-dragonfly-turquoise w-44 md:w-52"
                />
              </div>

              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={selectOnlyQrRoutes}
                  className="px-2 py-0.5 rounded bg-dragonfly-turquoise/20 text-dragonfly-turquoise font-bold hover:bg-dragonfly-turquoise/30"
                  title="Auto-select only routes with valid QR"
                >
                  Select QR Only
                </button>
                <button
                  type="button"
                  onClick={() => toggleSelectAll(true)}
                  className="text-gray-400 hover:text-white underline"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => toggleSelectAll(false)}
                  className="text-gray-400 hover:text-white underline"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/30 flex flex-col min-h-0">
            {parsedRoutes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-gray-500">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-300">No Manifest Routes Loaded Yet</h3>
                  <p className="text-xs text-gray-500 max-w-sm mt-1">
                    Upload your Route Manifest PDF on the left and click "Analyze Manifest", or click below to load sample {currentStation} routes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadSampleManifest}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-dragonfly-turquoise rounded-lg text-xs font-bold transition-colors border border-slate-700 flex items-center gap-1.5"
                >
                  <Sparkles size={13} />
                  Load Sample Manifest Routes
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-[10px] font-bold text-gray-400 uppercase tracking-wider z-10">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCount === parsedRoutes.length && parsedRoutes.length > 0}
                          onChange={e => toggleSelectAll(e.target.checked)}
                          className="rounded border-slate-700 text-dragonfly-turquoise focus:ring-0"
                        />
                      </th>
                      <th className="p-3">QR Status</th>
                      <th className="p-3">Route #</th>
                      <th className="p-3">Wave & Time</th>
                      <th className="p-3">IDC / Depot</th>
                      <th className="p-3">Packages / Stops</th>
                      <th className="p-3">Driver Assigned</th>
                      <th className="p-3">Notes</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredRoutes.map(route => (
                      <tr
                        key={route.id}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          route.isFlagged ? 'bg-amber-950/10' : ''
                        } ${!route.selected ? 'opacity-60' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={route.selected}
                            onChange={() => toggleRouteSelect(route.id)}
                            className="rounded border-slate-700 text-dragonfly-turquoise focus:ring-0"
                          />
                        </td>

                        {/* QR Code Status */}
                        <td className="p-3">
                          {route.hasQr ? (
                            <div className="flex items-center gap-1.5" title={`QR Payload: ${route.qrPayloadPreview || 'Valid'}`}>
                              <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider flex items-center gap-1">
                                <QrCode size={10} /> QR Ready
                              </span>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-slate-800 text-gray-400 border border-slate-700 uppercase tracking-wider">
                              No QR
                            </span>
                          )}
                        </td>

                        {/* Route Code (Editable) */}
                        <td className="p-3">
                          <input
                            type="text"
                            value={route.routeCode}
                            onChange={e => updateRouteField(route.id, 'routeCode', e.target.value.toUpperCase())}
                            className="bg-slate-950 border border-slate-800 focus:border-dragonfly-turquoise rounded px-2 py-1 font-mono font-bold text-dragonfly-turquoise text-xs w-28 focus:outline-none"
                          />
                        </td>

                        {/* Wave # & Time */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={route.waveNumber || 'Wave 1'}
                              onChange={e => updateRouteField(route.id, 'waveNumber', e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-gray-200 focus:outline-none focus:border-dragonfly-turquoise"
                            >
                              <option value="Wave 1">Wave 1</option>
                              <option value="Wave 2">Wave 2</option>
                              <option value="Wave 3">Wave 3</option>
                              <option value="Wave 4">Wave 4</option>
                            </select>
                            <input
                              type="text"
                              value={route.waveTime || '07:30 AM'}
                              onChange={e => updateRouteField(route.id, 'waveTime', e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-gray-300 w-20 focus:outline-none font-mono"
                            />
                          </div>
                        </td>

                        {/* IDC / Depot */}
                        <td className="p-3">
                          <input
                            type="text"
                            value={route.idcName || ''}
                            onChange={e => updateRouteField(route.id, 'idcName', e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-gray-300 w-32 focus:outline-none focus:border-dragonfly-turquoise"
                          />
                        </td>

                        {/* Package Count & Stops */}
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-gray-300 font-mono text-[11px]">
                            <span className="text-white font-bold">{route.packageCount || 0}</span>
                            <span className="text-gray-500">pkgs /</span>
                            <span className="text-gray-300">{route.stopCount || 0} stops</span>
                          </div>
                        </td>

                        {/* Driver Assigned */}
                        <td className="p-3">
                          <input
                            type="text"
                            placeholder="Assign Driver..."
                            value={route.driverNumber || ''}
                            onChange={e => updateRouteField(route.id, 'driverNumber', e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 w-32 focus:outline-none focus:border-dragonfly-lightblue"
                          />
                        </td>

                        {/* Notes */}
                        <td className="p-3">
                          <input
                            type="text"
                            placeholder="Dispatch notes..."
                            value={route.notes || ''}
                            onChange={e => updateRouteField(route.id, 'notes', e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 w-36 focus:outline-none"
                          />
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteRoute(route.id)}
                            className="p-1 hover:bg-red-950/60 rounded text-gray-500 hover:text-red-400"
                            title="Delete Route"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-dragonfly-turquoise" />
                <h3 className="text-base font-bold text-white">Check-In/Out Card Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Settings Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setSettingsTab('general')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                  settingsTab === 'general'
                    ? 'bg-dragonfly-turquoise text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                General & Defaults
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('coordinates')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                  settingsTab === 'coordinates'
                    ? 'bg-dragonfly-turquoise text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Field Layout Coordinates
              </button>
            </div>

            {/* Tab 1: General Settings */}
            {settingsTab === 'general' && (
              <div className="space-y-4 text-xs">
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-gray-300">
                    <span className="font-semibold">Show Center Cut Line (2-Up Split):</span>
                    <input
                      type="checkbox"
                      checked={settings.showCutLine}
                      onChange={e => setSettings(prev => ({ ...prev, showCutLine: e.target.checked }))}
                      className="rounded border-slate-700 text-dragonfly-turquoise focus:ring-0"
                    />
                  </label>
                  <p className="text-[11px] text-gray-500">Prints dashed cutting guidelines along the exact midpoint of letter sheets.</p>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between text-gray-300">
                    <span className="font-semibold">Include Route QR Code:</span>
                    <input
                      type="checkbox"
                      checked={settings.includeQrCode}
                      onChange={e => setSettings(prev => ({ ...prev, includeQrCode: e.target.checked }))}
                      className="rounded border-slate-700 text-dragonfly-turquoise focus:ring-0"
                    />
                  </label>
                  <p className="text-[11px] text-gray-500">Embeds scan-ready QR payload onto each driver card slip.</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-gray-400 font-semibold mb-1">Default Wave #:</label>
                    <input
                      type="text"
                      value={settings.defaultWave}
                      onChange={e => setSettings(prev => ({ ...prev, defaultWave: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 font-semibold mb-1">Default Wave Time:</label>
                    <input
                      type="text"
                      value={settings.defaultWaveTime}
                      onChange={e => setSettings(prev => ({ ...prev, defaultWaveTime: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-gray-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 font-semibold mb-1">Default IDC Name:</label>
                    <input
                      type="text"
                      value={settings.defaultIdcName}
                      onChange={e => setSettings(prev => ({ ...prev, defaultIdcName: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 font-semibold mb-1">Default Approved By:</label>
                    <input
                      type="text"
                      value={operatorProfile.name || settings.defaultApprovedBy}
                      onChange={e => onUpdateOperator({ ...operatorProfile, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-gray-200"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Coordinates */}
            {settingsTab === 'coordinates' && (
              <div className="space-y-4 text-xs max-h-80 overflow-y-auto pr-1">
                <p className="text-gray-400 text-[11px]">
                  Fine-tune field positions (X/Y points on 612 x 792 letter canvas) to align with physical forms.
                </p>

                <div className="space-y-2">
                  <h4 className="font-bold text-dragonfly-turquoise uppercase text-[11px]">Top Card Coordinates (Y: 400-780pt)</h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded border border-slate-800">
                      <span>Route # (X / Y):</span>
                      <span className="font-mono text-gray-300">{settings.topCard.route.x} / {settings.topCard.route.y}</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded border border-slate-800">
                      <span>Station (X / Y):</span>
                      <span className="font-mono text-gray-300">{settings.topCard.station.x} / {settings.topCard.station.y}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-dragonfly-lightblue uppercase text-[11px]">Bottom Card Coordinates (Y: 20-390pt)</h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded border border-slate-800">
                      <span>Route # (X / Y):</span>
                      <span className="font-mono text-gray-300">{settings.bottomCard.route.x} / {settings.bottomCard.route.y}</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded border border-slate-800">
                      <span>Station (X / Y):</span>
                      <span className="font-mono text-gray-300">{settings.bottomCard.station.x} / {settings.bottomCard.station.y}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSettings(DEFAULT_CARD_SETTINGS)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded font-semibold text-xs transition-colors"
                >
                  Reset to Default Coordinates
                </button>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-dragonfly-turquoise text-white rounded-lg font-bold text-xs"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Route Modal */}
      {showAddRouteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus size={16} className="text-dragonfly-turquoise" />
                Add Custom Route
              </h3>
              <button
                type="button"
                onClick={() => setShowAddRouteModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 font-semibold mb-1">Route Code (e.g. {currentStation}199):</label>
                <input
                  type="text"
                  placeholder={`${currentStation}199`}
                  value={newRouteCode}
                  onChange={e => setNewRouteCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono uppercase focus:border-dragonfly-turquoise focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Wave #:</label>
                  <select
                    value={newRouteWave}
                    onChange={e => setNewRouteWave(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="Wave 1">Wave 1 (07:30)</option>
                    <option value="Wave 2">Wave 2 (08:15)</option>
                    <option value="Wave 3">Wave 3 (09:00)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Package Total:</label>
                  <input
                    type="number"
                    value={newRoutePkgs}
                    onChange={e => setNewRoutePkgs(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">IDC / Depot Location:</label>
                <input
                  type="text"
                  value={newRouteIdc}
                  onChange={e => setNewRouteIdc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newRouteHasQr}
                    onChange={e => setNewRouteHasQr(e.target.checked)}
                    className="rounded border-slate-700 text-dragonfly-turquoise focus:ring-0"
                  />
                  <span>Mark with Valid QR Barcode</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddRouteModal(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomRoute}
                className="px-4 py-1.5 bg-dragonfly-turquoise text-white rounded-lg font-bold text-xs"
              >
                Add to List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckInOutCardGenerator;
