// ─────────────────────────────────────────────
// Admin Login — NØLL Security Terminal Gate
// Route: /admin/login
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { Lock, User, ArrowRight, AlertCircle, Terminal, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ADMIN_CONFIG } from '../../config/adminConfig';

export default function AdminLogin() {
  const { login, isAuthenticated, isFirebaseReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('unknown');
  const [password, setPassword] = useState('12345678');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, redirect to /admin or requested route
  useEffect(() => {
    if (isAuthenticated) {
      const destination = (location.state as any)?.from?.pathname || '/admin';
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please provide officer username and security key.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await login(identifier, password);
      // Successful login -> redirect to destination or /admin
      const destination = (location.state as any)?.from?.pathname || '/admin';
      navigate(destination, { replace: true });
    } catch (err: any) {
      console.error('[AdminLogin] Error:', err);
      const code = err?.code;
      if (
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        setError('ACCESS DENIED: Invalid officer credentials.');
      } else if (code === 'auth/network-request-failed') {
        setError('CONNECTION REFUSED: Check internet or Firebase setup.');
      } else if (err?.message?.includes('allowlist')) {
        setError('UNAUTHORIZED: This account is not on the Warden authorization allowlist.');
      } else {
        setError(err?.message || 'Authentication error.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen void-bg flex flex-col justify-center items-center px-6 py-12 relative overflow-hidden">
      {/* Crimson Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] rounded-full opacity-[0.14] blur-[120px] bg-[#FF0A3B] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="card-crimson p-8 sm:p-10 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-[#FF0A3B]/10 border border-[#FF0A3B]/40 items-center justify-center mb-4 text-[#FF1E46] shadow-[0_0_25px_rgba(255,10,59,0.3)]">
              <Terminal size={24} />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight font-mono">
              WARDEN ACCESS
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              SECTOR NØLL // CONTROL SYSTEM
            </p>
          </div>

          {/* Database indicator */}
          <div className="mb-6 p-3 rounded-xl border border-slate-800 bg-[#070912]/80 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Database Engine</span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                isFirebaseReady
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}
            >
              {isFirebaseReady ? 'FIRESTORE ONLINE' : 'DEV FALLBACK'}
            </span>
          </div>

          {/* Configured Admin Hint */}
          <div className="mb-6 p-3 rounded-xl border border-slate-800/80 bg-slate-900/60 flex items-center gap-2.5 text-slate-400 text-xs font-mono">
            <ShieldAlert size={14} className="text-[#FF5470] shrink-0" />
            <div className="text-[11px] leading-tight">
              Officer: <span className="text-white font-bold">{ADMIN_CONFIG.defaultAdmin.username}</span> // Key: <span className="text-white font-bold">{ADMIN_CONFIG.defaultAdmin.password}</span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl border border-[#FF0A3B]/50 bg-[#FF0A3B]/10 flex items-start gap-2.5 text-[#FF5470] text-xs font-mono">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-[#FF1E46]" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 uppercase tracking-wider mb-2">
                Officer Username or Email
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="unknown"
                  className="input pl-10 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 uppercase tracking-wider mb-2">
                Security Key
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-crimson w-full py-3.5 text-xs font-mono font-bold tracking-wider uppercase mt-3 shadow-[0_0_25px_rgba(255,10,59,0.3)] disabled:opacity-50"
            >
              {submitting ? (
                <span>AUTHENTICATING OFFICER...</span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>Enter Command Center</span>
                  <ArrowRight size={14} />
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Back Link to Public Leaderboard */}
        <div className="text-center">
          <Link
            to="/"
            className="text-xs font-mono text-slate-500 hover:text-[#FF5470] transition-colors"
          >
            &larr; Return to Public Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
