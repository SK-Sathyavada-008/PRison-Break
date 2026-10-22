// ─────────────────────────────────────────────
// ScoreTransparencyCard — Participant-Friendly Grading Breakdown
// Displays difficulty, maximum points, component scores (C, Q, M),
// weighted contributions, tests passed/failed, human review adjustments,
// and beginner syllabus grading explanations.
// Strictly omits hidden grader secrets or internal diagnostics.
// ─────────────────────────────────────────────

import { CheckCircle2, XCircle, Shield, Award, Edit3 } from 'lucide-react';
import type { IssueGradingRecord } from '../../types';

interface ScoreTransparencyCardProps {
  record: IssueGradingRecord;
  studentUsername?: string;
}

const DIFFICULTY_METRICS = {
  EASY: { label: 'Easy', base: 10, badge: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-400' },
  MEDIUM: { label: 'Medium', base: 20, badge: 'border-cyan-500/40 bg-cyan-950/40 text-cyan-400' },
  HARD: { label: 'Hard', base: 30, badge: 'border-purple-500/40 bg-purple-950/40 text-purple-400' },
  VERY_HARD: { label: 'Very Hard', base: 40, badge: 'border-rose-500/50 bg-rose-950/40 text-rose-400' },
};

export default function ScoreTransparencyCard({ record, studentUsername }: ScoreTransparencyCardProps) {
  const diffCfg = DIFFICULTY_METRICS[record.difficulty] || DIFFICULTY_METRICS.EASY;
  const basePoints = record.basePoints || diffCfg.base;

  // Calculate weighted contributions
  const cScore = record.rawComponentScores?.correctness ?? 1.0;
  const qScore = record.rawComponentScores?.codeQuality ?? 1.0;
  const mScore = record.rawComponentScores?.commitQuality ?? 1.0;

  const cContrib = Math.round(basePoints * 0.70 * cScore * 100) / 100;
  const qContrib = Math.round(basePoints * 0.20 * qScore * 100) / 100;
  const mContrib = Math.round(basePoints * 0.10 * mScore * 100) / 100;

  const testsPassed = record.evidence?.testsPassed ?? (record.evidence?.compilationPassed ? 10 : 0);
  const totalTests = record.evidence?.totalTests ?? 10;
  const testsFailed = record.evidence?.testsFailed ?? Math.max(0, totalTests - testsPassed);

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0B0D18]/90 p-5 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-base font-black text-white">
              Issue #{record.issueNumber}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${diffCfg.badge}`}>
              {diffCfg.label} · Max {basePoints} pts
            </span>
            {record.configVersion && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-700 text-slate-400">
                Rubric v{record.configVersion}
              </span>
            )}
          </div>
          {studentUsername && (
            <p className="text-xs font-mono text-slate-400 mt-1">
              Solved by @{studentUsername}
            </p>
          )}
        </div>

        {/* Awarded Points Badge */}
        <div className="text-right">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            Awarded Score
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {record.awardedPoints} <span className="text-sm font-normal text-slate-400">/ {basePoints} pts</span>
          </div>
        </div>
      </div>

      {/* 3 Component Score Contributions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Correctness */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-emerald-400 font-bold">1. Correctness (70%)</span>
            <span className="font-bold text-white">{Math.round(cScore * 100)}%</span>
          </div>
          <div className="text-lg font-black font-mono text-emerald-400">
            +{cContrib} <span className="text-xs font-normal text-slate-400">pts</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1 pt-1">
            {testsFailed === 0 ? (
              <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
            ) : (
              <XCircle size={12} className="text-rose-400 shrink-0" />
            )}
            <span>{testsPassed}/{totalTests} unit tests passed</span>
          </div>
        </div>

        {/* Code Quality */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-cyan-400 font-bold">2. Code Quality (20%)</span>
            <span className="font-bold text-white">{Math.round(qScore * 100)}%</span>
          </div>
          <div className="text-lg font-black font-mono text-cyan-400">
            +{qContrib} <span className="text-xs font-normal text-slate-400">pts</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1 pt-1">
            <Shield size={12} className="text-cyan-400 shrink-0" />
            <span>Beginner Java syllabus quality</span>
          </div>
        </div>

        {/* Commit Quality */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-purple-400 font-bold">3. Commit Quality (10%)</span>
            <span className="font-bold text-white">{Math.round(mScore * 100)}%</span>
          </div>
          <div className="text-lg font-black font-mono text-purple-400">
            +{mContrib} <span className="text-xs font-normal text-slate-400">pts</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1 pt-1">
            <Award size={12} className="text-purple-400 shrink-0" />
            <span>Verified commit attribution</span>
          </div>
        </div>
      </div>

      {/* Participant-Friendly Grading Explanation */}
      <div className="rounded-xl bg-slate-950/80 border border-slate-800/80 p-3 text-xs font-mono space-y-2">
        <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
          Grading Explanation & Feedback
        </div>
        <p className="text-slate-200 leading-relaxed">
          {record.gradingExplanation}
        </p>

        {/* Deductions breakdown if any */}
        {(record.deductions?.correctness?.length > 0 ||
          record.deductions?.codeQuality?.length > 0 ||
          record.deductions?.commitQuality?.length > 0) && (
          <div className="pt-2 border-t border-slate-800 text-[11px] space-y-1 text-amber-400">
            <div className="font-bold">Itemized Deductions:</div>
            {[
              ...(record.deductions?.correctness || []),
              ...(record.deductions?.codeQuality || []),
              ...(record.deductions?.commitQuality || []),
            ].map((d, i) => (
              <div key={i} className="pl-2">
                • {d}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Human Review Adjustment if any */}
      {record.humanReviewAdjustment && (
        <div className="rounded-xl bg-purple-950/30 border border-purple-500/40 p-3 text-xs font-mono text-purple-200 flex items-start gap-2.5">
          <Edit3 size={15} className="text-purple-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-white">
              Organizer Adjustment by @{record.humanReviewAdjustment.adminUsername}
            </div>
            <p className="text-slate-300 text-[11px] mt-0.5">
              Reason: "{record.humanReviewAdjustment.reason}"
            </p>
            <div className="text-[10px] text-purple-400 mt-1">
              Score revised: {record.humanReviewAdjustment.previousScore} pts →{' '}
              <span className="font-bold text-white">
                {record.humanReviewAdjustment.newScore} pts
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
