// ─────────────────────────────────────────────
// EmptyState — Clean Minimalist Placeholder
// ─────────────────────────────────────────────

import { LockKeyhole } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export default function EmptyState({
  title = 'No Data Found',
  description = 'Nothing to display here yet.',
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="w-full flex flex-col items-center justify-center py-24 sm:py-32 px-6 sm:px-12 text-center">
      <div className="relative mb-8">
        {/* Pulsing cyber ring */}
        <div className="absolute -inset-4 rounded-3xl bg-[#FF0A3B]/10 blur-xl animate-pulse" />
        <div className="relative w-20 h-20 rounded-2xl bg-black/80 border border-[#FF0A3B]/50 flex items-center justify-center text-[#FF1E46] shadow-[0_0_35px_rgba(255,10,59,0.35)]">
          {icon ?? <LockKeyhole size={32} />}
        </div>
      </div>
      <h3 className="font-mono text-lg sm:text-xl font-bold text-white tracking-widest uppercase mb-3">
        {title}
      </h3>
      <p className="text-slate-400 font-mono text-xs sm:text-sm max-w-lg leading-relaxed text-center">
        {description}
      </p>
      {action && <div className="mt-10">{action}</div>}
    </div>
  );
}
