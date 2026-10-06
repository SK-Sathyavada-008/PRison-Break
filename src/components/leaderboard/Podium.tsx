// ─────────────────────────────────────────────
// Podium — NØLL Digital Void Top Escapees
// Minimalist, Atmospheric Neon Cyber Pedestals
// ─────────────────────────────────────────────

import { Zap, GitMerge, ExternalLink, Terminal } from 'lucide-react';
import type { Participant } from '../../types';

interface PodiumProps {
  participants: Participant[];
}

interface PodiumCardProps {
  participant: Participant;
  position: 1 | 2 | 3;
}

const PODIUM_STYLES = {
  1: {
    label: 'SECTOR APEX // #1',
    rankText: 'text-[#FF1E46]',
    border: 'border-[#FF1E46]/40 hover:border-[#FF1E46]',
    bg: 'bg-gradient-to-b from-[#FF1E46]/10 via-[#0B0D18]/90 to-[#07080E]',
    glow: '0 0 35px rgba(255, 30, 70, 0.2)',
    badgeBg: 'bg-[#FF1E46]/15 border-[#FF1E46]/40 text-[#FF5470]',
    ring: 'ring-2 ring-[#FF1E46]/60',
    orderClass: 'order-1 sm:order-2 z-20 sm:-mt-6',
  },
  2: {
    label: 'ESCAPEE // #2',
    rankText: 'text-slate-200',
    border: 'border-slate-600/40 hover:border-slate-400',
    bg: 'bg-gradient-to-b from-slate-600/10 via-[#0B0D18]/90 to-[#07080E]',
    glow: '0 0 25px rgba(148, 163, 184, 0.08)',
    badgeBg: 'bg-slate-800 border-slate-700 text-slate-300',
    ring: 'ring-2 ring-slate-400/40',
    orderClass: 'order-2 sm:order-1 z-10 sm:mt-4',
  },
  3: {
    label: 'ESCAPEE // #3',
    rankText: 'text-amber-500',
    border: 'border-amber-600/30 hover:border-amber-500',
    bg: 'bg-gradient-to-b from-amber-600/10 via-[#0B0D18]/90 to-[#07080E]',
    glow: '0 0 25px rgba(245, 158, 11, 0.08)',
    badgeBg: 'bg-amber-950/40 border-amber-800/40 text-amber-400',
    ring: 'ring-2 ring-amber-500/40',
    orderClass: 'order-3 z-10 sm:mt-8',
  },
};

function PodiumCard({ participant, position }: PodiumCardProps) {
  const cfg = PODIUM_STYLES[position];

  return (
    <div className={`flex-1 min-w-[280px] max-w-[420px] ${cfg.orderClass} transition-all duration-300 hover:-translate-y-2`}>
      <div
        className={`relative rounded-3xl border ${cfg.border} ${cfg.bg} p-8 sm:p-9 text-center flex flex-col items-center backdrop-blur-xl shadow-2xl`}
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
        <div className={`mt-2 mb-5 inline-flex items-center px-3.5 py-1 rounded-full text-xs font-mono tracking-widest font-semibold border ${cfg.badgeBg}`}>
          {cfg.label}
        </div>

        {/* Avatar */}
        <div className="relative mb-5">
          {participant.avatarUrl ? (
            <img
              src={participant.avatarUrl}
              alt={participant.name}
              className={`w-24 h-24 rounded-full object-cover ${cfg.ring} bg-slate-900 shadow-xl`}
            />
          ) : (
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold ${cfg.ring} bg-slate-900 text-white font-mono shadow-xl`}>
              {participant.name[0]}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#05060A] border-2 border-slate-700 flex items-center justify-center text-xs font-mono font-extrabold text-white shadow-md">
            #{position}
          </span>
        </div>

        {/* Prisoner Name */}
        <h3 className="text-lg font-bold text-white tracking-tight truncate max-w-full px-2">
          {participant.name}
        </h3>

        {/* GitHub handle */}
        <a
          href={`https://github.com/${participant.githubUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-400 hover:text-[#FF1E46] flex items-center gap-1 font-mono transition-colors mt-1 mb-7"
        >
          @{participant.githubUsername}
          <ExternalLink size={12} />
        </a>

        {/* Stats Row */}
        <div className="w-full grid grid-cols-2 gap-4 pt-5 border-t border-slate-800/80">
          <div className="bg-[#070912]/80 rounded-2xl py-3.5 px-3 border border-slate-800/80 text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-1 font-mono">
              <Zap size={12} className="text-[#FF1E46]" />
              <span>XP SCORE</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {participant.xp.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#070912]/80 rounded-2xl py-3.5 px-3 border border-slate-800/80 text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-1 font-mono">
              <GitMerge size={12} className="text-purple-400" />
              <span>MERGES</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {participant.mergedPRs}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Podium({ participants }: PodiumProps) {
  const top3 = participants.slice(0, 3);
  if (top3.length === 0) return null;

  return (
    <div className="w-full flex flex-col sm:flex-row items-center sm:items-end justify-center gap-8 sm:gap-10 lg:gap-14 px-2 py-8">
      {top3[1] && <PodiumCard participant={top3[1]} position={2} />}
      {top3[0] && <PodiumCard participant={top3[0]} position={1} />}
      {top3[2] && <PodiumCard participant={top3[2]} position={3} />}
    </div>
  );
}
