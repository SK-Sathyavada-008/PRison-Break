// ─────────────────────────────────────────────
// TopBar — Clean Admin Navigation TopBar
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { Menu, ExternalLink, LogOut, ShieldCheck, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { autoSyncService, type AutoSyncState } from '../../services/autoSyncService';

interface TopBarProps {
  onMenuToggle?: () => void;
  title?: string;
  breadcrumb?: string;
}

export default function TopBar({ onMenuToggle, title, breadcrumb }: TopBarProps) {
  const { currentUser, logout, isFirebaseReady } = useAuth();
  const navigate = useNavigate();
  const [syncState, setSyncState] = useState<AutoSyncState>(autoSyncService.getState());

  useEffect(() => {
    return autoSyncService.subscribe((state) => {
      setSyncState(state);
    });
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <header className="topbar">
      {/* Left: Mobile Menu Toggle + Breadcrumb Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Menu size={20} />
          </button>
        )}

        <div className="flex items-center gap-2">
          {breadcrumb && (
            <>
              <span className="text-xs font-medium text-slate-400 hidden sm:inline">{breadcrumb}</span>
              <span className="text-slate-600 hidden sm:inline">/</span>
            </>
          )}
          <h1 className="text-sm sm:text-base font-bold text-white truncate">
            {title || 'Dashboard'}
          </h1>
        </div>
      </div>

      {/* Right: Telemetry + Admin Info + Logout Button */}
      <div className="flex items-center gap-3">
        {/* Live Auto-Sync Indicator */}
        <button
          onClick={() => autoSyncService.triggerImmediateSync()}
          title={`Real-time GitHub Auto-Sync active (${syncState.intervalSeconds}s). Click to force sync immediately.`}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:border-cyan-500/40 hover:bg-slate-850 transition-all cursor-pointer"
        >
          <RefreshCw
            size={11}
            className={`text-cyan-400 ${syncState.isSyncing ? 'animate-spin' : ''}`}
          />
          <span className="font-semibold text-cyan-300 hidden sm:inline">
            {syncState.isSyncing ? 'SYNCING GH...' : `AUTO-SYNC (${syncState.intervalSeconds}s)`}
          </span>
          <span className="font-semibold text-cyan-300 sm:hidden">
            {syncState.isSyncing ? 'SYNC...' : 'AUTO'}
          </span>
        </button>

        {/* Firestore Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono">
          <div className="live-dot" />
          <span className="font-semibold text-emerald-400 hidden sm:inline">
            {isFirebaseReady ? 'FIRESTORE ONLINE' : 'DEV FALLBACK'}
          </span>
          <span className="font-semibold text-emerald-400 sm:hidden">
            ONLINE
          </span>
        </div>

        {/* Public Leaderboard Shortcut */}
        <Link
          to="/"
          target="_blank"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors border border-slate-700 font-mono"
        >
          <ExternalLink size={12} />
          <span>Live Board</span>
        </Link>

        {/* Logged-in Admin Identity & Logout */}
        {currentUser && (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
            {/* Admin Email / Username Display */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-200">
              <ShieldCheck size={14} className="text-[#FF0A3B]" />
              <div className="flex flex-col text-left">
                <span className="font-bold text-white text-[11px] leading-tight">
                  {currentUser.displayName || 'unknown'}
                </span>
                <span className="text-slate-500 text-[10px] leading-tight truncate max-w-[140px] sm:max-w-[180px]">
                  {currentUser.email || 'unknown@prisonbreak.dev'}
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              title="Sign Out of Warden Portal"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-[#FF5470] hover:text-white border border-red-800/40 text-xs font-mono font-medium transition-all"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
