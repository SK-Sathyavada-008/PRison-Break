// ─────────────────────────────────────────────
// Admin Leaderboard Page (internal view) — Connected to Firestore
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { Trophy, ExternalLink, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Team } from '../../types';
import { teamService } from '../../services/teamService';

import AwardsShowcase from '../../components/leaderboard/AwardsShowcase';
import TeamDetailModal from '../../components/leaderboard/TeamDetailModal';
import LeaderboardTable from '../../components/leaderboard/LeaderboardTable';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';

export default function AdminLeaderboardPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = teamService.subscribeToTeamsLeaderboard((data) => {
      setTeams(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">Squad Leaderboard</h1>
          <p className="text-sm text-slate-400">Current team rankings &mdash; 4-student offline hackathon squads</p>
        </div>
        <Link
          to="/"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold transition-all shadow-sm"
        >
          <ExternalLink size={14} className="text-slate-400" />
          <span>Open Public View</span>
        </Link>
      </div>

      {loading ? (
        <div className="card p-10">
          <LoadingState message="SYNCHRONIZING SQUAD LEADERBOARD..." />
        </div>
      ) : teams.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            title="No Squad Rankings Available"
            description="Leaderboard will populate as soon as squad repositories are registered and student PRs score points."
            icon={<Trophy size={28} />}
          />
        </div>
      ) : (
        <>
          {/* Awards Showcase */}
          <AwardsShowcase teams={teams} onSelectTeam={setSelectedTeam} />

          {/* Full rankings */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-400 tracking-wide flex items-center gap-1.5">
                <Users size={13} className="text-[#FF5470]" />
                {teams.length} Total Squads
              </span>
              <div className="flex items-center gap-2">
                <div className="live-dot" style={{ width: 6, height: 6 }} />
                <span className="font-mono text-[10px] text-emerald-400/60 tracking-widest">LIVE</span>
              </div>
            </div>
            <LeaderboardTable
              teams={teams}
              showStatus={true}
              onSelectTeam={setSelectedTeam}
            />
          </div>

          {/* Team Detail Modal */}
          <TeamDetailModal
            team={selectedTeam}
            isOpen={Boolean(selectedTeam)}
            onClose={() => setSelectedTeam(null)}
          />
        </>
      )}
    </div>
  );
}
