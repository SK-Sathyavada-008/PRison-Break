// ─────────────────────────────────────────────
// Admin Dashboard Page — Team-Based Event Command Center
// Displays 14 event telemetry metrics, multi-dimensional filters,
// team-level grading breakdown, and immutable score audit trail.
// ─────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Folder,
  GitPullRequest,
  Clock,
  AlertTriangle,
  Zap,
  Trophy,
  CheckCircle2,
  XCircle,
  FileCode,
  Flame,
  Search,
  Filter,
  History,
  ExternalLink,
} from 'lucide-react';
import StatCard from '../../components/dashboard/StatCard';
import type {
  ScoreEvent,
  Participant,
  Repository,
  PullRequest,
  Team,
  AdminAuditLog,
} from '../../types';
import { participantService } from '../../services/participantService';
import { repositoryService } from '../../services/repositoryService';
import { pullRequestService } from '../../services/pullRequestService';
import { scoreEventService } from '../../services/scoreEventService';
import { teamService } from '../../services/teamService';
import { auditLogService } from '../../services/auditLogService';
import { Link } from 'react-router-dom';
import LoadingState from '../../components/ui/LoadingState';

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterTeam, setFilterTeam] = useState<string>('ALL');
  const [filterRepo, setFilterRepo] = useState<string>('ALL');
  const [filterStudent, setFilterStudent] = useState<string>('');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('ALL');
  const [filterPRStatus, setFilterPRStatus] = useState<string>('ALL');
  const [filterGradingStatus, setFilterGradingStatus] = useState<string>('ALL');

  useEffect(() => {
    setLoading(true);
    let count = 0;
    const markLoaded = () => {
      count++;
      if (count >= 2) setLoading(false);
    };

    const unsubTeams = teamService.subscribeToTeamsLeaderboard((data) => {
      setTeams(data);
      markLoaded();
    });

    const unsubParticipants = participantService.subscribeToLeaderboard((data) => {
      setParticipants(data);
      markLoaded();
    });

    const unsubRepos = repositoryService.subscribeToRepositories((data) => {
      setRepositories(data);
      markLoaded();
    });

    const unsubPRs = pullRequestService.subscribeToPullRequests((data) => {
      setPullRequests(data);
    });

    const unsubEvents = scoreEventService.subscribeToScoreEvents((data) => {
      setScoreEvents(data);
    });

    const unsubAudit = auditLogService.subscribeToAuditLogs((data) => {
      setAuditLogs(data);
    });

    return () => {
      unsubTeams();
      unsubParticipants();
      unsubRepos();
      unsubPRs();
      unsubEvents();
      unsubAudit();
    };
  }, []);

  // 14 Core Telemetry Metrics for Admin Overview
  const totalTeams = teams.length;
  const allMembers = useMemo(() => teams.flatMap((t) => t.members || []), [teams]);
  const totalRegisteredStudents = allMembers.length || participants.length;
  const totalRepositories = repositories.length || teams.length;

  const totalAssignedIssues = useMemo(() => {
    return teams.reduce(
      (sum, t) => sum + (t.assignedIssueCount || (t.members || []).flatMap((m) => m.assignedIssues).length),
      0
    );
  }, [teams]);

  const totalPRsReceived = pullRequests.length;
  const studentsWithValidPRs = useMemo(
    () => allMembers.filter((m) => m.prSubmitted).length,
    [allMembers]
  );
  const studentsMissingSubmissions = Math.max(0, totalRegisteredStudents - studentsWithValidPRs);

  const issuesAwaitingGrading = useMemo(
    () =>
      pullRequests.filter(
        (p) =>
          p.status === 'pending' ||
          (p as any).processingState === 'PENDING_REVIEW' ||
          (p.status === 'open' && !p.merged)
      ).length,
    [pullRequests]
  );

  const successfullyGradedIssues = useMemo(
    () =>
      teams.reduce(
        (sum, t) => sum + (t.validatedIssueCount ?? t.solvedIssues?.length ?? 0),
        0
      ),
    [teams]
  );

  const failedCorrectnessChecks = useMemo(
    () =>
      pullRequests.filter(
        (p) =>
          (p as any).attributionWarnings?.length > 0 ||
          (p as any).hasMultiplePRViolation ||
          p.status === 'flagged'
      ).length,
    [pullRequests]
  );

  const pendingManualReviews = useMemo(
    () =>
      pullRequests.filter(
        (p) =>
          p.status === 'pending' ||
          p.status === 'flagged' ||
          (p as any).processingState === 'PENDING_REVIEW'
      ).length,
    [pullRequests]
  );

  const duplicateOrInvalidSubmissions = useMemo(
    () =>
      pullRequests.filter(
        (p) => (p as any).hasMultiplePRViolation || (p as any).isDraft || p.status === 'flagged'
      ).length,
    [pullRequests]
  );

  const veryHardAccuratelySolved = useMemo(
    () => teams.reduce((sum, t) => sum + (t.veryHardSolvedCount || 0), 0),
    [teams]
  );

  const teamScoreTotals = useMemo(
    () => teams.reduce((sum, t) => sum + (t.totalScore || 0), 0),
    [teams]
  );

  // Filtered Teams for the Team-Level Grading Breakdown
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (filterTeam !== 'ALL' && t.id !== filterTeam) return false;
      if (filterRepo !== 'ALL' && t.repositoryName !== filterRepo) return false;
      if (filterStudent.trim()) {
        const q = filterStudent.toLowerCase().trim();
        const hasStudent = (t.members || []).some(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.githubUsername.toLowerCase().includes(q)
        );
        if (!hasStudent) return false;
      }
      if (filterDifficulty !== 'ALL') {
        const hasDiff = (t.solvedIssues || []).some(
          (s) => s.difficulty === filterDifficulty
        );
        if (!hasDiff) return false;
      }
      if (filterPRStatus !== 'ALL') {
        const submitted = (t.members || []).filter((m) => m.prSubmitted).length;
        if (filterPRStatus === 'ALL_VALID' && submitted !== 4) return false;
        if (filterPRStatus === 'PARTIAL' && (submitted === 0 || submitted === 4)) return false;
        if (filterPRStatus === 'PENDING' && submitted !== 0) return false;
      }
      return true;
    });
  }, [teams, filterTeam, filterRepo, filterStudent, filterDifficulty, filterPRStatus]);

  if (loading) {
    return (
      <div className="p-8">
        <LoadingState message="BOOTING DASHBOARD TELEMETRY..." />
      </div>
    );
  }

  return (
    <div className="space-y-10 sm:space-y-12 stagger-children">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100 tracking-wide mb-1 flex items-center gap-3">
            <span>Admin Command Center</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FF1E46]/10 text-[#FF5470] border border-[#FF1E46]/40">
              OFFLINE EVENT
            </span>
          </h1>
          <p className="font-mono text-xs text-slate-400">
            Authoritative event telemetry, offline PR verification, and grading audit ledger
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/leaderboard"
            className="btn btn-primary flex items-center gap-2 text-xs font-mono"
          >
            <Trophy size={14} />
            <span>Squad Leaderboard</span>
          </Link>
          <Link
            to="/"
            target="_blank"
            className="btn btn-ghost flex items-center gap-1.5 text-xs font-mono"
          >
            <ExternalLink size={13} />
            <span>Public View</span>
          </Link>
        </div>
      </div>

      {/* Telemetry Sections */}
      <div className="space-y-8">
        {/* Section 1: Executive Headline Metrics */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Zap size={14} className="text-[#FF1E46]" />
              <span>Event Overview & Total Validated XP</span>
            </h2>
            <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-500/30">
              {teamScoreTotals.toLocaleString()} Total XP
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <StatCard
              title="Total Squad Teams"
              value={totalTeams}
              icon={<Users size={18} />}
              accent="red"
              subtitle="4-student squads"
            />
            <StatCard
              title="Registered Students"
              value={totalRegisteredStudents}
              icon={<Users size={18} />}
              accent="blue"
              subtitle="registered participants"
            />
            <StatCard
              title="Students PRs Validated"
              value={studentsWithValidPRs}
              icon={<CheckCircle2 size={18} />}
              accent="green"
              subtitle={`${studentsMissingSubmissions} pending push`}
            />
            <StatCard
              title="Total Team XP"
              value={teamScoreTotals.toLocaleString()}
              icon={<Zap size={18} />}
              accent="green"
              subtitle="authoritative score"
            />
          </div>
        </div>

        {/* Section 2: Repository & Submission Pipeline */}
        <div>
          <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
            <Folder size={14} className="text-cyan-400" />
            <span>Repository & PR Ingestion Pipeline</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
            <StatCard
              title="Repositories"
              value={totalRepositories}
              icon={<Folder size={16} />}
              accent="purple"
              subtitle="assigned repos"
            />
            <StatCard
              title="Assigned Issues"
              value={totalAssignedIssues}
              icon={<FileCode size={16} />}
              accent="cyan"
              subtitle="across all squads"
            />
            <StatCard
              title="PRs Received"
              value={totalPRsReceived}
              icon={<GitPullRequest size={16} />}
              accent="amber"
              subtitle="submitted PRs"
            />
            <StatCard
              title="Graded Issues"
              value={successfullyGradedIssues}
              icon={<CheckCircle2 size={16} />}
              accent="green"
              subtitle="validated & scored"
            />
            <StatCard
              title="Missing PRs"
              value={studentsMissingSubmissions}
              icon={<Clock size={16} />}
              accent="red"
              subtitle="pending Wi-Fi restoration"
            />
          </div>
        </div>

        {/* Section 3: Grading Integrity & Quality Signals */}
        <div>
          <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
            <AlertTriangle size={14} className="text-amber-400" />
            <span>Grading Engine Signals & Review Queue</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
            <StatCard
              title="Awaiting Grading"
              value={issuesAwaitingGrading}
              icon={<Clock size={16} />}
              accent="amber"
              subtitle="in review queue"
            />
            <StatCard
              title="Failed Correctness"
              value={failedCorrectnessChecks}
              icon={<XCircle size={16} />}
              accent="red"
              subtitle="test / syntax failures"
            />
            <StatCard
              title="Manual Reviews"
              value={pendingManualReviews}
              icon={<AlertTriangle size={16} />}
              accent="amber"
              subtitle="warden action required"
            />
            <StatCard
              title="Flagged / Invalid"
              value={duplicateOrInvalidSubmissions}
              icon={<AlertTriangle size={16} />}
              accent="red"
              subtitle="rule violations"
            />
            <StatCard
              title="Very Hard Solved"
              value={veryHardAccuratelySolved}
              icon={<Flame size={16} />}
              accent="purple"
              subtitle="≥95% test accuracy"
            />
          </div>
        </div>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="card p-6 sm:p-7 space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300">
          <Filter size={14} className="text-[#FF1E46]" />
          <span>Leaderboard & Breakdown Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Team Filter */}
          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
              Squad Team
            </label>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#FF1E46]"
            >
              <option value="ALL">All Squads ({teams.length})</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.repositoryName})
                </option>
              ))}
            </select>
          </div>

          {/* Repository Filter */}
          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
              Repository
            </label>
            <select
              value={filterRepo}
              onChange={(e) => setFilterRepo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#FF1E46]"
            >
              <option value="ALL">All Repositories</option>
              {teams.map((t) => (
                <option key={t.id} value={t.repositoryName}>
                  {t.repositoryName}
                </option>
              ))}
            </select>
          </div>

          {/* Student Search */}
          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
              Student Username
            </label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={filterStudent}
                onChange={(e) => setFilterStudent(e.target.value)}
                placeholder="e.g. rahul123"
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#FF1E46]"
              />
            </div>
          </div>

          {/* Issue Difficulty Filter */}
          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
              Issue Difficulty
            </label>
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#FF1E46]"
            >
              <option value="ALL">All Difficulties</option>
              <option value="EASY">Easy (10 pts)</option>
              <option value="MEDIUM">Medium (20 pts)</option>
              <option value="HARD">Hard (30 pts)</option>
              <option value="VERY_HARD">Very Hard (40 pts)</option>
            </select>
          </div>

          {/* PR Submission Status */}
          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
              PR Status
            </label>
            <select
              value={filterPRStatus}
              onChange={(e) => setFilterPRStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#FF1E46]"
            >
              <option value="ALL">All PR States</option>
              <option value="ALL_VALID">Complete (4/4)</option>
              <option value="PARTIAL">Partial (1-3 PRs)</option>
              <option value="PENDING">Pending (0 PRs)</option>
            </select>
          </div>

          {/* PR / Grading Status */}
          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
              Grading Status
            </label>
            <select
              value={filterGradingStatus}
              onChange={(e) => setFilterGradingStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#FF1E46]"
            >
              <option value="ALL">All Statuses</option>
              <option value="AUTO_APPROVED">Auto Approved</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="MERGED">Merged</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Team-Level Grading Breakdown */}
      <div className="card overflow-hidden">
        <div className="px-6 sm:px-7 py-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy size={15} className="text-amber-400" />
            <h3 className="font-mono text-xs font-bold text-slate-200 tracking-wide uppercase">
              Team-Level Grading Breakdown & Submission Status
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Showing {filteredTeams.length} of {teams.length} Squads
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                <th className="py-3.5 px-5">Rank</th>
                <th className="py-3.5 px-5">Squad</th>
                <th className="py-3.5 px-5">Repository</th>
                <th className="py-3.5 px-5">Students (4)</th>
                <th className="py-3.5 px-5">Solved / Assigned</th>
                <th className="py-3.5 px-5">Difficulty Mix</th>
                <th className="py-3.5 px-5 text-center">Very Hard</th>
                <th className="py-3.5 px-5 text-right">Team XP</th>
                <th className="py-3.5 px-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filteredTeams.map((t) => {
                const solved = t.solvedIssues || [];
                const easy = solved.filter((s) => s.difficulty === 'EASY').length;
                const med = solved.filter((s) => s.difficulty === 'MEDIUM').length;
                const hard = solved.filter((s) => s.difficulty === 'HARD').length;
                const vHard = t.veryHardSolvedCount || solved.filter((s) => s.difficulty === 'VERY_HARD').length;
                const submitted = (t.members || []).filter((m) => m.prSubmitted).length;

                return (
                  <tr key={t.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-4 px-5 font-bold text-slate-200">
                      {t.rankText || `#${t.rank}`}
                    </td>
                    <td className="py-4 px-5 font-bold text-white">
                      {t.name}
                    </td>
                    <td className="py-4 px-5 font-bold text-emerald-400">
                      {t.repositoryName}
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(t.members || []).map((m) => (
                          <span
                            key={m.githubUsername}
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              m.prSubmitted
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-900 text-slate-500 border border-slate-800'
                            }`}
                            title={`@${m.githubUsername}: ${m.prSubmitted ? 'PR Submitted' : 'Pending PR'}`}
                          >
                            @{m.githubUsername}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <span className="font-bold text-slate-200">
                        {t.validatedIssueCount ?? solved.length}
                      </span>
                      <span className="text-slate-500"> / {t.assignedIssueCount || 4}</span>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-1.5">
                        {easy > 0 && <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-semibold">{easy}E</span>}
                        {med > 0 && <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[10px] font-semibold">{med}M</span>}
                        {hard > 0 && <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-400 text-[10px] font-semibold">{hard}H</span>}
                        {vHard > 0 && <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 text-[10px] font-bold">{vHard}VH</span>}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-center">
                      {vHard > 0 ? (
                        <span className="px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-500/50 text-rose-400 font-bold text-[11px]">
                          {vHard} VH
                        </span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right font-black text-emerald-400 text-sm">
                      {t.totalScore.toLocaleString()} XP
                    </td>
                    <td className="py-4 px-5">
                      {submitted === 4 ? (
                        <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                          <CheckCircle2 size={13} /> Complete
                        </span>
                      ) : submitted > 0 ? (
                        <span className="text-amber-400 text-xs flex items-center gap-1">
                          <Clock size={13} /> {submitted}/4 PRs
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">Pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Section: Score Events & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10">
        {/* Recent Score Ledger */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              <span className="font-mono text-xs text-slate-300 font-bold tracking-wide">
                Authoritative Score Ledger
              </span>
            </div>
            <Link
              to="/admin/score-events"
              className="font-mono text-[10px] text-slate-400 hover:text-[#FF1E46] transition-colors"
            >
              View All →
            </Link>
          </div>

          <div className="divide-y divide-slate-800/40">
            {scoreEvents.length === 0 ? (
              <div className="p-6 text-center font-mono text-xs text-slate-600">
                No score events recorded yet.
              </div>
            ) : (
              scoreEvents.slice(0, 5).map((event: ScoreEvent) => (
                <div
                  key={event.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-slate-800/20 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm text-slate-200 font-semibold truncate">
                        {event.participantName}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        @{event.githubUsername}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-400 truncate">
                      {event.event}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="font-mono text-sm font-black text-emerald-400">
                      +{event.points} XP
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit Trail for Score Changes */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={14} className="text-[#FF1E46]" />
              <span className="font-mono text-xs text-slate-300 font-bold tracking-wide">
                Administrative Audit Trail
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              Immutable Admin Actions
            </span>
          </div>

          <div className="divide-y divide-slate-800/40">
            {auditLogs.length === 0 ? (
              <div className="p-6 text-center font-mono text-xs text-slate-600">
                No administrative adjustments logged yet.
              </div>
            ) : (
              auditLogs.slice(0, 5).map((log: AdminAuditLog) => (
                <div
                  key={log.id}
                  className="px-5 py-3 hover:bg-slate-800/20 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FF1E46]/10 text-[#FF5470] border border-[#FF1E46]/40">
                        {log.action}
                      </span>
                      <span className="text-slate-300 font-semibold">
                        by @{log.adminUsername}
                      </span>
                    </div>
                    <span className="text-slate-500 text-[10px]">
                      {formatTime(log.timestamp)}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 truncate">
                    Target: <span className="text-slate-200">{log.targetName || log.targetId}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 italic truncate">
                    Reason: "{log.reason}"
                  </div>
                  {log.previousValue !== undefined && log.newValue !== undefined && (
                    <div className="text-[10px] font-mono text-slate-500">
                      Adjustment: {String(log.previousValue)} →{' '}
                      <span className="text-emerald-400 font-bold">
                        {String(log.newValue)}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
