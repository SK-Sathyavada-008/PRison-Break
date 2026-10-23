// ─────────────────────────────────────────────
// LeaderboardTable — Team-Based Squad Rankings Roster
// Large Typography · Deterministic Ranks · 4-Student Squads · Difficulty Breakdown
// Each row displays: Rank, Repository Name, Team Name, Total XP, Solved Issues,
// Very Hard Solved, Valid Submissions Count, and Submission/Grading Status.
// ─────────────────────────────────────────────

import { memo } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Minus,
  Zap,
  CheckCircle2,
  FolderGit2,
  ExternalLink,
  Flame,
  Clock,
  AlertCircle,
  Users,
} from 'lucide-react';
import type { Team, Participant } from '../../types';
import StatusBadge from '../ui/StatusBadge';

interface LeaderboardTableProps {
  teams?: Team[];
  participants?: Participant[]; // Backward compatibility
  projectorMode?: boolean;
  showStatus?: boolean;
  onSelectTeam?: (team: Team) => void;
}

function RankBadge({ rank, rankText, isTied }: { rank: number; rankText?: string; isTied?: boolean }) {
  const displayText = rankText || (isTied ? `T-${rank}` : `#${rank}`);

  if (rank === 1) {
    return (
      <div className="flex flex-col items-center">
        <span className="inline-flex items-center justify-center min-w-[38px] h-9 px-2 rounded-xl bg-[#FF1E46]/20 border border-[#FF1E46]/70 text-[#FF5470] font-black font-mono text-sm shadow-[0_0_15px_rgba(255,30,70,0.35)]">
          {displayText}
        </span>
        {isTied && <span className="text-[9px] font-mono font-bold text-amber-400 mt-0.5">TIED</span>}
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex flex-col items-center">
        <span className="inline-flex items-center justify-center min-w-[38px] h-9 px-2 rounded-xl bg-slate-700/40 border border-slate-400/60 text-slate-100 font-bold font-mono text-sm shadow-sm">
          {displayText}
        </span>
        {isTied && <span className="text-[9px] font-mono font-bold text-amber-400 mt-0.5">TIED</span>}
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex flex-col items-center">
        <span className="inline-flex items-center justify-center min-w-[38px] h-9 px-2 rounded-xl bg-amber-950/40 border border-amber-500/60 text-amber-400 font-bold font-mono text-sm shadow-sm">
          {displayText}
        </span>
        {isTied && <span className="text-[9px] font-mono font-bold text-amber-400 mt-0.5">TIED</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <span className="inline-flex items-center justify-center min-w-[38px] h-9 px-2 rounded-xl bg-[#090B14] border border-slate-800 text-slate-400 font-semibold font-mono text-xs">
        {displayText}
      </span>
      {isTied && <span className="text-[9px] font-mono font-bold text-amber-400 mt-0.5">TIED</span>}
    </div>
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

// Memoized Row for efficient rendering of teams
const TeamLeaderboardRow = memo(function TeamLeaderboardRow({
  team: t,
  projectorMode,
  showStatus,
  onSelectTeam,
}: {
  team: Team;
  projectorMode?: boolean;
  showStatus?: boolean;
  onSelectTeam?: (team: Team) => void;
}) {
  const rankImproved = t.previousRank > t.rank;
  const rankDropped = t.previousRank < t.rank;
  const members = t.members || [];
  const solved = t.solvedIssues || [];

  // Difficulty counts
  const easyCount = solved.filter((s) => s.difficulty === 'EASY').length;
  const medCount = solved.filter((s) => s.difficulty === 'MEDIUM').length;
  const hardCount = solved.filter((s) => s.difficulty === 'HARD').length;
  const vHardCount = t.veryHardSolvedCount ?? solved.filter((s) => s.difficulty === 'VERY_HARD').length;

  const validStudentsCount =
    t.validSubmissionsCount ?? members.filter((m) => m.prSubmitted).length;

  return (
    <tr
      key={t.id}
      onClick={() => onSelectTeam && onSelectTeam(t)}
      className={`transition-colors duration-300 group cursor-pointer ${
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
          <RankBadge rank={t.rank} rankText={t.rankText} isTied={t.isTied} />
          <div className="w-8 flex justify-center">
            <RankDelta current={t.rank} previous={t.previousRank} />
          </div>
        </div>
      </td>

      {/* 2. Repository Name (squard_X) */}
      <td className="py-4 px-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <a
            href={
              t.repositoryFullName
                ? `https://github.com/${t.repositoryFullName}`
                : `https://github.com/PRison-Break-2026/${t.repositoryName}`
            }
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-[#FF0A3B]/40 transition-colors text-xs font-mono font-bold max-w-[200px]"
            title={t.repositoryName}
          >
            <FolderGit2 size={13} className="text-slate-400 shrink-0" />
            <span className="font-bold text-emerald-400 truncate">{t.repositoryName}</span>
            <ExternalLink size={11} className="opacity-60 shrink-0" />
          </a>
        </div>
      </td>

      {/* 3. Team Name */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-slate-300 font-mono shrink-0 overflow-hidden text-xs">
            {(() => {
              const digits = t.name.replace(/[^0-9]/g, '');
              if (digits && digits.length <= 2) return `#${digits}`;
              if (t.rank && t.rank <= 99) return `#${t.rank}`;
              return <Users size={15} className="text-slate-400" />;
            })()}
          </div>
          <div className="min-w-0 max-w-[220px]">
            <div
              className={`font-bold text-white group-hover:text-emerald-300 transition-colors truncate ${
                projectorMode ? 'text-lg' : 'text-sm sm:text-base'
              }`}
              title={t.name}
            >
              {t.name}
            </div>
            <div className="text-[11px] text-slate-500 font-sans truncate">
              Click to view score breakdown
            </div>
          </div>
        </div>
      </td>

      {/* 4. Earned XP */}
      <td className="py-4 px-3 font-mono text-left whitespace-nowrap">
        <span className="text-slate-300 font-bold text-sm">
          {(t.earnedXP ?? (t.totalScore !== undefined && t.bonusXP !== undefined ? Math.max(0, t.totalScore - t.bonusXP) : (t.totalScore ?? 0))).toLocaleString()}
        </span>
        <span className="text-[10px] text-slate-500 ml-1">XP</span>
      </td>

      {/* 5. Bonus XP */}
      <td className="py-4 px-3 font-mono text-left whitespace-nowrap">
        {(t.bonusXP && t.bonusXP > 0) ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs">
            +{t.bonusXP.toLocaleString()} XP
          </span>
        ) : (
          <span className="text-slate-600 text-xs">0 XP</span>
        )}
      </td>

      {/* 6. Total Validated Team XP */}
      <td className="py-4 px-4 font-mono text-left whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <Zap size={16} className="text-emerald-400 fill-emerald-400/20" />
          <span
            className={`font-black text-emerald-400 tracking-tight ${
              projectorMode ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
            }`}
          >
            {(t.totalXP ?? t.totalScore ?? 0).toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-normal ml-0.5">XP</span>
        </div>
      </td>

      {/* 7. Solved Issues Count & Difficulty Breakdown */}
      <td className="py-4 px-4 font-mono">
        <div className="flex items-center gap-1.5 flex-wrap">
          {easyCount > 0 && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/40 border border-emerald-500/40 text-emerald-400"
              title="Easy (10 pts)"
            >
              {easyCount}E
            </span>
          )}
          {medCount > 0 && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/40 border border-cyan-500/40 text-cyan-400"
              title="Medium (20 pts)"
            >
              {medCount}M
            </span>
          )}
          {hardCount > 0 && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950/40 border border-purple-500/40 text-purple-400"
              title="Hard (30 pts)"
            >
              {hardCount}H
            </span>
          )}
          <span className="text-xs text-slate-200 font-bold ml-1">
            {t.validatedIssueCount ?? solved.length} Solved
          </span>
        </div>
      </td>

      {/* 8. Very Hard Issues Accurately Solved */}
      <td className="py-4 px-4 font-mono whitespace-nowrap">
        {vHardCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/50 border border-rose-500/60 text-rose-400 font-bold text-xs shadow-sm shadow-rose-950/40">
            <Flame size={13} className="text-rose-400 animate-pulse" />
            <span>{vHardCount} Very Hard</span>
          </span>
        ) : (
          <span className="text-xs text-slate-600 font-mono">0 VH</span>
        )}
      </td>

      {/* 9. Registered Team Members */}
      <td className="py-4 px-4 font-mono whitespace-nowrap">
        <div className="inline-flex items-center gap-1.5">
          <span
            className={`font-bold text-xs ${
              validStudentsCount === (t.configuredTeamSize || members.length || 4)
                ? 'text-emerald-400'
                : validStudentsCount > 0
                ? 'text-slate-300'
                : 'text-slate-500'
            }`}
          >
            {validStudentsCount} / {t.configuredTeamSize || members.length || 4} Members
          </span>
          {t.configuredTeamSize === 5 && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-950/50 border border-indigo-500/40 text-indigo-300">
              5-Squad
            </span>
          )}
        </div>
      </td>

      {/* 10. Submission / Grading Status */}
      <td className="py-4 px-4 font-mono whitespace-nowrap">
        {validStudentsCount === (t.configuredTeamSize || members.length || 4) ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 size={12} />
            <span>ALL VALID</span>
          </span>
        ) : validStudentsCount > 0 ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-950/40 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <Clock size={12} />
            <span>PARTIAL ({validStudentsCount}/{t.configuredTeamSize || members.length || 4})</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-500 text-xs">
            <AlertCircle size={12} />
            <span>PENDING PRS</span>
          </span>
        )}
      </td>

      {/* Optional Status for Admin */}
      {showStatus && (
        <td className="py-4 px-4">
          <StatusBadge status={t.active ? 'active' : 'inactive'} size="sm" />
        </td>
      )}
    </tr>
  );
});

