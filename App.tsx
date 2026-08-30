
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileSpreadsheet, FileText, Play, Download, RefreshCw, Layers, Package, FileArchive, Zap, Truck, Globe, Clock, MapPin, Database, MessageSquare, Briefcase, ExternalLink, AlertTriangle, Sparkles, Search, HardHat, Construction, Hammer, Pickaxe, QrCode, Square, Archive, User } from 'lucide-react';
import DragonflySignature, { DragonflyLogoGraphic } from './components/DragonflyLogo';
import FileUploader from './components/FileUploader';
import LogConsole from './components/LogConsole';
import FeedbackView from './components/FeedbackView';
import { processManifests, generateSummaryExcel, generateMasterZip } from './services/manifestService';
import { logSessionToGithub } from './services/loggingService';
import { LogEntry, ProcessingStatus, ProcessingResult, IdcBundle } from './types';
import saveAs from 'file-saver';

const SUPPLY_CHAIN_FACTS = [
  "The 'Last Mile' accounts for up to 53% of total shipping costs.",
  "UPS trucks save 10 million gallons of fuel annually by avoiding left turns.",
  "Over 100 billion parcels are shipped globally every year.",
  "AI route optimization can reduce delivery times by 30%.",
  "The first drone delivery was made by Amazon in 2016 in Cambridge, UK.",
  "90% of consumers actively track their delivery status online.",
  "The same-day delivery market is projected to hit $26.4B by 2027.",
  "Logistics creates 8-10% of global CO2 emissions, driving green innovation.",
  "Automated sorting hubs can process over 50,000 packages per hour.",
  "FedEx delivers roughly 15 million packages per business day.",
  "The longest freight train ever recorded was 7.35 km long in Australia.",
  "Barcodes were first scanned on a pack of Wrigley’s gum in 1974.",
  "Cold chain logistics ensures vaccines stay at specific temperatures during transport.",
  "90% of the world's goods are transported by sea.",
  "Autonomous delivery robots are currently legal in over 20 U.S. states.",
  "Standard shipping containers can hold about 25,000 tin cans or 8,000 shoe boxes.",
  "Amazon ships approximately 1.6 million packages a day.",
  "The concept of 'Just-In-Time' delivery was pioneered by Toyota.",
  "More than 70% of freight in the US is moved by trucks.",
  "Air freight is the most expensive shipping mode but the fastest.",
  "Reverse logistics (returns) cost US companies over $100 billion annually.",
  "In 1913, the US Postal Service allowed shipping children by mail (briefly).",
  "The largest container ships can carry over 24,000 TEUs (containers).",
  "Blockchain technology is revolutionizing supply chain transparency.",
  "3D printing could reduce global shipping volume by up to 40% in the future.",
  "The 'Silk Road' was one of the first major global trade route networks.",
  "Pizza Hut delivered a pizza to the International Space Station in 2001."
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'feedback'>('dashboard');
  const [userName, setUserName] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [bizFile, setBizFile] = useState<File | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ProcessingResult | null>(null);
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Ref to track if processing should stop
  const shouldStopRef = useRef(false);

  // Load User Name from LocalStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('dragonfly_user');
    if (savedUser) {
        setUserName(savedUser);
    }
  }, []);

  // Update LocalStorage when User Name changes
  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setUserName(newVal);
    localStorage.setItem('dragonfly_user', newVal);
  };

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }]);
  }, []);

  // Cycle through facts while processing
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (status === ProcessingStatus.READING_FILES || status === ProcessingStatus.SCANNING_PDF || status === ProcessingStatus.GENERATING_FILES || status === ProcessingStatus.ANALYZING_BUSINESSES) {
      interval = setInterval(() => {
        setCurrentFactIndex((prev) => (prev + 1) % SUPPLY_CHAIN_FACTS.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleStop = () => {
    shouldStopRef.current = true;
    addLog("Stopping process... please wait.", "warning");
    // We don't change status immediately here; we wait for the loop to throw the error
  };

  const handleProcess = async () => {
    if (!pdfFile || !excelFile || !bizFile) return;

    if (!userName.trim()) {
        addLog("Error: User Name/Email is required to proceed.", "error");
        const inputEl = document.getElementById('userName');
        if (inputEl) {
            inputEl.focus();
            inputEl.classList.add('animate-pulse');
            setTimeout(() => inputEl.classList.remove('animate-pulse'), 500);
        }
        return;
    }

    shouldStopRef.current = false;
    setStatus(ProcessingStatus.READING_FILES);
    setLogs([]); // Clear previous logs
    setProgress(0);
    setResults(null);
    setErrorMessage(null);
    addLog(`Process started by user: ${userName}`, "info");

    // Trigger GitHub Logging
    logSessionToGithub(userName, pdfFile.name, excelFile.name, qrFile?.name)
        .then(result => {
            if (result.success) {
                addLog("Session successfully logged to GitHub.", "success");
            } else {
                addLog(`Session logging skipped: ${result.message}`, "warning");
            }
        });

    try {
      const result = await processManifests(
        pdfFile,
        excelFile,
        bizFile,
        qrFile,
        addLog,
        setProgress,
        shouldStopRef
      );
      
      setResults(result);
      setStatus(ProcessingStatus.COMPLETED);
      addLog("Manifest cross-matching and splitting completed successfully!", "success");
    } catch (error: any) {
      if (error.message === "Process stopped by user.") {
          setStatus(ProcessingStatus.IDLE);
          addLog("Process stopped by user.", "warning");
          setProgress(0);
      } else {
          setStatus(ProcessingStatus.ERROR);
          const msg = error.message || String(error);
          setErrorMessage(msg);
          addLog(`Process failed: ${msg}`, "error");
      }
    }
  };

  const handleReset = () => {
    setPdfFile(null);
    setExcelFile(null);
    setBizFile(null);
    setQrFile(null);
    // Keep userName for convenience between sessions
    setLogs([]);
    setStatus(ProcessingStatus.IDLE);
    setResults(null);
    setProgress(0);
    setErrorMessage(null);
  };

  const downloadIdcBundle = (bundle: IdcBundle) => {
    saveAs(bundle.blob, bundle.filename);
  };

  const downloadSummary = () => {
    if (results) saveAs(results.summaryBlob, results.summaryName);
  };

  const handleDownloadAll = async () => {
    if (results) {
        addLog("Preparing Master ZIP...", "info");
        const masterZipBlob = await generateMasterZip(results);
        const dateStr = new Date().toISOString().split('T')[0];
        const sanitizedUser = userName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 10);
        saveAs(masterZipBlob, `Dragonfly_Complete_Output_${dateStr}_${sanitizedUser}.zip`);
        addLog("Master ZIP downloaded.", "success");
    }
  };

  const isProcessing = status !== ProcessingStatus.IDLE && status !== ProcessingStatus.COMPLETED && status !== ProcessingStatus.ERROR;

  return (
    <div className="h-[100dvh] w-screen bg-slate-950 font-sans text-gray-100 flex flex-col overflow-hidden">
      
      {/* Fixed Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2.5 md:py-3 border-b border-dragonfly-turquoise/30 bg-slate-900 z-10 shadow-md">
        <div className="cursor-pointer flex items-center" onClick={() => setCurrentView('dashboard')}>
          <DragonflySignature 
            variant="turquoise" 
            showStation={true} 
            stationCode="KTCH" 
            size="md" 
          />
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          {currentView === 'dashboard' && (
            <button 
              onClick={() => setCurrentView('feedback')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs md:text-sm font-semibold text-gray-300 hover:text-dragonfly-turquoise hover:bg-slate-800 rounded-lg transition-all border border-transparent hover:border-slate-700"
            >
              <MessageSquare size={16} />
              <span className="hidden sm:inline">Feedback</span>
            </button>
          )}
          
          <span className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold border tracking-wide ${
            status === ProcessingStatus.COMPLETED ? 'bg-dragonfly-turquoise/10 text-dragonfly-turquoise border-dragonfly-turquoise/40 shadow-[0_0_10px_rgba(0,166,143,0.2)]' :
            status === ProcessingStatus.ERROR ? 'bg-dragonfly-red/10 text-dragonfly-red border-dragonfly-red/40' :
            isProcessing ? 'bg-dragonfly-lightblue/10 text-dragonfly-lightblue border-dragonfly-lightblue/40 animate-pulse' :
            'bg-slate-800 text-gray-400 border-slate-700'
          }`}>
            {status.replace('_', ' ')}
          </span>
        </div>
      </header>

      {/* Main Content Area - Fill Remaining Height */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {currentView === 'feedback' ? (
          <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
            <FeedbackView onBack={() => setCurrentView('dashboard')} />
          </div>
        ) : (
          <>
            {/* Left/Top Panel: Inputs & Results */}
            <div className={`
               flex flex-col overflow-y-auto shrink-0 transition-all duration-300 custom-scrollbar
               ${isProcessing ? 'h-3/5 md:h-full lg:w-9/12' : 'h-auto md:h-full lg:w-9/12'}
               p-6 lg:p-10 gap-6 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950
            `}>
              
              {/* Input Section */}
              {!results && !isProcessing && (
                <div className="flex flex-col h-full max-w-6xl mx-auto w-full">
                  <div className="space-y-2 mb-6">
                    <h2 className="text-2xl font-bold text-white">Upload Files</h2>
                    <p className="text-sm text-gray-400">Upload your Manifest report, Route configuration, and optionally QR codes.</p>
                  </div>

                  {status === ProcessingStatus.ERROR && errorMessage && (
                    <div className="mb-6 p-4 bg-red-500/10 border-2 border-red-500/20 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                      <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                      <div>
                        <h4 className="font-bold text-white text-sm">Processing Failed</h4>
                        <p className="text-xs text-gray-300 mt-1 leading-relaxed">{errorMessage}</p>
                        <p className="text-[10px] text-gray-500 mt-2">Check the log console on the right for full technical details.</p>
                      </div>
                    </div>
                  )}

                  {/* User Name/Email Input */}
                  <div className="mb-6">
                    <label htmlFor="userName" className="block text-xs md:text-sm font-bold text-gray-300 mb-1 md:mb-2 uppercase tracking-wide flex items-center gap-2">
                        <User size={14} className="text-dragonfly-turquoise" />
                        User Name/Email <span className="text-dragonfly-red text-[10px] ml-1 uppercase font-bold">(Required)</span>
                    </label>
                    <input 
                        type="text" 
                        id="userName" 
                        value={userName}
                        onChange={handleUserNameChange}
                        placeholder="Enter your Name or Email"
                        className="w-full md:w-1/2 px-4 py-2 bg-slate-900 border-2 border-slate-700 rounded-lg focus:border-dragonfly-turquoise focus:outline-none transition-colors text-sm font-medium text-white placeholder:text-gray-600 focus:bg-slate-800"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 flex-1">
                    <FileUploader
                      id="pdf-upload"
                      label={<span>Manifest Report (PDF) <span className="text-dragonfly-red text-[10px] ml-1 uppercase font-bold">(Required)</span></span>}
                      accept=".pdf"
                      file={pdfFile}
                      onFileSelect={setPdfFile}
                      description="Upload Manifest report"
                      icon={<FileText />}
                      compact={false}
                      className="w-full"
                    />

                    <FileUploader
                      id="excel-upload"
                      label={<span>Route Config (Excel) <span className="text-dragonfly-red text-[10px] ml-1 uppercase font-bold">(Required)</span></span>}
                      accept=".xlsx,.xls"
                      file={excelFile}
                      onFileSelect={setExcelFile}
                      description="Route mapping file"
                      icon={<FileSpreadsheet />}
                      compact={false}
                      className="w-full"
                    />

                    <FileUploader
                      id="biz-upload"
                      label={<span>Business Directory (Excel) <span className="text-dragonfly-red text-[10px] ml-1 uppercase font-bold">(Required)</span></span>}
                      accept=".xlsx,.xls"
                      file={bizFile}
                      onFileSelect={setBizFile}
                      description="Business address list"
                      icon={<Database />}
                      compact={false}
                      className="w-full"
                    />

                    <FileUploader
                      id="qr-upload"
                      label={
                        <div className="flex items-center gap-2">
                            Manifest QR (PDF)
                            <span className="text-[10px] bg-dragonfly-turquoise/20 text-dragonfly-turquoise px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-1 border border-dragonfly-turquoise/30">
                                <QrCode size={10} />
                                STABLE
                            </span>
                            <span className="text-gray-500 text-[10px] font-normal lowercase">(optional)</span>
                        </div>
                      }
                      accept=".pdf"
                      file={qrFile}
                      onFileSelect={setQrFile}
                      description="Optional QR file"
                      icon={<HardHat />}
                      compact={false}
                      className="w-full"
                      variant="construction"
                    />
                  </div>

                  <button
                    onClick={handleProcess}
                    disabled={!pdfFile || !excelFile || !bizFile}
                    className={`
                      mt-8 py-4 px-6 w-full flex items-center justify-center gap-3 font-bold text-lg tracking-wide shadow-md transition-all border rounded-lg
                      ${!pdfFile || !excelFile || !bizFile
                        ? 'bg-slate-800 text-gray-600 border-slate-700 cursor-not-allowed' 
                        : 'bg-dragonfly-turquoise text-white border-dragonfly-turquoise hover:bg-transparent hover:text-dragonfly-turquoise hover:shadow-[0_0_20px_rgba(0,166,143,0.4)] active:scale-95'
                      }
                    `}
                  >
                    <Zap size={22} fill={!pdfFile || !excelFile || !bizFile ? "none" : "currentColor"} />
                    PROCESS MANIFESTS
                  </button>
                </div>
              )}

              {/* Processing View */}
              {isProcessing && (
                 <div className="h-full w-full flex flex-col items-center justify-center space-y-8 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden p-8 shadow-2xl">
                   {/* Background Decorative Elements */}
                   <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-dragonfly-turquoise via-dragonfly-blue to-dragonfly-turquoise animate-[shimmer_2s_infinite]"></div>
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,166,143,0.05),transparent_70%)]"></div>
                   
                   <div className="flex flex-col items-center gap-6 z-10">
                     <div className="relative">
                       <div className="w-24 h-24 rounded-full bg-slate-950 border-4 border-dragonfly-turquoise/30 flex items-center justify-center shadow-[0_0_30px_rgba(0,166,143,0.2)] z-10 relative">
                         {status === ProcessingStatus.ANALYZING_BUSINESSES ? (
                            <HardHat size={40} className="text-dragonfly-orange animate-bounce" />
                         ) : (
                            <Truck size={40} className="text-dragonfly-turquoise animate-bounce" />
                         )}
                       </div>
                       <div className="absolute inset-0 rounded-full border-4 border-t-dragonfly-turquoise border-r-transparent border-b-transparent border-l-transparent animate-spin shadow-[0_0_15px_rgba(0,166,143,0.4)]"></div>
                     </div>
                     
                     <div className="flex flex-col items-center text-center max-w-md">
                        <div className="flex items-center gap-2 text-dragonfly-turquoise font-bold uppercase tracking-wider text-xs mb-2 bg-dragonfly-turquoise/10 border border-dragonfly-turquoise/20 px-3 py-1 rounded-full">
                          <Globe size={14} />
                          <span>Did you know?</span>
                        </div>
                        <p className="text-gray-100 font-medium text-lg leading-relaxed animate-in fade-in duration-500 min-h-[5rem]">
                          "{SUPPLY_CHAIN_FACTS[currentFactIndex]}"
                        </p>
                     </div>
                   </div>

                   <div className="w-full max-w-sm space-y-4">
                      <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                        <span>{status === ProcessingStatus.ANALYZING_BUSINESSES ? 'AI Business Detection (Maps Grounding)' : 'Processing Status'}</span>
                        <span>{progress}%</span>
                      </div>
                     <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden shadow-inner border border-slate-700">
                       <div 
                         className={`h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden ${status === ProcessingStatus.ANALYZING_BUSINESSES ? 'bg-dragonfly-orange shadow-[0_0_10px_rgba(248,130,35,0.5)]' : 'bg-dragonfly-turquoise shadow-[0_0_10px_rgba(0,166,143,0.5)]'}`}
                         style={{ width: `${progress}%` }}
                       >
                         {/* Striped animation pattern */}
                         <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[spin_4s_linear_infinite] opacity-50"></div>
                       </div>
                     </div>

                     <div className="flex justify-center flex-col items-center gap-3 pt-2">
                        <button 
                            onClick={handleStop}
                            className="flex items-center gap-2 text-dragonfly-red hover:text-white hover:bg-dragonfly-red border border-dragonfly-red/50 px-4 py-1.5 rounded-full text-xs font-bold transition-all uppercase tracking-wide hover:shadow-[0_0_15px_rgba(242,68,56,0.4)] active:scale-95 bg-transparent"
                        >
                            <Square size={12} fill="currentColor" />
                            Stop Processing
                        </button>
                        <span className="text-[10px] text-gray-500 font-medium">Session User: {userName}</span>
                     </div>
                   </div>
                 </div>
              )}

              {/* Results View */}
              {results && !isProcessing && (
                <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 max-w-2xl mx-auto w-full">
                  <div className="text-center pb-6 border-b border-slate-800 shrink-0">
                    <div className="w-20 h-20 bg-slate-900 border-2 border-dragonfly-turquoise text-dragonfly-turquoise rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(0,166,143,0.3)]">
                      <Package size={36} />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-1">Processing Complete</h2>
                    <p className="text-sm text-gray-400 font-medium mb-2">Your files have been successfully split and organized.</p>
                    <p className="text-xs text-dragonfly-turquoise font-bold uppercase tracking-wider bg-dragonfly-turquoise/10 border border-dragonfly-turquoise/20 inline-block px-3 py-1 rounded-full">
                        Processed by: {userName}
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-0 pr-2 my-6 custom-scrollbar space-y-8">
                    
                    {/* IDC Manifests Section */}
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 sticky top-0 bg-slate-950 py-2 z-10 flex items-center gap-2">
                        <Layers size={14} />
                        IDC Manifests
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {results.idcBundles.map((bundle) => (
                          <button
                            key={bundle.name}
                            onClick={() => downloadIdcBundle(bundle)}
                            className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 hover:border-dragonfly-turquoise hover:bg-slate-800 hover:shadow-[0_0_10px_rgba(0,166,143,0.1)] rounded-xl transition-all text-left group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 group-hover:border-dragonfly-turquoise/30 transition-colors text-gray-400 group-hover:text-dragonfly-turquoise">
                                <FileArchive size={20} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-sm text-gray-200 group-hover:text-dragonfly-turquoise truncate">{bundle.name}</span>
                                <span className="text-[10px] text-gray-500">{bundle.filename}</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-gray-400 bg-slate-950 border border-slate-800 px-2 py-1 rounded-md shrink-0 ml-2 group-hover:bg-dragonfly-turquoise group-hover:text-white group-hover:border-dragonfly-turquoise transition-all">
                              {bundle.routeCount} routes
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Business Stops Section (Results) */}
                    <div className="border-t border-slate-800 pt-6 animate-in fade-in slide-in-from-bottom-2">
                      <h3 className="text-xs font-bold text-dragonfly-turquoise uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Sparkles size={14} />
                        Business Stops Identified ({results.businessPackages.length})
                        <span className="text-[10px] bg-dragonfly-turquoise/20 text-dragonfly-turquoise border border-dragonfly-turquoise/30 px-1.5 py-0.5 rounded font-bold uppercase">Directory Grounded</span>
                      </h3>
                      {results.businessPackages.length === 0 ? (
                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-sm text-gray-500">
                          No business directory stops matched on today's routes.
                        </div>
                      ) : (
                        <div className="space-y-3">
                           {results.businessPackages.map((bp, idx) => (
                             <div key={idx} className="p-4 bg-slate-900 border border-dragonfly-turquoise/20 hover:border-dragonfly-turquoise/40 rounded-xl flex flex-col md:flex-row gap-4 hover:bg-slate-800/80 transition-all shadow-md">
                                <div className="shrink-0 flex md:flex-col items-start md:items-center justify-center gap-1.5">
                                  <div className="bg-dragonfly-blue text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-md tracking-wider border border-dragonfly-blue/80 min-w-[3.5rem] text-center max-w-[12rem] break-words">
                                    <span className="text-[10px] text-blue-200 block uppercase font-mono tracking-widest leading-none mb-0.5">Seq Range</span>
                                    {bp.seq}
                                  </div>
                                  <span className="text-[10px] text-slate-400 uppercase font-bold font-mono tracking-wider bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                    {bp.seqCount} Stop{bp.seqCount !== 1 ? 's' : ''} / Pkg{bp.seqCount !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex-1 flex flex-col gap-2 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-mono font-bold bg-slate-950 text-dragonfly-turquoise px-2.5 py-0.5 rounded border border-slate-800">
                                      {bp.route}
                                    </span>
                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                      {bp.idc}
                                    </span>
                                    {(bp.isPossibleBusiness || bp.unitNote) && (
                                      <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded ml-auto flex items-center gap-1 uppercase tracking-wider">
                                        ⚠️ Possible Business
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Consolidated Address - Instructions if Any */}
                                  <div className="space-y-1.5">
                                    <div className="text-xs text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                                      Address - Instructions if Any
                                    </div>
                                    <p className="text-sm text-gray-100 font-bold leading-relaxed">
                                      {bp.address}
                                    </p>

                                    {/* Highlighted Instruction Block */}
                                    {(bp.instr || bp.closing || bp.unitNote) && (
                                      <div className="text-xs text-amber-300 font-medium bg-amber-950/40 p-3 rounded-lg border border-amber-500/30 flex flex-col gap-1 mt-1 shadow-sm">
                                        <div className="flex items-center gap-2">
                                          <span className="font-extrabold uppercase shrink-0 text-[10px] tracking-wider text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                                            Highlight Instruction
                                          </span>
                                          {bp.closing && (
                                            <span className="text-[11px] font-bold text-amber-200 ml-auto flex items-center gap-1">
                                              ⏰ Closes {bp.closing}
                                            </span>
                                          )}
                                        </div>
                                        {bp.instr && (
                                          <p className="text-xs text-amber-200 leading-snug font-medium">
                                            {bp.instr}
                                          </p>
                                        )}
                                        {bp.unitNote && (
                                          <p className="text-[11px] text-amber-300 font-semibold leading-snug mt-0.5">
                                            📌 {bp.unitNote}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                             </div>
                            ))}
                        </div>
                      )}
                    </div>

                  </div>

                  <div className="pt-4 space-y-3 shrink-0 border-t border-slate-800">
                    <button
                      onClick={handleDownloadAll}
                      className="w-full py-4 px-6 rounded-lg flex items-center justify-center gap-3 font-bold text-base bg-dragonfly-turquoise text-white hover:bg-white hover:text-dragonfly-turquoise transition-all hover:-translate-y-0.5 shadow-[0_0_15px_rgba(0,166,143,0.3)] border border-dragonfly-turquoise"
                    >
                      <Archive size={20} />
                      Download All Processed Files
                    </button>
                    
                    <button
                      onClick={handleReset}
                      className="w-full py-4 px-6 rounded-lg flex items-center justify-center gap-3 font-bold text-base bg-slate-800 text-white hover:bg-slate-700 transition-all hover:-translate-y-0.5 shadow-md border border-slate-700"
                    >
                      <RefreshCw size={18} />
                      Process New Files
                    </button>

                    <button
                      onClick={downloadSummary}
                      className="w-full py-1 text-xs font-medium text-gray-500 hover:text-dragonfly-turquoise transition-colors flex items-center justify-center gap-1"
                    >
                      <FileSpreadsheet size={12} />
                      Download Summary Only
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right/Bottom Panel: Log Console */}
            <div className={`
              flex-1 min-h-0 bg-[#1e293b] flex flex-col border-t lg:border-t-0 lg:border-l border-slate-800
            `}>
              <LogConsole logs={logs} userName={userName} />
            </div>
          </>
        )}
      </main>

      {/* Fixed Footer */}
      <footer className="shrink-0 py-3 border-t border-slate-800 bg-slate-950 text-center">
         <p className="text-gray-500 text-[10px] md:text-xs font-semibold tracking-wide">
           Copyright- 2026 Aditya Lavakumar | All rights reserved
         </p>
      </footer>
    </div>
  );
};

export default App;
