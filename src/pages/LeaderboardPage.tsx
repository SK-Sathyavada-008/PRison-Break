// ─────────────────────────────────────────────
// Public Leaderboard & Projector Display Page
// Real-time Firestore Subscriptions · Large Typography · No Admin Leaks
// ─────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Zap,
  Users,
  Trophy,
  GitMerge,
  Shield,
  Search,
  Monitor,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { Participant, FirestoreEventConfig } from '../types';
import { participantService } from '../services/participantService';
import { eventConfigService } from '../services/eventConfigService';
import { autoSyncService, type AutoSyncState } from '../services/autoSyncService';
import Podium from '../components/leaderboard/Podium';
import LeaderboardTable from '../components/leaderboard/LeaderboardTable';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';

export default function LeaderboardPage() {
  const location = useLocation();
  // If navigated directly to /leaderboard, default to projector mode
  const isDedicatedLeaderboardRoute = location.pathname.startsWith('/leaderboard');
  const [projectorMode, setProjectorMode] = useState(isDedicatedLeaderboardRoute);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [eventConfig, setEventConfig] = useState<FirestoreEventConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [syncState, setSyncState] = useState<AutoSyncState>(autoSyncService.getState());

  useEffect(() => {
    return autoSyncService.subscribe((state) => {
      setSyncState(state);
    });
  }, []);

  useEffect(() => {
    setLoading(true);

    // 1. Subscribe in real time to Firestore participants
    const unsubParticipants = participantService.subscribeToLeaderboard(
      (data) => {
        // Filter out deactivated participants from public leaderboard
        const activeOnly = data.filter((p) => p.active !== false && p.status !== 'inactive');
        setParticipants(activeOnly);
        setLoading(false);
        setLastUpdated(new Date());
      },
      (err) => {
        console.error('[LeaderboardPage] Firestore error:', err);
        setLoading(false);
      }
    );

    // 2. Subscribe to event configuration
    const unsubConfig = eventConfigService.subscribeToEventConfig((cfg) => {
      setEventConfig(cfg);
    });

    return () => {
      unsubParticipants();
      unsubConfig();
    };
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

  const filteredParticipants = useMemo(() => {
    if (!searchQuery.trim()) return participants;
    const q = searchQuery.toLowerCase().trim();
    return participants.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.githubUsername.toLowerCase().includes(q)
    );
  }, [participants, searchQuery]);

  const totalXP = useMemo(
    () => participants.reduce((acc, p) => acc + (p.totalScore ?? p.xp ?? 0), 0),
    [participants]
  );
  const totalMerges = useMemo(
    () => participants.reduce((acc, p) => acc + (p.mergedPrCount ?? p.mergedPRs ?? 0), 0),
    [participants]
  );
  const totalEscapes = useMemo(
    () => participants.reduce((acc, p) => acc + (p.escapedCells ?? 0), 0),
    [participants]
  );

  return (
    <div
      className={`w-full min-h-screen flex flex-col items-center justify-start relative overflow-x-hidden ${
        projectorMode ? 'bg-[#030408]' : 'bg-[#05060A]'
      }`}
    >
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[700px] rounded-full opacity-25 blur-[160px]"
          style={{ background: 'radial-gradient(circle, #FF003C 0%, #7F0019 60%, transparent 80%)' }}
        />
        <div
          className="absolute bottom-10 right-10 w-[800px] h-[550px] rounded-full opacity-15 blur-[150px]"
          style={{ background: 'radial-gradient(circle, #FF0A3B 0%, transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255, 10, 59, 0.4) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 10, 59, 0.4) 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, #05060A 95%)',
          }}
        />
      </div>

      {/* Main Content Container */}
      <main
        className={`relative z-10 w-full flex flex-col items-center transition-all duration-300 ${
          projectorMode
            ? 'px-4 sm:px-8 lg:px-14 py-8 sm:py-12 max-w-[1920px]'
            : 'px-6 sm:px-12 lg:px-20 xl:px-24 py-12 sm:py-16 max-w-[1680px]'
        }`}
      >
        {/* Top Header Bar — Public Only, NO Admin Controls */}
        <header className="w-full flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 mb-10 sm:mb-14 border-b border-slate-800/80">
          {/* Branding */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 rounded-2xl bg-black/80 border border-[#FF0A3B]/60 flex items-center justify-center text-[#FF1E46] shadow-[0_0_35px_rgba(255,10,59,0.35)] shrink-0">
              <span className="font-mono text-xl font-black tracking-tight">&gt;_</span>
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
                  {eventConfig?.eventName || 'PRISON BREAK'}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#FF0A3B]/10 text-[#FF5470] border border-[#FF0A3B]/40 tracking-widest uppercase shadow-[0_0_15px_rgba(255,10,59,0.25)]">
                  LIVE TELEMETRY
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 font-mono mt-1">
                {eventConfig?.tagline || 'Escape the Code. Defeat the Void.'}
              </p>
            </div>
          </div>

          {/* Projector & Live Signal Indicators */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
            {/* Real-time GitHub Auto-Sync Status */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 shadow-sm">
              <span className={`w-2 h-2 rounded-full ${syncState.isSyncing ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="font-semibold text-slate-200">
                {syncState.isSyncing ? 'SYNCING GH...' : `AUTO-SYNC (${syncState.intervalSeconds}s)`}
              </span>
            </div>

            {/* Live Indicator */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 shadow-sm">
              <div className="live-dot" />
              <span className="font-bold text-[#FF5470]">LIVE SIGNAL</span>
              <span className="text-slate-500 text-[11px] ml-1">
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            {/* Projector Mode Toggle */}
            <button
              onClick={() => setProjectorMode(!projectorMode)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                projectorMode
                  ? 'bg-[#FF0A3B]/20 border-[#FF0A3B] text-white shadow-[0_0_25px_rgba(255,10,59,0.4)]'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
              title="Toggle Projector Display Mode"
            >
              <Monitor size={14} />
              <span>{projectorMode ? 'Standard Mode' : 'Projector Mode'}</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={handleToggleFullscreen}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 text-xs font-mono transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="w-full flex flex-col items-center text-center my-6 sm:my-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-[#FF0A3B]/30 text-xs text-[#FF5470] font-mono tracking-widest uppercase shadow-[0_0_20px_rgba(255,10,59,0.15)]">
            <span>// DETERMINISTIC EVENT RANKINGS</span>
          </div>

          <h1
            className={`font-black text-white tracking-tight drop-shadow-[0_0_35px_rgba(255,10,59,0.3)] ${
              projectorMode ? 'text-6xl sm:text-8xl lg:text-9xl' : 'text-5xl sm:text-7xl'
            }`}
          >
            LEADERBOARD
          </h1>
          <p
            className={`text-slate-400 max-w-2xl mx-auto leading-relaxed pt-1 text-center font-normal ${
              projectorMode ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
            }`}
          >
            Real-time deterministic scoring: Total XP ↓, Merged PRs ↓, Earliest Merge ↑. Updates automatically in real time.
          </p>
        </section>

        {/* Global Event Stats Bar */}
        <section className="w-full grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 my-8 sm:my-12">
          <div className="card p-6 sm:p-7 text-center flex flex-col items-center justify-center hover:border-[#FF0A3B]/40 transition-all">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-mono uppercase tracking-widest mb-2">
              <Users size={16} className="text-[#FF5470]" />
              <span>Participants</span>
            </div>
            <div
              className={`font-black font-mono text-white tracking-tight ${
                projectorMode ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-5xl'
              }`}
            >
              {participants.length}
            </div>
          </div>

          <div className="card p-6 sm:p-7 text-center flex flex-col items-center justify-center hover:border-purple-500/40 transition-all">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-mono uppercase tracking-widest mb-2">
              <GitMerge size={16} className="text-purple-400" />
              <span>Merged Escapes</span>
            </div>
            <div
              className={`font-black font-mono text-white tracking-tight ${
                projectorMode ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-5xl'
              }`}
            >
              {totalMerges}
            </div>
          </div>

          <div className="card p-6 sm:p-7 text-center flex flex-col items-center justify-center hover:border-cyan-500/40 transition-all">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-mono uppercase tracking-widest mb-2">
              <Shield size={16} className="text-cyan-400" />
              <span>Cells Broken</span>
            </div>
            <div
              className={`font-black font-mono text-white tracking-tight ${
                projectorMode ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-5xl'
              }`}
            >
              {totalEscapes}
            </div>
          </div>

          <div className="card p-6 sm:p-7 text-center flex flex-col items-center justify-center hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-mono uppercase tracking-widest mb-2">
              <Zap size={16} className="text-emerald-400" />
              <span>Total Score</span>
            </div>
            <div
              className={`font-black font-mono text-emerald-400 tracking-tight ${
                projectorMode ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-5xl'
              }`}
            >
              {totalXP.toLocaleString()}
            </div>
          </div>
        </section>

        {/* Content Area */}
        {loading ? (
          <div className="w-full card p-16 my-10">
            <LoadingState message="SUBSCRIBING TO FIRESTORE TELEMETRY..." />
          </div>
        ) : participants.length === 0 ? (
          <div className="w-full card p-16 my-10 flex flex-col items-center justify-center">
            <EmptyState
              title="NO ESCAPES RECORDED YET"
              description="No participants have registered scores yet. As PRs merge and issues resolve, the live leaderboard will update automatically."
              icon={<Trophy size={42} />}
            />
          </div>
        ) : (
          <>
            {/* Top 3 Podium (Shown Prominently for Distance Reading) */}
            {!searchQuery && (
              <section className="w-full my-8 sm:my-14">
                <div className="flex items-center justify-between mb-6 px-2">
                  <div className="flex items-center gap-3">
                    <Trophy size={20} className="text-[#FF1E46]" />
                    <h2
                      className={`font-black font-mono tracking-widest text-slate-100 uppercase ${
                        projectorMode ? 'text-base sm:text-xl' : 'text-sm sm:text-base'
                      }`}
                    >
                      SECTOR APEX // TOP ESCAPED
                    </h2>
                  </div>
                  <span className="text-xs sm:text-sm text-slate-500 font-mono">
                    Deterministic Ranks #1 – #3
                  </span>
                </div>
                <Podium participants={participants} />
              </section>
            )}

            {/* Complete Participant Table */}
            <section className="w-full my-8 sm:my-12 space-y-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div>
                  <h2
                    className={`font-black text-white tracking-tight flex items-center gap-3 font-mono ${
                      projectorMode ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                    }`}
                  >
                    <span>CELL ROSTER</span>
                    <span className="text-xs sm:text-sm font-normal px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                      {filteredParticipants.length} of {participants.length} Prisoners
                    </span>
                  </h2>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-80">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or @github..."
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs sm:text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF0A3B]/60 focus:ring-1 focus:ring-[#FF0A3B]/40 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Leaderboard Table with 7 Columns */}
              <LeaderboardTable
                participants={filteredParticipants}
                projectorMode={projectorMode}
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
