// ─────────────────────────────────────────────
// TeamDetailModal — Public Team Telemetry & Issue Score Breakdown
// Displays 4-student squad, assigned/solved issues, difficulty breakdown,
// per-issue C/Q/M rubric details, and syllabus grading explanations.
// Strictly hides private student PII, secrets, or internal diagnostics.
// ─────────────────────────────────────────────

import { useEffect } from 'react';
import {
  X,
  ExternalLink,
  Users,
  Shield,
  Zap,
  CheckCircle2,
  FolderGit2,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { Team, SolvedIssue } from '../../types';

interface TeamDetailModalProps {
  team: Team | null;
  isOpen: boolean;
  onClose: () => void;
}

const DIFFICULTY_CONFIG = {
  EASY: {
    label: 'Easy',
    base: 10,
    badge: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400',
    bar: 'bg-emerald-500',
  },
  MEDIUM: {
    label: 'Medium',
    base: 20,
    badge: 'bg-cyan-950/60 border-cyan-500/40 text-cyan-400',
    bar: 'bg-cyan-500',
  },
  HARD: {
    label: 'Hard',
    base: 30,
    badge: 'bg-purple-950/60 border-purple-500/40 text-purple-400',
    bar: 'bg-purple-500',
  },
  VERY_HARD: {
    label: 'Very Hard',
    base: 40,
    badge: 'bg-rose-950/60 border-rose-500/50 text-rose-400',
    bar: 'bg-rose-500',
  },
};

export default function TeamDetailModal({
  team,
  isOpen,
  onClose,
}: TeamDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !team) return null;

  const members = team.members || [];
  const solvedIssues: SolvedIssue[] = team.solvedIssues || [];

  // Difficulty counts & points
  const easySolved = solvedIssues.filter((s) => s.difficulty === 'EASY');
  const medSolved = solvedIssues.filter((s) => s.difficulty === 'MEDIUM');
  const hardSolved = solvedIssues.filter((s) => s.difficulty === 'HARD');
  const vHardSolved = solvedIssues.filter((s) => s.difficulty === 'VERY_HARD');

  const easyPts = easySolved.reduce((sum, s) => sum + (s.points || 0), 0);
  const medPts = medSolved.reduce((sum, s) => sum + (s.points || 0), 0);
  const hardPts = hardSolved.reduce((sum, s) => sum + (s.points || 0), 0);
  const vHardPts = vHardSolved.reduce((sum, s) => sum + (s.points || 0), 0);



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-4xl bg-[#070912] border border-slate-800 rounded-3xl shadow-2xl shadow-black overflow-hidden z-10 my-8 max-h-[90vh] flex flex-col">
        {/* Header Bar */}
        <div className="p-6 sm:p-8 border-b border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-[#0C0E1A] to-slate-900/90 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-black border border-[#FF0A3B]/40 flex items-center justify-center text-[#FF5470] font-mono text-xl font-black shadow-[0_0_25px_rgba(255,10,59,0.25)] shrink-0">
              {team.rankText || `#${team.rank}`}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                  {team.name}
                </h2>
                {team.isTied && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/40">
                    TIED RANK
                  </span>
                )}
                {team.veryHardSolvedCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-950/60 text-rose-400 border border-rose-500/50 flex items-center gap-1 shadow-sm">
                    <Sparkles size={11} />
                    <span>{team.veryHardSolvedCount} Very Hard Solved</span>
                  </span>
                )}
              </div>

              {/* Repository link */}
              <div className="flex items-center gap-3 mt-2 text-xs font-mono">
                <a
                  href={
                    team.repositoryFullName
                      ? `https://github.com/${team.repositoryFullName}`
                      : `https://github.com/PRison-Break-2026/${team.repositoryName}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50 transition-colors font-bold"
                >
                  <FolderGit2 size={13} />
                  <span>{team.repositoryName}</span>
                  <ExternalLink size={12} className="opacity-70" />
                </a>
                <span className="text-slate-500">
                  {members.filter((m) => m.prSubmitted).length} of 4 PRs Submitted
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Total Score Pill */}
            <div className="text-right hidden sm:block">
              <div className="text-xs text-slate-400 font-mono flex items-center justify-end gap-1">
                <Zap size={12} className="text-emerald-400" />
                <span>TOTAL XP</span>
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400">
                {team.totalScore.toLocaleString()} XP
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 flex items-center justify-center transition-colors"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-8 flex-1">
          {/* Section 1: Difficulty Breakdown Cards */}
          <div>
            <h3 className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase mb-3 flex items-center gap-2">
              <Shield size={14} className="text-cyan-400" />
              <span>Issue Difficulty Breakdown (Syllabus Scoring)</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Easy */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center">
                <div className="text-xs font-mono font-bold text-emerald-400 mb-1">
                  EASY (10 pts)
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  {easySolved.length}
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                  +{easyPts} XP earned
                </div>
              </div>

              {/* Medium */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center">
                <div className="text-xs font-mono font-bold text-cyan-400 mb-1">
                  MEDIUM (20 pts)
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  {medSolved.length}
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                  +{medPts} XP earned
                </div>
              </div>

              {/* Hard */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center">
                <div className="text-xs font-mono font-bold text-purple-400 mb-1">
                  HARD (30 pts)
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  {hardSolved.length}
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                  +{hardPts} XP earned
                </div>
              </div>

              {/* Very Hard */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-rose-950/60 text-center">
                <div className="text-xs font-mono font-bold text-rose-400 mb-1">
                  VERY HARD (40 pts)
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  {vHardSolved.length}
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                  +{vHardPts} XP earned
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: 4 Squad Members & Assignments */}
          <div>
            <h3 className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase mb-3 flex items-center gap-2">
              <Users size={14} className="text-[#FF5470]" />
              <span>4 Registered Squad Students</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {members.map((m, idx) => (
                <div
                  key={m.githubUsername || idx}
                  className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-200 text-sm truncate">
                        {m.name || `@${m.githubUsername}`}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-1 pl-7">
                      @{m.githubUsername}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-2 pl-7 flex items-center gap-1.5 flex-wrap">
                      <span>Assigned:</span>
                      {(m.assignedIssues || []).map((num) => (
                        <span
                          key={num}
                          className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-slate-300 text-[10px]"
                        >
                          #{num}
                        </span>
                      ))}
                      {(m.assignedIssues || []).length === 0 && (
                        <span className="text-slate-600">None assigned</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {m.prSubmitted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-semibold">
                        <CheckCircle2 size={12} />
                        <span>PR #{m.prNumber || 'Done'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-950/40 border border-amber-500/30 text-amber-400 text-xs font-mono">
                        <Clock size={12} />
                        <span>Working Offline</span>
                      </span>
                    )}
                    {m.score !== undefined && m.score > 0 && (
                      <div className="text-xs font-mono text-slate-400 mt-1">
                        +{m.score} pts
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Per-Issue Score Breakdown Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Validated Issue Scores & Grading Evidence</span>
              </h3>
              <span className="text-xs font-mono text-slate-500">
                Formula: Base × (0.70C + 0.20Q + 0.10M)
              </span>
            </div>

            {solvedIssues.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/30 border border-slate-800/80 text-center font-mono text-xs text-slate-500">
                No issues validated for this squad yet. When students submit PRs after restoring Wi-Fi, their scores and rubric breakdown will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/40">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                      <th className="py-3 px-4">Issue</th>
                      <th className="py-3 px-4">Difficulty</th>
                      <th className="py-3 px-4">Solved By</th>
                      <th className="py-3 px-4 text-center">Correctness (70%)</th>
                      <th className="py-3 px-4 text-center">Quality (20%)</th>
                      <th className="py-3 px-4 text-center">Commits (10%)</th>
                      <th className="py-3 px-4 text-right">Awarded</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {solvedIssues.map((issue) => {
                      const diffCfg =
                        DIFFICULTY_CONFIG[issue.difficulty] || DIFFICULTY_CONFIG.EASY;
                      return (
                        <tr key={issue.issueNumber} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-white">
                            #{issue.issueNumber}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${diffCfg.badge}`}
                            >
                              {diffCfg.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">
                            @{issue.solvedByUsername}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-emerald-400">
                            {issue.correctnessScore !== undefined
                              ? `${Math.round(issue.correctnessScore * 100)}%`
                              : '100%'}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-cyan-400">
                            {issue.codeQualityScore !== undefined
                              ? `${Math.round(issue.codeQualityScore * 100)}%`
                              : '100%'}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-purple-400">
                            {issue.commitQualityScore !== undefined
                              ? `${Math.round(issue.commitQualityScore * 100)}%`
                              : '100%'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-emerald-400">
                            +{issue.points} XP
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                              <CheckCircle2 size={12} className="text-emerald-400" />
                              <span>{issue.prStatus || 'Validated'}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-xs font-mono text-slate-500 shrink-0">
          <span>Registered Repository: {team.repositoryName}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
          >
            Close View
          </button>
        </div>
      </div>
    </div>
  );
}
