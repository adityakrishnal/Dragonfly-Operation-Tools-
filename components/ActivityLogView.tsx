import React, { useEffect, useState } from 'react';
import { fetchActivity, ActivityEntry } from '../services/opsAuth';
import { ArrowLeft, RefreshCw, LogIn, LogOut, Upload, Download, ScanLine, Trash2, Activity as ActivityIcon } from 'lucide-react';

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

const ActivityLogView: React.FC<ActivityLogViewProps> = ({ sessionId, onBackToHub }) => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState('');
  const [appFilter, setAppFilter] = useState('');

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
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

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
    </div>
  );
};

export default ActivityLogView;
