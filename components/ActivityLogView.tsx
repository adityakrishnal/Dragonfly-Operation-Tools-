import React, { useEffect, useState } from 'react';
import { fetchActivity, fetchStaff, resetStaffPin, ActivityEntry, StaffUser } from '../services/opsAuth';
import { ArrowLeft, RefreshCw, LogIn, LogOut, Upload, Download, ScanLine, Trash2, Activity as ActivityIcon, Users, KeyRound, Check } from 'lucide-react';

interface ActivityLogViewProps {
  sessionId: string;
  onBackToHub: () => void;
}

const actionIcon = (action: string) => {
  if (action === 'login') return <LogIn size={13} className="text-emerald-400" />;
  if (action === 'logout') return <LogOut size={13} className="text-gray-500" />;
  if (action === 'upload') return <Upload size={13} className="text-amber-400" />;
  if (action === 'download' || action === 'generate') return <Download size={13} className="text-dragonfly-lightblue" />;
  if (action === 'scan') return <ScanLine size={13} className="text-dragonfly-turquoise" />;
  if (action === 'delete') return <Trash2 size={13} className="text-red-400" />;
  return <ActivityIcon size={13} className="text-dragonfly-turquoise" />;
};

const StaffPinRow: React.FC<{ staff: StaffUser; sessionId: string }> = ({ staff, sessionId }) => {
  const [showReset, setShowReset] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setError(null);
    if (newPin.length < 4) {
      setError('PIN must be at least 4 digits.');
      return;
    }
    setLoading(true);
    try {
      await resetStaffPin(sessionId, staff.id, newPin);
      setSuccess(true);
      setNewPin('');
      setTimeout(() => {
        setShowReset(false);
        setSuccess(false);
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Could not reset PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr className="border-t border-slate-900">
      <td className="px-3 py-2 font-bold">{staff.name}</td>
      <td className="px-3 py-2 text-gray-400">{staff.designation || '—'}</td>
      <td className="px-3 py-2 text-gray-400">{staff.isAdmin ? 'Admin' : 'Staff'}</td>
      <td className="px-3 py-2">
        {!showReset ? (
          <button
            onClick={() => setShowReset(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-dragonfly-turquoise hover:opacity-80"
          >
            <KeyRound size={12} />
            Reset PIN
          </button>
        ) : success ? (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Check size={12} /> Done
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="New PIN"
              className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs"
              autoFocus
            />
            <button
              onClick={handleReset}
              disabled={loading}
              className="text-xs font-bold text-white bg-dragonfly-turquoise px-2 py-1 rounded disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => { setShowReset(false); setError(null); setNewPin(''); }}
              className="text-xs text-gray-500 hover:text-white"
            >
              Cancel
            </button>
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
        )}
      </td>
    </tr>
  );
};

const ActivityLogView: React.FC<ActivityLogViewProps> = ({ sessionId, onBackToHub }) => {
  const [tab, setTab] = useState<'activity' | 'staff'>('activity');
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState('');
  const [appFilter, setAppFilter] = useState('');
  const [staff, setStaff] = useState<StaffUser[]>([]);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchActivity(sessionId, { user: userFilter || undefined, app: appFilter || undefined, limit: 500 })
      .then(setEntries)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFilter, appFilter]);

  useEffect(() => {
    if (tab === 'staff') {
      fetchStaff().then(setStaff).catch(() => {});
    }
  }, [tab]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-950 text-gray-100 p-6">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHub}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-lg font-black">Activity Log</h1>
        </div>
        {tab === 'activity' && (
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-4 bg-slate-900 border border-slate-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('activity')}
          className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors ${
            tab === 'activity' ? 'bg-slate-800 text-dragonfly-turquoise' : 'text-gray-400 hover:text-white'
          }`}
        >
          <ActivityIcon size={13} />
          Activity Log
        </button>
        <button
          onClick={() => setTab('staff')}
          className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors ${
            tab === 'staff' ? 'bg-slate-800 text-dragonfly-turquoise' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Users size={13} />
          Manage Staff
        </button>
      </div>

      {tab === 'activity' ? (
        <>
          <div className="flex items-center gap-3 mb-4">
            <input
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              placeholder="Filter by name…"
              className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dragonfly-turquoise"
            />
            <select
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dragonfly-turquoise"
            >
              <option value="">All apps</option>
              <option value="idc-manifest-processor">IDC Manifest Processor</option>
              <option value="checkin-card-generator">Check-In/Out Card Generator</option>
              <option value="big-box-mapping">Big Box Map Creator</option>
              <option value="system">System (login/logout)</option>
            </select>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar rounded-xl border border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 sticky top-0">
                <tr className="text-left text-gray-400 font-bold">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Who</th>
                  <th className="px-3 py-2">Station</th>
                  <th className="px-3 py-2">App</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-slate-900 hover:bg-slate-900/50">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-400 font-mono">
                      {new Date(e.created_at + 'Z').toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-bold">{e.user_name}</td>
                    <td className="px-3 py-2 text-gray-400">{e.station || '—'}</td>
                    <td className="px-3 py-2 text-gray-400">{e.app}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        {actionIcon(e.action)}
                        {e.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-300">{e.details || '—'}</td>
                  </tr>
                ))}
                {!loading && !error && entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                      No activity recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar rounded-xl border border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 sticky top-0">
              <tr className="text-left text-gray-400 font-bold">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Designation</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">PIN</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <StaffPinRow key={s.id} staff={s} sessionId={sessionId} />
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-gray-500">
                    Loading staff…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ActivityLogView;
