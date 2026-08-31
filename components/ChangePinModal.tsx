import React, { useState } from 'react';
import { changePin } from '../services/opsAuth';
import { KeyRound, X, Loader2, Check } from 'lucide-react';

interface ChangePinModalProps {
  sessionId: string;
  onClose: () => void;
}

const ChangePinModal: React.FC<ChangePinModalProps> = ({ sessionId, onClose }) => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPin.length < 4) {
      setError('New PIN must be at least 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('New PIN and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      await changePin(sessionId, currentPin, newPin);
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err.message || 'Could not change PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <KeyRound size={16} className="text-dragonfly-turquoise" />
          <h2 className="text-sm font-black text-white">Change PIN</h2>
        </div>

        {success ? (
          <div className="flex items-center gap-2 text-emerald-400 text-sm py-4">
            <Check size={16} />
            PIN updated.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Current PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm tracking-widest focus:outline-none focus:border-dragonfly-turquoise"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm tracking-widest focus:outline-none focus:border-dragonfly-turquoise"
                placeholder="At least 4 digits"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Confirm New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm tracking-widest focus:outline-none focus:border-dragonfly-turquoise"
                required
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-dragonfly-turquoise text-white font-bold text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Update PIN
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangePinModal;
