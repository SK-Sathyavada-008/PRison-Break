// ─────────────────────────────────────────────
// StatusBadge — Clean Reusable Status Pill
// ─────────────────────────────────────────────

import type { PRStatus, ParticipantStatus, RepositoryStatus, TestStatus } from '../../types';

type StatusValue = PRStatus | ParticipantStatus | RepositoryStatus | TestStatus | string;

interface StatusBadgeProps {
  status: StatusValue;
  size?: 'sm' | 'md';
}

const CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  // PR statuses & Processing states
  merged:         { label: 'Merged',          color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30', dot: 'bg-emerald-400' },
  open:           { label: 'Open',            color: 'text-blue-300 bg-blue-500/15 border-blue-500/30',          dot: 'bg-blue-400' },
  closed:         { label: 'Closed',          color: 'text-slate-300 bg-slate-500/15 border-slate-500/30',       dot: 'bg-slate-400' },
  flagged:        { label: 'Flagged',         color: 'text-rose-300 bg-rose-500/15 border-rose-500/30',          dot: 'bg-rose-400' },
  pending:        { label: 'Pending',         color: 'text-amber-300 bg-amber-500/15 border-amber-500/30',       dot: 'bg-amber-400' },
  auto_approved:  { label: 'AUTO-APPROVED',   color: 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40', dot: 'bg-emerald-400' },
  pending_review: { label: 'PENDING REVIEW',  color: 'text-amber-300 bg-amber-500/20 border-amber-500/40',       dot: 'bg-amber-400' },
  rejected:       { label: 'REJECTED',        color: 'text-rose-300 bg-rose-500/20 border-rose-500/40',          dot: 'bg-rose-400' },
  force_merged:   { label: 'FORCE MERGED',    color: 'text-purple-300 bg-purple-500/20 border-purple-500/40',    dot: 'bg-purple-400' },

  // Participant statuses
  active:   { label: 'Active',   color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30', dot: 'bg-emerald-400' },
  inactive: { label: 'Inactive', color: 'text-slate-300 bg-slate-500/15 border-slate-500/30',       dot: 'bg-slate-400' },
  escaped:  { label: 'Escaped',  color: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30',          dot: 'bg-cyan-400' },

  // Repo statuses
  archived: { label: 'Archived', color: 'text-purple-300 bg-purple-500/15 border-purple-500/30', dot: 'bg-purple-400' },

  // Test statuses
  passing:  { label: 'Passing',  color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30', dot: 'bg-emerald-400' },
  failing:  { label: 'Failing',  color: 'text-rose-300 bg-rose-500/15 border-rose-500/30',          dot: 'bg-rose-400' },
  skipped:  { label: 'Skipped',  color: 'text-slate-300 bg-slate-500/15 border-slate-500/30',       dot: 'bg-slate-400' },

  // Webhook statuses
  processed: { label: 'PROCESSED', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30', dot: 'bg-emerald-400' },
  ignored:   { label: 'IGNORED',   color: 'text-amber-300 bg-amber-500/15 border-amber-500/30',       dot: 'bg-amber-400' },
  failed:    { label: 'FAILED',    color: 'text-rose-300 bg-rose-500/15 border-rose-500/30',          dot: 'bg-rose-400' },
  received:  { label: 'RECEIVED',  color: 'text-blue-300 bg-blue-500/15 border-blue-500/30',          dot: 'bg-blue-400' },
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const cfg = CONFIG[status.toLowerCase()] ?? {
    label: status,
    color: 'text-slate-300 bg-slate-500/15 border-slate-500/30',
    dot: 'bg-slate-400',
  };

  const padding = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${padding} ${cfg.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
