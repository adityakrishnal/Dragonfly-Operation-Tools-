import React, { useEffect, useState } from 'react';
import { fetchActivity, ActivityEntry } from '../services/opsAuth';
import { ArrowLeft, RefreshCw, LogIn, LogOut, Activity as ActivityIcon } from 'lucide-react';

interface ActivityLogViewProps {
  onBackToHub: () => void;
}

const actionIcon = (action: string) => {
  if (action === 'login') return <LogIn size={13} className="text-emerald-400" />;
  if (action === 'logout') return <LogOut size={13} className="text-gray-500" />;
  return <ActivityIcon size={13} className="text-dragonfly-turquoise" />;
};

const ActivityLogView: React.FC<ActivityLogViewProps> = ({ onBackToHub }) => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('');

  const load = () => {
    setLoading(true);
    fetchActivity({ user: userFilter || undefined, limit: 300 })
      .then(setEntries)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFilter]);

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

      <input
        value={userFilter}
        onChange={(e) => setUserFilter(e.target.value)}
        placeholder="Filter by name…"
        className="mb-4 w-full max-w-xs bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dragonfly-turquoise"
      />

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
                <td className="px-3 py-2 text-gray-500">{e.details || '—'}</td>
              </tr>
            ))}
            {!loading && entries.length === 0 && (
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
