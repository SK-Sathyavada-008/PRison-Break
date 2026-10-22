// ─────────────────────────────────────────────
// PullRequestTable — Clean Admin PR List
// ─────────────────────────────────────────────

import { ExternalLink, Hash, Calendar, ShieldAlert } from 'lucide-react';
import type { PullRequest } from '../../types';
import StatusBadge from '../ui/StatusBadge';

interface PullRequestTableProps {
  pullRequests: PullRequest[];
  onInspect?: (pr: PullRequest) => void;
}

export default function PullRequestTable({ pullRequests, onInspect }: PullRequestTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="prison-table">
        <thead>
          <tr>
            <th className="w-20">PR #</th>
            <th>Title</th>
            <th>Repository</th>
            <th>Author</th>
            <th>Issue</th>
            <th>Status</th>
            <th>Tests</th>
            <th>Score</th>
            <th>Date</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {pullRequests.map((pr) => (
            <tr key={pr.id} className="hover:bg-slate-800/40 transition-colors">
              {/* PR Number */}
              <td>
                <div className="flex items-center gap-1 font-mono font-bold text-emerald-400 text-xs">
                  <span>#{pr.number}</span>
                  {pr.url && (
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-white transition-colors"
                    >
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </td>

              {/* Title */}
              <td>
                <span className="text-sm font-medium text-slate-100 hover:text-white line-clamp-1 max-w-sm xl:max-w-md block" title={pr.title}>
                  {pr.title}
                </span>
              </td>

              {/* Repository */}
              <td>
                <span className="font-mono text-xs text-slate-300 bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 rounded-md">
                  {pr.repository}
                </span>
              </td>

              {/* Author */}
              <td>
                <div>
                  <div className="text-xs font-semibold text-slate-200">{pr.author}</div>
                  <div className="font-mono text-[11px] text-slate-400">@{pr.githubUsername}</div>
                </div>
              </td>

              {/* Issue & Multiple Issues */}
              <td>
                <div className="space-y-1">
                  {pr.solvedIssueNumbers && pr.solvedIssueNumbers.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {pr.solvedIssueNumbers.map((num) => (
                        <span key={num} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[11px] font-bold">
                          <Hash size={10} />{num}
                        </span>
                      ))}
                    </div>
                  ) : pr.issueNumber ? (
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-amber-400 font-bold">
                      <Hash size={11} /> {pr.issueNumber}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}

                  {(pr.hasMultiplePRViolation || pr.duplicateSubmissionWarning) && (
                    <span className="inline-block px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-[9px] font-bold uppercase">
                      Duplicate PR
                    </span>
                  )}
                </div>
              </td>

              {/* Status & Validation Checks */}
              <td>
                <div className="space-y-0.5">
                  <StatusBadge status={pr.status} />
                  {pr.validationChecks && (
                    <div className="text-[10px] font-mono text-slate-500">
                      {[
                        pr.validationChecks.participantRegistered,
                        pr.validationChecks.repositoryRegistered,
                        pr.validationChecks.issueValid,
                        pr.validationChecks.testsPassed,
                        pr.validationChecks.filesValid,
                      ].filter(Boolean).length}/5 checks pass
                    </div>
                  )}
                </div>
              </td>

              {/* Tests */}
              <td>
                <StatusBadge status={pr.testStatus} />
              </td>

              {/* Score */}
              <td>
                <span className={`font-mono text-sm font-bold ${pr.score > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {pr.score > 0 ? `+${pr.score}` : '0'}
                </span>
              </td>

              {/* Created */}
              <td>
                <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-400">
                  <Calendar size={11} className="text-slate-500" />
                  {new Date(pr.createdAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </td>

              {/* Actions */}
              <td className="text-right">
                <button
                  onClick={() => onInspect?.(pr)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-slate-700 hover:border-emerald-500/40 font-mono text-[11px] transition-all"
                  title="Inspect PR and review scoring"
                >
                  <ShieldAlert size={12} />
                  <span>Review</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
