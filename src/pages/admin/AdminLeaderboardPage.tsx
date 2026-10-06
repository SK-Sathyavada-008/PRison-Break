// ─────────────────────────────────────────────
// Admin Leaderboard Page (internal view) — Connected to Firestore
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { Trophy, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Participant } from '../../types';
import { participantService } from '../../services/participantService';
import Podium from '../../components/leaderboard/Podium';
import LeaderboardTable from '../../components/leaderboard/LeaderboardTable';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';

export default function AdminLeaderboardPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = participantService.subscribeToLeaderboard((data) => {
      setParticipants(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100 tracking-wide mb-1">Leaderboard</h1>
          <p className="font-mono text-xs text-slate-500">Current rankings — all prisoners</p>
        </div>
        <Link
          to="/"
          target="_blank"
          className="btn btn-ghost flex items-center gap-1.5"
        >
          <ExternalLink size={13} />
          Public View
        </Link>
      </div>

      {loading ? (
        <div className="card p-10">
          <LoadingState message="SYNCHRONIZING PRISONER LEADERBOARD..." />
        </div>
      ) : participants.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            title="No Rankings Available"
            description="Leaderboard will populate as soon as prisoners are registered and score points."
            icon={<Trophy size={28} />}
          />
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-4 px-2">
              <Trophy size={14} className="text-amber-400" />
              <span className="font-mono text-xs text-slate-400 font-semibold tracking-wide">Top 3 Escapees</span>
            </div>
            <Podium participants={participants} />
          </div>

          {/* Full rankings */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-400 tracking-wide">
                {participants.length} Total Participants
              </span>
              <div className="flex items-center gap-2">
                <div className="live-dot" style={{ width: 6, height: 6 }} />
                <span className="font-mono text-[10px] text-emerald-400/60 tracking-widest">LIVE</span>
              </div>
            </div>
            <LeaderboardTable participants={participants} showStatus={true} />
          </div>
        </>
      )}
    </div>
  );
}
