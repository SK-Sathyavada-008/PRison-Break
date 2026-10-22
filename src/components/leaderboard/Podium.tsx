// ─────────────────────────────────────────────
// Podium — NØLL Digital Void Top Squads
// Minimalist, Atmospheric Neon Cyber Pedestals for Top 3 Teams
// ─────────────────────────────────────────────

import { Zap, GitMerge, ExternalLink, Terminal, Users, CheckCircle2 } from 'lucide-react';
import type { Team, Participant } from '../../types';

interface PodiumProps {
  teams?: Team[];
  participants?: Participant[]; // Backward compatibility
}

interface PodiumCardProps {
  team: Team;
  position: 1 | 2 | 3;
}

const PODIUM_STYLES = {
  1: {
    label: 'SECTOR APEX // SQUAD #1',
    rankText: 'text-[#FF1E46]',
    border: 'border-[#FF1E46]/40 hover:border-[#FF1E46]',
    bg: 'bg-gradient-to-b from-[#FF1E46]/10 via-[#0B0D18]/90 to-[#07080E]',
    glow: '0 0 35px rgba(255, 30, 70, 0.2)',
    badgeBg: 'bg-[#FF1E46]/15 border-[#FF1E46]/40 text-[#FF5470]',
    ring: 'ring-2 ring-[#FF1E46]/60',
    orderClass: 'order-1 sm:order-2 z-20 sm:-mt-6',
  },
  2: {
    label: 'SQUAD // #2',
    rankText: 'text-slate-200',
    border: 'border-slate-600/40 hover:border-slate-400',
    bg: 'bg-gradient-to-b from-slate-600/10 via-[#0B0D18]/90 to-[#07080E]',
    glow: '0 0 25px rgba(148, 163, 184, 0.08)',
    badgeBg: 'bg-slate-800 border-slate-700 text-slate-300',
    ring: 'ring-2 ring-slate-400/40',
    orderClass: 'order-2 sm:order-1 z-10 sm:mt-4',
  },
  3: {
    label: 'SQUAD // #3',
    rankText: 'text-amber-500',
    border: 'border-amber-600/30 hover:border-amber-500',
    bg: 'bg-gradient-to-b from-amber-600/10 via-[#0B0D18]/90 to-[#07080E]',
    glow: '0 0 25px rgba(245, 158, 11, 0.08)',
    badgeBg: 'bg-amber-950/40 border-amber-800/40 text-amber-400',
    ring: 'ring-2 ring-amber-500/40',
    orderClass: 'order-3 z-10 sm:mt-8',
  },
};

function PodiumCard({ team, position }: PodiumCardProps) {
  const cfg = PODIUM_STYLES[position];
  const members = team.members || [];

  return (
    <div className={`flex-1 min-w-[290px] max-w-[420px] ${cfg.orderClass} transition-all duration-300 hover:-translate-y-2`}>
      <div
        className={`relative rounded-3xl border ${cfg.border} ${cfg.bg} p-7 sm:p-8 text-center flex flex-col items-center backdrop-blur-xl shadow-2xl`}
        style={{ boxShadow: cfg.glow }}
      >
        {/* Terminal Glitch Eye Indicator for 1st place */}
        {position === 1 && (
          <div className="absolute -top-4 px-4 py-1.5 rounded-full bg-[#FF1E46] text-white font-mono font-bold text-xs tracking-wider flex items-center gap-2 shadow-lg shadow-[#FF1E46]/50">
            <Terminal size={13} className="stroke-[2.5]" />
            <span>BREACH LEADER</span>
          </div>
        )}

        {/* Position rank pill */}
        <div className={`mt-2 mb-4 inline-flex items-center px-3.5 py-1 rounded-full text-xs font-mono tracking-widest font-semibold border ${cfg.badgeBg}`}>
          {cfg.label}
        </div>

        {/* Repository Shield Badge */}
        <div className="relative mb-4">
          <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-mono font-black text-2xl ${cfg.ring} bg-slate-950 text-white shadow-xl border border-slate-800`}>
            <span>&gt;_</span>
            <span className="text-[10px] text-slate-400 tracking-wider">TEAM</span>
          </div>
          <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#05060A] border-2 border-slate-700 flex items-center justify-center text-xs font-mono font-extrabold text-white shadow-md">
            #{position}
          </span>
        </div>

        {/* Squad Name */}
        <h3 className="text-xl font-black text-white tracking-tight truncate max-w-full px-2 font-mono">
          {team.name}
        </h3>

        {/* Repository Handle */}
        <a
          href={team.repositoryFullName ? `https://github.com/${team.repositoryFullName}` : `https://github.com/PRison-Break-2026/${team.repositoryName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-400 hover:text-[#FF1E46] flex items-center gap-1 font-mono transition-colors mt-1 mb-4"
        >
          <span>repo: {team.repositoryName}</span>
          <ExternalLink size={12} />
        </a>

        {/* 4 Registered Students Roster */}
        <div className="w-full bg-[#070912]/80 rounded-2xl p-3 border border-slate-800/80 mb-5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2 px-1">
            <span className="flex items-center gap-1">
              <Users size={12} className="text-cyan-400" />
              <span>4 SQUAD MEMBERS</span>
            </span>
            <span className="text-slate-500">{members.filter(m => m.prSubmitted).length}/4 PRs</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-left">
            {members.slice(0, 4).map((m, idx) => (
              <div
                key={m.githubUsername || idx}
                className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60 text-[11px] font-mono text-slate-300 truncate"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[9px] text-slate-400 shrink-0">
                    {idx + 1}
                  </span>
                  <span className="truncate text-slate-200">@{m.githubUsername}</span>
                </div>
                {m.prSubmitted ? (
                  <span title="PR Submitted" className="shrink-0 flex items-center">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-500/40 shrink-0" title="Coding Offline" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        <div className="w-full grid grid-cols-2 gap-3 pt-4 border-t border-slate-800/80">
          <div className="bg-[#070912]/80 rounded-2xl py-3 px-2 border border-slate-800/80 text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-0.5 font-mono">
              <Zap size={12} className="text-[#FF1E46]" />
              <span>TEAM SCORE</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {team.totalScore.toLocaleString()} XP
            </div>
          </div>

          <div className="bg-[#070912]/80 rounded-2xl py-3 px-2 border border-slate-800/80 text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-0.5 font-mono">
              <GitMerge size={12} className="text-purple-400" />
              <span>ISSUES SOLVED</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {team.validatedIssueCount || team.solvedIssues?.length || 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Podium({ teams, participants }: PodiumProps) {
  // Support team list directly or convert participants for fallback
  let displayTeams: Team[] = [];

  if (teams && teams.length > 0) {
    displayTeams = teams.slice(0, 3);
  } else if (participants && participants.length > 0) {
    // Adapter fallback if only participants are passed
    displayTeams = participants.slice(0, 3).map((p, idx) => ({
      id: p.id,
      name: p.name,
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

  if (displayTeams.length === 0) return null;

  return (
    <div className="w-full flex flex-col sm:flex-row items-center sm:items-end justify-center gap-8 sm:gap-10 lg:gap-14 px-2 py-8">
      {displayTeams[1] && <PodiumCard team={displayTeams[1]} position={2} />}
      {displayTeams[0] && <PodiumCard team={displayTeams[0]} position={1} />}
      {displayTeams[2] && <PodiumCard team={displayTeams[2]} position={3} />}
    </div>
  );
}
