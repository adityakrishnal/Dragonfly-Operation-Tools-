import React, { useEffect, useState } from 'react';
import { StationCode, ProcessingResult, OperatorProfile, DESIGNATION_OPTIONS } from './types';
import DragonflySignature, { DragonflyLogoGraphic } from './components/DragonflyLogo';
import HubDashboard from './components/HubDashboard';
import ManifestProcessorView from './components/ManifestProcessorView';
import CheckInOutCardGenerator from './components/CheckInOutCardGenerator';
import BigBoxMapCreator from './components/BigBoxMapCreator';
import FeedbackView from './components/FeedbackView';
import LoginScreen from './components/LoginScreen';
import ActivityLogView from './components/ActivityLogView';
import ChangePinModal from './components/ChangePinModal';
import { AuthState, loadStoredAuth, logout as apiLogout, logActivity } from './services/opsAuth';
import {
  Layers,
  LayoutDashboard,
  Printer,
  Package,
  MessageSquare,
  User,
  Calendar,
  ChevronDown,
  ClipboardList,
  LogOut,
  KeyRound
} from 'lucide-react';

export const App: React.FC = () => {
  // Navigation State: 3 apps + Hub + Feedback + Activity Log
  const [currentView, setCurrentView] = useState<'hub' | 'manifest' | 'generator' | 'bigbox' | 'feedback' | 'activity'>('hub');

  // Selected Station State (Kitchener: KTCH vs London: LNDN)
  const [currentStation, setCurrentStation] = useState<StationCode>('KTCH');

  // Auth: who's logged in right now
  const [auth, setAuth] = useState<AuthState | null>(() => loadStoredAuth());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);

  // Shared Operator Profile (Name & Designation) — derived from the logged-in user
  const [operatorProfile, setOperatorProfile] = useState<OperatorProfile>({
    name: 'Aditya Lavakumar',
    designation: 'Dispatch Supervisor'
  });

  useEffect(() => {
    if (auth) {
      setOperatorProfile({
        name: auth.user.name,
        designation: auth.user.designation || 'Operations Associate'
      });
    }
  }, [auth]);

  // Global Date State
  const [currentDate, setCurrentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Shared Manifest Processing Results across tools
  const [manifestResults, setManifestResults] = useState<ProcessingResult | null>(null);

  const handleSelectStation = (station: StationCode) => {
    setCurrentStation(station);
  };

  const handleProcessingCompleted = (result: ProcessingResult) => {
    setManifestResults(result);
    logActivity(
      auth,
      currentStation,
      'idc-manifest-processor',
      'generate',
      `${result.summaryRows?.length || 0} routes processed`
    );
  };

  const navigateTo = (view: typeof currentView) => {
    setCurrentView(view);
    const appNames: Record<string, string> = {
      manifest: 'idc-manifest-processor',
      generator: 'checkin-card-generator',
      bigbox: 'big-box-mapping',
      activity: 'system',
      feedback: 'system',
      hub: 'system'
    };
    if (view !== 'hub') {
      logActivity(auth, currentStation, appNames[view] || view, 'open_app');
    }
  };

  // Bound logger for a specific app — pass this down so components can log
  // uploads/downloads/actions without needing to know about auth or station.
  const makeLogger = (appName: string) => (action: string, details?: string) =>
    logActivity(auth, currentStation, appName, action, details);

  const logManifestActivity = makeLogger('idc-manifest-processor');
  const logCardActivity = makeLogger('checkin-card-generator');
  const logBigBoxActivity = makeLogger('big-box-mapping');

  const handleLogout = async () => {
    logActivity(auth, currentStation, 'system', 'logout');
    await apiLogout(auth);
    setAuth(null);
    setCurrentView('hub');
  };

  const processedCount = manifestResults?.summaryRows?.length || 0;

  if (!auth) {
    return <LoginScreen station={currentStation} onLogin={setAuth} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-gray-100 font-sans">
      {/* Top Application Navigation Bar */}
      <header className="bg-slate-950 border-b border-slate-800 px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between shrink-0 z-30 gap-3">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigateTo('hub')}
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity text-left"
          >
            <DragonflyLogoGraphic height={30} />
            <div className="hidden sm:block">
              <div className="text-xs font-black uppercase tracking-widest text-dragonfly-turquoise">
                Dragonfly | Intelcom
              </div>
              <div className="text-[10px] font-semibold text-gray-400">
                Operational Tools Hub
              </div>
            </div>
          </button>
        </div>

        {/* Global Navigation Tabs (Strictly the 3 Apps + Hub) */}
        <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => navigateTo('hub')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              currentView === 'hub'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-gray-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <LayoutDashboard size={14} className={currentView === 'hub' ? 'text-dragonfly-turquoise' : ''} />
            <span>Hub</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('manifest')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              currentView === 'manifest'
                ? 'bg-dragonfly-turquoise text-white shadow-sm shadow-dragonfly-turquoise/20'
                : 'text-gray-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers size={14} />
            <span className="hidden md:inline">IDC Manifest Processor</span>
            <span className="md:hidden">Manifest</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('generator')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              currentView === 'generator'
                ? 'bg-dragonfly-lightblue text-slate-950 shadow-sm shadow-dragonfly-lightblue/20 font-black'
                : 'text-gray-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Printer size={14} />
            <span className="hidden md:inline">Check-In/Out Card Generator</span>
            <span className="md:hidden">Card Generator</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('bigbox')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              currentView === 'bigbox'
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20 font-black'
                : 'text-gray-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Package size={14} />
            <span className="hidden md:inline">Big Box Map Creator</span>
            <span className="md:hidden">Big Box</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-1 hidden lg:block"></div>

          {auth.user.isAdmin && (
            <button
              type="button"
              onClick={() => navigateTo('activity')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center ${
                currentView === 'activity'
                  ? 'bg-slate-800 text-dragonfly-turquoise border border-slate-700'
                  : 'text-gray-400 hover:text-white hover:bg-slate-900'
              }`}
              title="Activity Log (Admin only)"
            >
              <ClipboardList size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => navigateTo('feedback')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center ${
              currentView === 'feedback'
                ? 'bg-slate-800 text-dragonfly-turquoise border border-slate-700'
                : 'text-gray-400 hover:text-white hover:bg-slate-900'
            }`}
            title="Feedback & Support"
          >
            <MessageSquare size={14} />
          </button>
        </nav>

        {/* Global Controls: Station & Operator Dropdowns */}
        <div className="flex items-center gap-2">
          {/* Station Selector Dropdown */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => handleSelectStation('KTCH')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                currentStation === 'KTCH'
                  ? 'bg-dragonfly-turquoise text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Kitchener (KTCH)
            </button>
            <button
              type="button"
              onClick={() => handleSelectStation('LNDN')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                currentStation === 'LNDN'
                  ? 'bg-dragonfly-lightblue text-slate-950 font-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              London (LNDN)
            </button>
          </div>

          {/* Date Picker Button */}
          <div className="hidden xl:flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <Calendar size={13} className="text-dragonfly-turquoise" />
            <input
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              className="bg-transparent text-gray-200 font-mono text-xs focus:outline-none cursor-pointer"
            />
          </div>

          {/* Logged-in user menu: change PIN + logout */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu(v => !v)}
              title={auth.user.name}
              className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs hover:border-slate-700 transition-colors"
            >
              <User size={13} className="text-dragonfly-turquoise" />
              <span className="hidden sm:inline font-bold text-gray-200">{auth.user.name}</span>
              <ChevronDown size={12} className="text-gray-500" />
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-40 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowChangePinModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-slate-800 transition-colors text-left"
                  >
                    <KeyRound size={13} className="text-dragonfly-turquoise" />
                    Change PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-slate-800 hover:text-red-400 transition-colors text-left border-t border-slate-800"
                  >
                    <LogOut size={13} />
                    Log Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {showChangePinModal && (
        <ChangePinModal sessionId={auth.sessionId} onClose={() => setShowChangePinModal(false)} />
      )}

      {/* Main View Router */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {currentView === 'hub' && (
          <HubDashboard
            currentStation={currentStation}
            onSelectStation={handleSelectStation}
            operatorProfile={operatorProfile}
            onUpdateOperator={setOperatorProfile}
            currentDate={currentDate}
            onSelectDate={setCurrentDate}
            onNavigate={view => navigateTo(view)}
            processedRoutesCount={processedCount}
            hasManifestResults={!!manifestResults}
          />
        )}

        {currentView === 'manifest' && (
          <ManifestProcessorView
            currentStation={currentStation}
            onSelectStation={handleSelectStation}
            onBackToHub={() => navigateTo('hub')}
            onNavigateToCards={() => navigateTo('generator')}
            onProcessingCompleted={handleProcessingCompleted}
            initialResults={manifestResults}
            logActivity={logManifestActivity}
          />
        )}

        {currentView === 'generator' && (
          <CheckInOutCardGenerator
            currentStation={currentStation}
            onSelectStation={handleSelectStation}
            operatorProfile={operatorProfile}
            onUpdateOperator={setOperatorProfile}
            currentDate={currentDate}
            onSelectDate={setCurrentDate}
            onBackToHub={() => navigateTo('hub')}
            logActivity={logCardActivity}
          />
        )}

        {currentView === 'bigbox' && (
          <BigBoxMapCreator
            currentStation={currentStation}
            onSelectStation={handleSelectStation}
            operatorProfile={operatorProfile}
            onUpdateOperator={setOperatorProfile}
            currentDate={currentDate}
            onSelectDate={setCurrentDate}
            onBackToHub={() => navigateTo('hub')}
            logActivity={logBigBoxActivity}
          />
        )}

        {currentView === 'activity' && auth.user.isAdmin && (
          <ActivityLogView sessionId={auth.sessionId} onBackToHub={() => navigateTo('hub')} />
        )}

        {currentView === 'activity' && !auth.user.isAdmin && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            The Activity Log is only visible to admin accounts.
          </div>
        )}

        {currentView === 'feedback' && (
          <FeedbackView onBackToDashboard={() => navigateTo('hub')} />
        )}
      </main>

      {/* Global Application Footer */}
      <footer className="shrink-0 py-2 px-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-gray-500 text-[10px] md:text-xs font-medium z-20">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-bold">Dragonfly | Intelcom Ops Hub</span>
          <span>•</span>
          <span>Station: <strong className="text-gray-300 font-mono">{currentStation} ({currentStation === 'KTCH' ? 'Kitchener' : 'London'})</strong></span>
          <span>•</span>
          <span>Operator: <strong className="text-gray-300">{operatorProfile.name} ({operatorProfile.designation})</strong></span>
        </div>
        <p className="text-gray-500 font-semibold tracking-wide">
          Copyright- 2026 Aditya Lavakumar | All rights reserved
        </p>
      </footer>
    </div>
  );
};

export default App;
