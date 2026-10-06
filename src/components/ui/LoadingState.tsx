// ─────────────────────────────────────────────
// LoadingState — animated loading skeleton
// ─────────────────────────────────────────────

interface LoadingStateProps {
  rows?: number;
  message?: string;
}

export default function LoadingState({ rows = 5, message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="p-6 space-y-3">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow" />
        <span className="font-mono text-xs text-emerald-400/60 tracking-widest uppercase">{message}</span>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-11 rounded-lg animate-pulse"
          style={{
            background: `linear-gradient(90deg, #0a0f1a 0%, #0f1e2e ${50 + i * 5}%, #0a0f1a 100%)`,
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}
