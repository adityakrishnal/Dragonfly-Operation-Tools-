import React, { useEffect, useState } from 'react';
import { DragonflyLogoGraphic } from './DragonflyLogo';
import { StationCode, DESIGNATION_OPTIONS } from '../types';
import { login, fetchStaff, addStaff, StaffUser, AuthState } from '../services/opsAuth';
import { LogIn, UserPlus, Loader2 } from 'lucide-react';

interface LoginScreenProps {
  station: StationCode;
  onLogin: (auth: AuthState) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ station, onLogin }) => {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newDesignation, setNewDesignation] = useState<string>(DESIGNATION_OPTIONS[0]);

  useEffect(() => {
    fetchStaff().then(setStaff).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = await login(name.trim(), pin.trim(), station);
      onLogin(auth);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await addStaff(name.trim(), newDesignation, pin.trim());
      const auth = await login(name.trim(), pin.trim(), station);
      onLogin(auth);
    } catch (err: any) {
      setError(err.message || 'Could not add staff member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-gray-100 font-sans">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <DragonflyLogoGraphic height={40} />
          <div className="mt-3 text-xs font-black uppercase tracking-widest text-dragonfly-turquoise">
            Dragonfly | Intelcom
          </div>
          <div className="text-[11px] text-gray-400">Operational Tools Hub</div>
        </div>

        {!showAddStaff ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">
                Name
              </label>
              <input
                list="staff-names"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dragonfly-turquoise"
                placeholder="Your name"
                required
              />
              <datalist id="staff-names">
                {staff.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">
                PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm tracking-widest focus:outline-none focus:border-dragonfly-turquoise"
                placeholder="••••"
                required
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-dragonfly-turquoise text-white font-bold text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              Log In
            </button>
            <button
              type="button"
              onClick={() => setShowAddStaff(true)}
              className="w-full flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-white transition-colors pt-1"
            >
              <UserPlus size={13} />
              New here? Set up your login
            </button>
          </form>
        ) : (
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dragonfly-turquoise"
                placeholder="Your full name"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Designation</label>
              <select
                value={newDesignation}
                onChange={(e) => setNewDesignation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dragonfly-turquoise"
              >
                {['Operations Supervisor', 'Operations Coordinator', 'Operations Lead Hand', 'Station Manager'].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Choose a PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm tracking-widest focus:outline-none focus:border-dragonfly-turquoise"
                placeholder="Pick a 4+ digit PIN"
                required
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-dragonfly-turquoise text-white font-bold text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              Create Login & Continue
            </button>
            <button
              type="button"
              onClick={() => setShowAddStaff(false)}
              className="w-full text-xs text-gray-400 hover:text-white transition-colors pt-1"
            >
              Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
