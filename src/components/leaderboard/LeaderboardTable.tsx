// ─────────────────────────────────────────────
// LeaderboardTable — Live Public & Projector Roster
// Large Typography · Deterministic Ranks · Smooth Telemetry Glow
// ─────────────────────────────────────────────

import { memo } from 'react';
import { ArrowUp, ArrowDown, Minus, Zap, GitMerge, GitPullRequest, Shield, ExternalLink } from 'lucide-react';
import type { Participant } from '../../types';
import StatusBadge from '../ui/StatusBadge';

interface LeaderboardTableProps {
  participants: Participant[];
  projectorMode?: boolean;
  showStatus?: boolean;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#FF1E46]/20 border border-[#FF1E46]/70 text-[#FF5470] font-black font-mono text-base shadow-[0_0_15px_rgba(255,30,70,0.35)]">
        #1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-700/40 border border-slate-400/60 text-slate-100 font-bold font-mono text-base shadow-sm">
        #2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-amber-950/40 border border-amber-500/60 text-amber-400 font-bold font-mono text-base shadow-sm">
        #3
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#090B14] border border-slate-800 text-slate-400 font-semibold font-mono text-sm">
      #{rank}
    </span>
  );
}

function RankDelta({ current, previous }: { current: number; previous: number }) {
  const diff = previous - current;
  if (diff === 0) {
    return <Minus size={13} className="text-slate-600" />;
  }
  if (diff > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-400 font-mono text-xs font-bold animate-pulse">
        <ArrowUp size={12} />+{diff}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-rose-400 font-mono text-xs font-semibold">
      <ArrowDown size={12} />{diff}
    </span>
  );
}

// Memoized Row for efficient rendering of 150+ participants
const LeaderboardRow = memo(function LeaderboardRow({
  participant: p,
  projectorMode,
  showStatus,
}: {
  participant: Participant;
  projectorMode?: boolean;
  showStatus?: boolean;
}) {
  const rankImproved = p.previousRank > p.rank;
  const rankDropped = p.previousRank < p.rank;

  return (
    <tr
      key={p.id}
      className={`transition-colors duration-300 group ${
        rankImproved
          ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
          : rankDropped
          ? 'bg-rose-500/5 hover:bg-rose-500/10'
          : 'hover:bg-slate-800/40'
      }`}
    >
      {/* 1. Rank */}
      <td className="text-center font-mono py-4 px-3">
        <div className="flex items-center justify-center gap-2">
          <RankBadge rank={p.rank} />
          <div className="w-8 flex justify-center">
            <RankDelta current={p.rank} previous={p.previousRank} />
          </div>
        </div>
      </td>

      {/* 2. Name */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-3.5">
          {p.avatarUrl ? (
            <img
              src={p.avatarUrl}
              alt={p.name}
              className={`rounded-full object-cover border border-slate-700/80 bg-slate-900 shrink-0 ${
                projectorMode ? 'w-11 h-11' : 'w-10 h-10'
              }`}
              loading="lazy"
            />
          ) : (
            <div
              className={`rounded-full bg-slate-900 border border-slate-700/80 flex items-center justify-center font-bold text-slate-300 font-mono shrink-0 ${
                projectorMode ? 'w-11 h-11 text-base' : 'w-10 h-10 text-sm'
              }`}
            >
              {p.name[0]}
            </div>
          )}
          <div className="min-w-0">
            <div
              className={`font-bold text-white group-hover:text-emerald-300 transition-colors truncate ${
                projectorMode ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
              }`}
            >
              {p.name}
            </div>
          </div>
        </div>
      </td>

      {/* 3. GitHub Username */}
      <td className="py-4 px-4 font-mono">
        <a
          href={`https://github.com/${p.githubUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors font-mono ${
            projectorMode ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
          }`}
        >
          <span>@{p.githubUsername}</span>
          <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      </td>

      {/* 4. XP Score */}
      <td className="py-4 px-4 font-mono">
        <div className="flex items-center gap-1.5">
          <Zap size={15} className="text-emerald-400 fill-emerald-400/20" />
          <span
            className={`font-black text-emerald-400 tracking-tight ${
              projectorMode ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
            }`}
          >
            {(p.totalScore ?? p.xp).toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-normal ml-0.5">XP</span>
        </div>
      </td>

      {/* 5. PRs */}
      <td className="py-4 px-4 font-mono">
        <div className="inline-flex items-center gap-1.5 text-blue-300">
          <GitPullRequest size={14} className="text-blue-400" />
          <span className={`font-bold ${projectorMode ? 'text-base' : 'text-sm'}`}>
            {p.prCount ?? p.prs}
          </span>
        </div>
      </td>

      {/* 6. Merged */}
      <td className="py-4 px-4 font-mono">
        <div className="inline-flex items-center gap-1.5 text-purple-300">
          <GitMerge size={14} className="text-purple-400" />
          <span className={`font-bold ${projectorMode ? 'text-base' : 'text-sm'}`}>
            {p.mergedPrCount ?? p.mergedPRs}
          </span>
        </div>
      </td>

      {/* 7. Cells */}
      <td className="py-4 px-4 font-mono">
        <div className="inline-flex items-center gap-1.5 text-cyan-300">
          <Shield size={14} className="text-cyan-400" />
          <span className={`font-bold ${projectorMode ? 'text-base' : 'text-sm'}`}>
            {p.escapedCells}
          </span>
        </div>
      </td>

      {/* Status (Optional for Admin Leaderboard) */}
      {showStatus && (
        <td className="py-4 px-4">
          <StatusBadge status={p.status} size="sm" />
        </td>
      )}
    </tr>
  );
});

export default function LeaderboardTable({
  participants,
  projectorMode = false,
  showStatus = false,
}: LeaderboardTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/60 shadow-2xl backdrop-blur-sm">
      <table className="prison-table w-full">
        <thead>
          <tr className="border-b border-slate-800/90 bg-slate-900/60">
            <th className="w-28 text-center font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-3">
              Rank
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
              Name
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
              GitHub Username
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
              XP
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
              PRs
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
              Merged
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
              Cells
            </th>
            {showStatus && (
              <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
                Status
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {participants.map((p) => (
            <LeaderboardRow
              key={p.id}
              participant={p}
              projectorMode={projectorMode}
              showStatus={showStatus}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