export default function LeaderboardTable({
  teams,
  participants,
  projectorMode = false,
  showStatus = false,
  onSelectTeam,
}: LeaderboardTableProps) {
  let displayTeams: Team[] = [];

  if (teams && teams.length > 0) {
    displayTeams = teams;
  } else if (participants && participants.length > 0) {
    displayTeams = participants.map((p, idx) => ({
      id: p.id,
      name: `Squad ${idx + 1}`,
      repositoryId: `squard_${idx + 1}`,
      repositoryName: `squard_${idx + 1}`,
      members: [
        {
          studentId: p.id,
          name: p.name,
          githubUsername: p.githubUsername,
          assignedIssues: [1, 2],
          prSubmitted: true,
        },
      ],
      totalScore: p.totalScore ?? p.xp,
      assignedIssueCount: 4,
      solvedIssues: [],
      validatedIssueCount: p.mergedPRs || 0,
      veryHardSolvedCount: 0,
      prsSubmitted: p.prs || 0,
      active: true,
      rank: p.rank,
      previousRank: p.previousRank,
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: p.updatedAt || new Date().toISOString(),
    }));
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/60 shadow-2xl backdrop-blur-sm">
      <table className="prison-table w-full">
        <thead>
          <tr className="border-b border-slate-800/90 bg-slate-900/60">
            <th className="w-24 text-center font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-3">
              Rank
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
              Repository
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
              Team Name
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-3">
              Earned XP
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-3">
              Bonus XP
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
              Total XP
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
              Correctly Solved
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
              Very Hard Solved
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
              Team Members
            </th>
            <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
              Submission Status
            </th>
            {showStatus && (
              <th className="text-left font-mono text-xs uppercase tracking-wider text-slate-400 py-4 px-4">
                Status
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {displayTeams.map((t) => (
            <TeamLeaderboardRow
              key={t.id}
              team={t}
              projectorMode={projectorMode}
              showStatus={showStatus}
              onSelectTeam={onSelectTeam}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
