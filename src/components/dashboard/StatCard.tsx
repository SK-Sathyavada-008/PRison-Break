// ─────────────────────────────────────────────
// StatCard — Dashboard Metric Card
// ─────────────────────────────────────────────

import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  accent?: 'green' | 'cyan' | 'red' | 'amber' | 'purple' | 'blue';
  delta?: string;
  deltaUp?: boolean;
  subtitle?: string;
}

const ACCENT_MAP = {
  green:  { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  cyan:   { text: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  red:    { text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  amber:  { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  purple: { text: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20' },
  blue:   { text: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
};

export default function StatCard({
  title,
  value,
  icon,
  accent = 'green',
  delta,
  deltaUp,
  subtitle,
}: StatCardProps) {
  const a = ACCENT_MAP[accent] ?? ACCENT_MAP.green;

  return (
    <div className={`card p-5 relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 border ${a.border}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.text} ${a.bg}`}>
          {icon}
        </div>
      </div>

      <div className="text-3xl font-extrabold font-mono text-white tracking-tight mb-1">
        {value}
      </div>

      <div className="flex items-center gap-2 text-xs">
        {delta && (
          <span className={`font-semibold font-mono ${deltaUp ? 'text-emerald-400' : 'text-rose-400'}`}>
            {deltaUp ? '↑' : '↓'} {delta}
          </span>
        )}
        {subtitle && (
          <span className="text-slate-400 text-xs">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
