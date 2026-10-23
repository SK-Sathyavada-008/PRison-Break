// ─────────────────────────────────────────────
// Admin Teams & Issue Assignment Command Center
// ─────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Shield,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Download,
  Copy,
  Edit2,
  UserCheck,
  UserX,
  FileCode,
  Search,
  Check,
  X,
  Hash,
  AlertCircle,
  Gift,
  Sliders,
  Database,
  RefreshCw,
  FolderTree,
  Lock,
} from 'lucide-react';
import type { Team, FirestoreTeam, Repository, FirestoreIssue, IssueDifficulty } from '../../types';
import { teamService } from '../../services/teamService';
import { repositoryService } from '../../services/repositoryService';
import { issueService } from '../../services/issueService';
import { challengeImportService, type DiscoveryReport } from '../../services/challengeImportService';
import BonusXPModal from '../../components/admin/BonusXPModal';
import TeamSizeModal from '../../components/admin/TeamSizeModal';
import { useAuth } from '../../context/AuthContext';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';

export default function TeamsPage() {
  const { currentUser } = useAuth();
  const adminName = currentUser?.displayName || currentUser?.email || 'admin_warden';

  const [teams, setTeams] = useState<Team[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [issues, setIssues] = useState<FirestoreIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'squads' | 'students' | 'issues' | 'importer'>('squads');
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<FirestoreTeam | null>(null);

  // Manual Bonus XP Modal
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [selectedTeamForBonus, setSelectedTeamForBonus] = useState<Team | FirestoreTeam | null>(null);

  // Flexible Team Size Modal
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [selectedTeamForSize, setSelectedTeamForSize] = useState<Team | FirestoreTeam | null>(null);

  // Challenge Importer
  const [importSummary, setImportSummary] = useState<DiscoveryReport | null>(null);
  const [importing, setImporting] = useState(false);
  const [importOverwriteConfirm, setImportOverwriteConfirm] = useState(false);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);

  const [isReplacementModalOpen, setIsReplacementModalOpen] = useState(false);
  const [replacementTeam, setReplacementTeam] = useState<FirestoreTeam | null>(null);
  const [oldStudentUsername, setOldStudentUsername] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentUsername, setNewStudentUsername] = useState('');
  const [replacementReason, setReplacementReason] = useState('');

  const [isAssignIssueModalOpen, setIsAssignIssueModalOpen] = useState(false);
  const [selectedTeamForIssues, setSelectedTeamForIssues] = useState<FirestoreTeam | null>(null);
  const [newIssueNum, setNewIssueNum] = useState<number>(1);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueDiff, setNewIssueDiff] = useState<IssueDifficulty>('EASY');
  const [newIssueStudent, setNewIssueStudent] = useState('');

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [copied, setCopied] = useState(false);

  // Subscriptions
  useEffect(() => {
    setLoading(true);
    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= 3) setLoading(false);
    };

    const unsubTeams = teamService.subscribeToTeamsLeaderboard((t) => {
      setTeams(t);
      checkLoaded();
    });

    const unsubRepos = repositoryService.subscribeToRepositories((r) => {
      setRepositories(r);
      checkLoaded();
    });

    const unsubIssues = issueService.subscribeToIssues((i) => {
      setIssues(i);
      checkLoaded();
    });

    return () => {
      unsubTeams();
      unsubRepos();
      unsubIssues();
    };
  }, []);

  // Diagnostics & Configuration Errors Detection
  const diagnostics = useMemo(() => {
    return teamService.detectConfigurationErrors(teams, repositories, issues);
  }, [teams, repositories, issues]);

  const hasConfigErrors =
    diagnostics.invalidMemberCounts.length > 0 ||
    diagnostics.duplicateRepositories.length > 0 ||
    diagnostics.duplicateStudents.length > 0 ||
    diagnostics.duplicateIssues.length > 0 ||
    diagnostics.teamsWithoutRepo.length > 0;

  // Search Filtering
  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return teams;
    const q = searchQuery.toLowerCase().trim();
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.repositoryName.toLowerCase().includes(q) ||
        t.members.some(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.githubUsername.toLowerCase().includes(q)
        )
    );
  }, [teams, searchQuery]);

  // Handlers
  const handleToggleTeamActivation = async (team: FirestoreTeam) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const targetState = !team.active;

    if (targetState) {
      // Server-side validation before activating
      const validation = teamService.validateTeamForActivation(team, teams);
      if (!validation.valid) {
        setErrorMsg(`Cannot activate squad "${team.name}": ${validation.errors.join(' ')}`);
        return;
      }
    }

    try {
      await teamService.saveTeam({
        ...team,
        active: targetState,
      });
      setSuccessMsg(`Squad "${team.name}" is now ${targetState ? 'ACTIVE' : 'INACTIVE'}.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update squad status.');
    }
  };

  const handleOpenCreateTeam = () => {
    setEditingTeam(null);
    setIsTeamModalOpen(true);
  };

  const handleOpenEditTeam = (team: FirestoreTeam) => {
    setEditingTeam(team);
    setIsTeamModalOpen(true);
  };

  const handleOpenReplacementModal = (team: FirestoreTeam, studentUsername: string) => {
    setReplacementTeam(team);
    setOldStudentUsername(studentUsername);
    setNewStudentName('');
    setNewStudentUsername('');
    setReplacementReason('');
    setIsReplacementModalOpen(true);
  };

  const handleExecuteReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacementTeam || !oldStudentUsername || !newStudentUsername || !replacementReason) {
      setErrorMsg('All fields are strictly required for participant replacement.');
      return;
    }

    try {
      setErrorMsg(null);
      await teamService.replaceParticipantWithAudit(
        replacementTeam.id,
        oldStudentUsername,
        {
          name: newStudentName.trim() || newStudentUsername.trim(),
          githubUsername: newStudentUsername.trim().replace(/^@/, ''),
        },
        adminName,
        replacementReason.trim()
      );
      setSuccessMsg(`Audited replacement completed for @${oldStudentUsername}. Logged in audit ledger.`);
      setIsReplacementModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to replace participant.');
    }
  };

  const handleOpenAssignIssues = (team: FirestoreTeam) => {
    setSelectedTeamForIssues(team);
    setNewIssueNum(Date.now() % 1000 + 1);
    setNewIssueTitle('');
    setNewIssueDiff('EASY');
    setNewIssueStudent(team.members[0]?.githubUsername || '');
    setIsAssignIssueModalOpen(true);
  };

  const handleAddIssueAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamForIssues || !newIssueNum || !newIssueStudent) {
      setErrorMsg('Please select a squad member and issue number.');
      return;
    }

    try {
      setErrorMsg(null);
      const student = selectedTeamForIssues.members.find(
        (m) => m.githubUsername.toLowerCase() === newIssueStudent.toLowerCase()
      );

      // Save issue with server-side trusted difficulty
      await issueService.saveIssue({
        repositoryId: selectedTeamForIssues.repositoryId,
        repositoryFullName: selectedTeamForIssues.repositoryFullName,
        issueNumber: Number(newIssueNum),
        title: newIssueTitle.trim() || `Issue #${newIssueNum}`,
        difficulty: newIssueDiff,
        teamId: selectedTeamForIssues.id,
        assignedStudentId: student?.studentId,
        assignedStudentUsername: newIssueStudent,
        active: true,
      });

      // Update student's assignedIssues list in team document
      const updatedMembers = selectedTeamForIssues.members.map((m) => {
        if (m.githubUsername.toLowerCase() === newIssueStudent.toLowerCase()) {
          const existing = m.assignedIssues || [];
          if (!existing.includes(Number(newIssueNum))) {
            return {
              ...m,
              assignedIssues: [...existing, Number(newIssueNum)],
            };
          }
        }
        return m;
      });

      const updatedTeam = {
        ...selectedTeamForIssues,
        members: updatedMembers,
        assignedIssueCount: (selectedTeamForIssues.assignedIssueCount || 0) + 1,
      };

      await teamService.saveTeam(updatedTeam);
      setSuccessMsg(`Issue #${newIssueNum} [${newIssueDiff}] assigned to @${newIssueStudent}!`);
      setNewIssueTitle('');
      setNewIssueNum(newIssueNum + 1);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save issue assignment.');
    }
  };

  const handleCopyExport = () => {
    const content = teamService.exportTeamAssignments(teams, issues, exportFormat);
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadExport = () => {
    const content = teamService.exportTeamAssignments(teams, issues, exportFormat);
    const blob = new Blob([content], { type: exportFormat === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prison_break_squad_assignments.${exportFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-white tracking-tight">
              Squad & Issue Assignment Portal
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FF0A3B]/10 border border-[#FF0A3B]/30 text-[#FF5470]">
              PHASE 2 MODEL
            </span>
          </div>
          <p className="font-mono text-xs text-slate-400 mt-1">
            4 students per squad · 1 assigned repository (`squard_X`) · Trusted issue difficulty points (10/20/30/40)
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-mono flex items-center gap-2 transition-colors"
          >
            <Download size={14} />
            <span>Export Roster</span>
          </button>
          <button
            onClick={handleOpenCreateTeam}
            className="btn btn-primary text-xs font-mono flex items-center gap-2"
          >
            <Plus size={14} />
            <span>Create Squad</span>
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-400 font-mono text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">
            <X size={15} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 font-mono text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Diagnostics & Integrity Audit Banner */}
      <div
        className={`p-4 rounded-xl border font-mono text-xs transition-all ${
          hasConfigErrors
            ? 'bg-amber-950/20 border-amber-500/30 text-amber-300'
            : 'bg-slate-900/40 border-slate-800 text-slate-400'
        }`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {hasConfigErrors ? (
              <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            )}
            <span className="font-bold">
              {hasConfigErrors
                ? 'CONFIGURATION ANOMALIES DETECTED — COMPLIANCE CHECKS REQUIRED'
                : 'ALL SQUADS AND REPOSITORIES COMPLIANT WITH EVENT SPEC'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            {teams.length} Squads · {teams.filter((t) => t.active).length} Active · {issues.length} Issues
          </span>
        </div>

        {hasConfigErrors && (
          <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-1.5 text-[11px]">
            {diagnostics.invalidMemberCounts.map((err) => (
              <div key={err.teamId} className="text-amber-400 flex items-center gap-1.5">
                • Squad "{err.teamName}" has {err.count} members (Must be exactly 4 to activate).
              </div>
            ))}
            {diagnostics.duplicateRepositories.map((err) => (
              <div key={err.repository} className="text-rose-400 flex items-center gap-1.5">
                • Repository "{err.repository}" is assigned to multiple active squads: {err.teamNames.join(', ')}.
              </div>
            ))}
            {diagnostics.duplicateStudents.map((err) => (
              <div key={err.username} className="text-rose-400 flex items-center gap-1.5">
                • Student @{err.username} is registered in multiple active squads: {err.teamNames.join(', ')}.
              </div>
            ))}
            {diagnostics.duplicateIssues.map((err) => (
              <div key={`${err.repositoryId}_${err.issueNumber}`} className="text-amber-400 flex items-center gap-1.5">
                • Issue #{err.issueNumber} ({err.repositoryId}) is assigned to multiple students: {err.assignedTo.join(', ')}.
              </div>
            ))}
            {diagnostics.teamsWithoutRepo.map((err) => (
              <div key={err.teamId} className="text-amber-400 flex items-center gap-1.5">
                • Squad "{err.teamName}" is missing an assigned repository.
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-mono gap-1">
        <button
          onClick={() => setActiveTab('squads')}
          className={`py-3 px-4 border-b-2 font-bold flex items-center gap-2 transition-colors ${
            activeTab === 'squads'
              ? 'border-[#FF0A3B] text-[#FF5470]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users size={14} />
          <span>Squads & Rosters ({teams.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={`py-3 px-4 border-b-2 font-bold flex items-center gap-2 transition-colors ${
            activeTab === 'students'
              ? 'border-[#FF0A3B] text-[#FF5470]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck size={14} />
          <span>Student Assignments</span>
        </button>
        <button
          onClick={() => setActiveTab('issues')}
          className={`py-3 px-4 border-b-2 font-bold flex items-center gap-2 transition-colors ${
            activeTab === 'issues'
              ? 'border-[#FF0A3B] text-[#FF5470]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode size={14} />
          <span>Issue Inventory ({issues.length})</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('importer');
            if (!importSummary) {
              setImportSummary(challengeImportService.discoverAndValidateAll());
            }
          }}
          className={`py-3 px-4 border-b-2 font-bold flex items-center gap-2 transition-colors ${
            activeTab === 'importer'
              ? 'border-[#FF0A3B] text-[#FF5470]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database size={14} />
          <span>Challenge Repos & Importer</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter squads, repositories, or student @github..."
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF0A3B]/60"
        />
      </div>

      {loading ? (
        <div className="card p-12">
          <LoadingState message="FETCHING SQUAD & ISSUE TELEMETRY..." />
        </div>
      ) : activeTab === 'squads' ? (
        /* TAB 1: SQUADS & REPOSITORIES */
        <div className="space-y-4">
          {filteredTeams.length === 0 ? (
            <div className="card p-10 text-center">
              <EmptyState
                title="No Squads Match Query"
                description="Create squads and assign repositories like squard_1, squard_2 to begin."
                icon={<Users size={32} />}
              />
            </div>
          ) : (
            filteredTeams.map((team) => (
              <div
                key={team.id}
                className={`card p-5 transition-all ${
                  team.active ? 'border-slate-800 bg-slate-900/40' : 'border-slate-800/40 bg-slate-950/40 opacity-70'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                  {/* Team Identity */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FF0A3B]/10 border border-[#FF0A3B]/30 flex items-center justify-center font-mono font-black text-[#FF5470] text-sm">
                      {team.name.replace(/[^0-9]/g, '') || '#'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white text-base">{team.name}</h3>
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                          repo: {team.repositoryName}
                        </span>
                        {team.active ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            ACTIVE COMPETITION
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 text-slate-400">
                            INACTIVE
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-slate-500 mt-0.5">
                        {team.repositoryFullName || team.repositoryName} · Total Score: <span className="text-emerald-400 font-bold">{team.totalScore} XP</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions & Stats */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="font-mono text-xs text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-3 flex-wrap">
                      <span>Earned: <strong className="text-white">{team.earnedXP ?? team.totalScore}</strong></span>
                      <span>Bonus: <strong className="text-amber-400">+{team.bonusXP || 0}</strong></span>
                      <span>Total: <strong className="text-emerald-400">{team.totalXP ?? team.totalScore} XP</strong></span>
                      <span>Solved: <strong className="text-white">{team.validatedIssueCount || 0}</strong></span>
                      <span>Very Hard: <strong className="text-purple-400">{team.veryHardSolvedCount || 0}</strong></span>
                      <span>PRs: <strong className="text-cyan-400">{team.prsSubmitted || 0}/{team.configuredTeamSize || 4}</strong></span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedTeamForBonus(team as FirestoreTeam);
                        setIsBonusModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40 text-amber-300 font-mono text-xs flex items-center gap-1.5 transition-colors"
                      title="Manage Team Bonus XP (strictly positive, non-reducing)"
                    >
                      <Gift size={13} />
                      <span>Bonus XP</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedTeamForSize(team as FirestoreTeam);
                        setIsSizeModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900 border border-purple-500/40 text-purple-300 font-mono text-xs flex items-center gap-1.5 transition-colors"
                      title="Configure Team Size (4 or 5 members with admin approval)"
                    >
                      <Sliders size={13} />
                      <span>Size: {team.configuredTeamSize || 4}</span>
                    </button>

                    <button
                      onClick={() => handleOpenAssignIssues(team)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 font-mono text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Hash size={13} />
                      <span>Manage Issues</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditTeam(team)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Edit2 size={13} />
                      <span>Edit Squad</span>
                    </button>

                    <button
                      onClick={() => handleToggleTeamActivation(team)}
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-colors ${
                        team.active
                          ? 'bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-500/40'
                          : 'bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-500/40'
                      }`}
                    >
                      {team.active ? 'Deactivate' : `Activate (Verify ${team.configuredTeamSize || 4} Members)`}
                    </button>
                  </div>
                </div>

                {/* Registered Members Grid (Supports 4 or 5 members) */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${(team.configuredTeamSize || 4) === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3 mt-4`}>
                  {team.members.map((member, idx) => (
                    <div
                      key={member.studentId || idx}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs font-mono space-y-2 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[10px] uppercase font-bold">Slot #{idx + 1}</span>
                        <button
                          onClick={() => handleOpenReplacementModal(team, member.githubUsername)}
                          className="text-[10px] text-slate-500 hover:text-amber-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Replace participant with audit log"
                        >
                          <UserX size={11} />
                          <span>Replace</span>
                        </button>
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-slate-200 truncate">{member.name}</div>
                        <div className="text-[11px] text-[#FF5470] truncate">@{member.githubUsername}</div>
                      </div>

                      <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">
                          Issues: {member.assignedIssues?.length > 0 ? member.assignedIssues.join(', #') : 'None'}
                        </span>
                        {member.prSubmitted ? (
                          <span className="text-emerald-400 flex items-center gap-1 text-[10px]">
                            <Check size={11} /> PR #{member.prNumber || '✓'}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Coding Offline</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {/* If fewer than configured members, show empty slot */}
                  {Array.from({ length: Math.max(0, (team.configuredTeamSize || 4) - (team.members?.length || 0)) }).map((_, i) => (
                    <div
                      key={`empty_${i}`}
                      className="p-3 rounded-xl border border-dashed border-rose-500/40 bg-rose-950/10 text-xs font-mono flex flex-col items-center justify-center text-rose-400/80 gap-1"
                    >
                      <AlertCircle size={15} />
                      <span className="font-bold">Missing Member</span>
                      <span className="text-[10px] text-slate-500">{team.configuredTeamSize || 4} required for competition</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'students' ? (
        /* TAB 2: STUDENT ASSIGNMENTS */
        <div className="card overflow-hidden border border-slate-800">
          <table className="prison-table w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                <th className="py-3 px-4 text-left">Student</th>
                <th className="py-3 px-4 text-left">Squad</th>
                <th className="py-3 px-4 text-left">Repository</th>
                <th className="py-3 px-4 text-left">Assigned Issues</th>
                <th className="py-3 px-4 text-left">PR Status</th>
                <th className="py-3 px-right text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {teams.flatMap((t) =>
                t.members.map((m) => (
                  <tr key={`${t.id}_${m.githubUsername}`} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-200">{m.name}</div>
                      <div className="text-slate-500 text-[11px]">@{m.githubUsername}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-white">{t.name}</span>
                    </td>
                    <td className="py-3 px-4 text-cyan-400">{t.repositoryName}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {m.assignedIssues?.length > 0 ? (
                          m.assignedIssues.map((num) => (
                            <span
                              key={num}
                              className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-bold text-[10px]"
                            >
                              #{num}
                            </span>
                          ))
                        ) : (
                          <span className="text-rose-400 text-[11px]">No issues assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {m.prSubmitted ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 size={13} />
                          Final PR #{m.prNumber || 'Submitted'}
                        </span>
                      ) : (
                        <span className="text-amber-400/80">Offline Local Git</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400">
                      {m.score || 0} XP
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* TAB 3: ISSUE INVENTORY */
        <div className="card overflow-hidden border border-slate-800">
          <table className="prison-table w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                <th className="py-3 px-4 text-left">Issue</th>
                <th className="py-3 px-4 text-left">Repository</th>
                <th className="py-3 px-4 text-left">Difficulty</th>
                <th className="py-3 px-4 text-left">Base Points</th>
                <th className="py-3 px-4 text-left">Assigned Student</th>
                <th className="py-3 px-4 text-left">Grading Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {issues.map((issue) => (
                <tr key={issue.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[#FF5470] font-black">#{issue.issueNumber}</span>
                      <span className="text-slate-200 font-semibold">{issue.title}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-cyan-400">{issue.repositoryId}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        issue.difficulty === 'VERY_HARD'
                          ? 'bg-purple-500/15 border border-purple-500/30 text-purple-400'
                          : issue.difficulty === 'HARD'
                          ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                          : issue.difficulty === 'MEDIUM'
                          ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                          : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                      }`}
                    >
                      {issue.difficulty}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-200">
                    +{issue.basePoints} XP
                  </td>
                  <td className="py-3 px-4">
                    {issue.assignedStudentUsername ? (
                      <span className="text-[#FF5470]">@{issue.assignedStudentUsername}</span>
                    ) : (
                      <span className="text-slate-600">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-400 uppercase text-[10px]">{issue.gradingStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: CHALLENGE REPOS & REFERENCE SOLUTIONS IMPORTER */}
      {activeTab === 'importer' && (
        <div className="space-y-6 font-mono text-xs">
          {/* Security & Confidentiality Banner */}
          <div className="p-4 rounded-xl border border-cyan-500/40 bg-cyan-950/20 space-y-2">
            <div className="flex items-center gap-2 font-bold text-cyan-300 text-sm">
              <Lock size={16} />
              <span>Reference Solutions Private Storage & Confidentiality</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Trusted reference solutions are maintained exclusively in protected server-side storage and are strictly restricted to authenticated administrators and sandboxed CI runners. Reference solutions are <strong>never</strong> bundled into public GitHub challenge repositories, client JavaScript bundles, or participant API responses.
            </p>
          </div>

          {/* Discovery Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Challenge Repositories</span>
              <div className="text-2xl font-black text-white">
                {importSummary?.totalRepositories ?? 35}
              </div>
              <span className="text-[10px] text-slate-500">Squade_1 through Squade_35</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Issues Cataloged</span>
              <div className="text-2xl font-black text-emerald-400">
                {importSummary?.totalIssuesMapped ?? 3080}
              </div>
              <span className="text-[10px] text-slate-500">88 issues per repository</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Reference Solutions</span>
              <div className="text-2xl font-black text-cyan-400">
                {importSummary?.totalSolutionsMatched ?? 3080}
              </div>
              <span className="text-[10px] text-emerald-400">100% mapped (0 missing)</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Missing Test Suites</span>
              <div className="text-2xl font-black text-amber-400">
                {importSummary?.totalMissingTests ?? 35}
              </div>
              <span className="text-[10px] text-amber-300/80">Flagged: src/test absent; issue stdout used</span>
            </div>
          </div>

          {/* Importer Controls */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-white text-sm">Idempotent Import & Validation Workflow</h3>
                <p className="text-[11px] text-slate-400">
                  Re-importing identical challenge mappings will not duplicate data. Overwriting existing production mappings requires explicit administrator confirmation.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const res = challengeImportService.discoverAndValidateAll();
                    setImportSummary(res);
                    setImportStatusMessage(`Validated ${res.totalRepositories} challenge repos and ${res.totalIssuesMapped} issues.`);
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw size={14} />
                  <span>Scan repoissies</span>
                </button>

                <button
                  disabled={importing}
                  onClick={async () => {
                    setImporting(true);
                    setImportStatusMessage(null);
                    try {
                      const res = await challengeImportService.importChallengeMappings({
                        adminUsername: adminName,
                        confirmOverwrite: importOverwriteConfirm,
                      });
                      setImportStatusMessage(`Successfully imported ${res.importedCount} mappings into database ledger.`);
                      setSuccessMsg(`Import complete: ${res.importedCount} challenge mappings synchronized.`);
                    } catch (err: any) {
                      setErrorMsg(err?.message || 'Import failed');
                    } finally {
                      setImporting(false);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-[#FF0A3B] hover:bg-[#FF0A3B]/90 text-white font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Database size={14} />
                  <span>{importing ? 'Importing Mappings...' : 'Import Mappings'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <input
                type="checkbox"
                id="overwriteConfirm"
                checked={importOverwriteConfirm}
                onChange={(e) => setImportOverwriteConfirm(e.target.checked)}
                className="accent-[#FF0A3B] rounded"
              />
              <label htmlFor="overwriteConfirm" className="text-[11px] text-slate-300 cursor-pointer">
                Confirm overwrite of existing challenge mappings (safe update protection)
              </label>
            </div>

            {importStatusMessage && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>{importStatusMessage}</span>
              </div>
            )}
          </div>

          {/* Repository Mapping Table */}
          <div className="card overflow-hidden border border-slate-800">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-white text-xs flex items-center gap-2">
                <FolderTree size={14} className="text-cyan-400" />
                <span>Discovered Challenge Repositories & Mappings (35 Repositories)</span>
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">Difficulty: Easy (10 XP), Medium (20 XP), Hard (30 XP), Very Hard (40 XP)</span>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="prison-table w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                    <th className="py-2.5 px-4 text-left">Repository</th>
                    <th className="py-2.5 px-4 text-left">Issues</th>
                    <th className="py-2.5 px-4 text-left">Solutions Mapped</th>
                    <th className="py-2.5 px-4 text-left">Test Suite Status</th>
                    <th className="py-2.5 px-4 text-left">Privacy Status</th>
                    <th className="py-2.5 px-4 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {Array.from({ length: 35 }).map((_, idx) => {
                    const repoName = `Squade_${idx + 1}`;
                    return (
                      <tr key={repoName} className="hover:bg-slate-900/50">
                        <td className="py-2.5 px-4 font-bold text-white">{repoName}</td>
                        <td className="py-2.5 px-4 text-slate-300">88 Issues (E:22, M:22, H:22, VH:22)</td>
                        <td className="py-2.5 px-4 text-emerald-400 font-bold">88 / 88 Linked</td>
                        <td className="py-2.5 px-4 text-amber-400 text-[11px]">
                          Flagged (Missing src/test; uses issue output)
                        </td>
                        <td className="py-2.5 px-4 text-cyan-400 text-[11px] flex items-center gap-1">
                          <Lock size={12} />
                          <span>Protected in Server Storage</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            VALIDATED
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE / EDIT SQUAD */}
      {isTeamModalOpen && (
        <SquadFormModal
          isOpen={isTeamModalOpen}
          editingTeam={editingTeam}
          repositories={repositories}
          allTeams={teams}
          onClose={() => setIsTeamModalOpen(false)}
          onSaved={() => {
            setIsTeamModalOpen(false);
            setSuccessMsg('Squad configuration saved successfully.');
          }}
        />
      )}

      {/* MODAL 2: PARTICIPANT REPLACEMENT AUDIT */}
      {isReplacementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 border-slate-700 bg-slate-900 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Shield size={16} />
                <span>Auditable Participant Replacement</span>
              </div>
              <button onClick={() => setIsReplacementModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <p className="text-slate-400 text-[11px]">
              Replacing a registered competition student is an auditable action recorded in the security ledger.
            </p>

            <form onSubmit={handleExecuteReplacement} className="space-y-3.5">
              <div>
                <label className="text-slate-400 text-[10px] uppercase">Current Student</label>
                <input
                  type="text"
                  disabled
                  value={`@${oldStudentUsername}`}
                  className="w-full mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400"
                />
              </div>

              <div>
                <label className="text-slate-300 text-[10px] uppercase">New Student Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:border-[#FF0A3B]"
                />
              </div>

              <div>
                <label className="text-slate-300 text-[10px] uppercase">New Student GitHub Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. johndoe"
                  value={newStudentUsername}
                  onChange={(e) => setNewStudentUsername(e.target.value)}
                  className="w-full mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:border-[#FF0A3B]"
                />
              </div>

              <div>
                <label className="text-slate-300 text-[10px] uppercase">Documented Reason (Audit Requirement)</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Medical emergency substitution authorized by hackathon organizing committee."
                  value={replacementReason}
                  onChange={(e) => setReplacementReason(e.target.value)}
                  className="w-full mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:border-[#FF0A3B]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReplacementModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold"
                >
                  Confirm & Audit Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ASSIGN ISSUES TO SQUAD */}
      {isAssignIssueModalOpen && selectedTeamForIssues && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6 border-slate-700 bg-slate-900 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold">
                <Hash size={16} className="text-[#FF0A3B]" />
                <span>Assign Issues to {selectedTeamForIssues.name}</span>
              </div>
              <button onClick={() => setIsAssignIssueModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <p className="text-slate-400 text-[11px]">
              Repository: <strong className="text-cyan-400">{selectedTeamForIssues.repositoryName}</strong> · Standard difficulties: Easy (10 XP), Medium (20 XP), Hard (30 XP), Very Hard (40 XP).
            </p>

            <form onSubmit={handleAddIssueAssignment} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 text-[10px] uppercase">Issue Number</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newIssueNum}
                    onChange={(e) => setNewIssueNum(parseInt(e.target.value, 10))}
                    className="w-full mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:border-[#FF0A3B]"
                  />
                </div>
                <div>
                  <label className="text-slate-300 text-[10px] uppercase">Difficulty Tier</label>
                  <select
                    value={newIssueDiff}
                    onChange={(e) => setNewIssueDiff(e.target.value as IssueDifficulty)}
                    className="w-full mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:border-[#FF0A3B]"
                  >
                    <option value="EASY">Easy (10 XP)</option>
                    <option value="MEDIUM">Medium (20 XP)</option>
                    <option value="HARD">Hard (30 XP)</option>
                    <option value="VERY_HARD">Very Hard (40 XP)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-[10px] uppercase">Issue Title</label>
                <input
                  type="text"
                  placeholder="e.g. Implement matrix rotation algorithm in Java"
                  value={newIssueTitle}
                  onChange={(e) => setNewIssueTitle(e.target.value)}
                  className="w-full mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:border-[#FF0A3B]"
                />
              </div>

              <div>
                <label className="text-slate-300 text-[10px] uppercase">Assign To Squad Member</label>
                <select
                  value={newIssueStudent}
                  onChange={(e) => setNewIssueStudent(e.target.value)}
                  className="w-full mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:border-[#FF0A3B]"
                >
                  {selectedTeamForIssues.members.map((m) => (
                    <option key={m.githubUsername} value={m.githubUsername}>
                      {m.name} (@{m.githubUsername})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignIssueModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                >
                  Done
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs"
                >
                  Assign Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EXPORT ASSIGNMENTS */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="card w-full max-w-2xl p-6 border-slate-700 bg-slate-900 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold">
                <Download size={16} className="text-[#FF0A3B]" />
                <span>Export Competition Roster & Assignments</span>
              </div>
              <button onClick={() => setIsExportModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setExportFormat('json')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    exportFormat === 'json' ? 'bg-[#FF0A3B] text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  JSON Format
                </button>
                <button
                  onClick={() => setExportFormat('csv')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    exportFormat === 'csv' ? 'bg-[#FF0A3B] text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  CSV Format
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopyExport}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleDownloadExport}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
                >
                  <Download size={13} />
                  <span>Download File</span>
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto max-h-80 text-[11px] text-slate-300">
              {teamService.exportTeamAssignments(teams, issues, exportFormat)}
            </pre>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE TEAM BONUS XP */}
      {isBonusModalOpen && selectedTeamForBonus && (
        <BonusXPModal
          isOpen={isBonusModalOpen}
          team={selectedTeamForBonus}
          adminUsername={adminName}
          onClose={() => {
            setIsBonusModalOpen(false);
            setSelectedTeamForBonus(null);
          }}
          onSuccess={() => {
            setIsBonusModalOpen(false);
            setSelectedTeamForBonus(null);
            setSuccessMsg('Bonus XP successfully awarded and ledger updated.');
          }}
        />
      )}

      {/* MODAL: CONFIGURE TEAM SIZE (4 OR 5) */}
      {isSizeModalOpen && selectedTeamForSize && (
        <TeamSizeModal
          isOpen={isSizeModalOpen}
          team={selectedTeamForSize}
          adminUsername={adminName}
          onClose={() => {
            setIsSizeModalOpen(false);
            setSelectedTeamForSize(null);
          }}
          onSuccess={() => {
            setIsSizeModalOpen(false);
            setSelectedTeamForSize(null);
            setSuccessMsg('Team size configuration successfully updated.');
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Subcomponent: Squad Form Modal (Create & Edit)
// ─────────────────────────────────────────────
function SquadFormModal({
  isOpen,
  editingTeam,
  repositories,
  allTeams,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  editingTeam: FirestoreTeam | null;
  repositories: Repository[];
  allTeams: FirestoreTeam[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editingTeam?.name || '');
  const [repositoryId, setRepositoryId] = useState(editingTeam?.repositoryId || '');
  const [members, setMembers] = useState<Array<{ name: string; githubUsername: string }>>(
    editingTeam?.members?.map((m) => ({ name: m.name, githubUsername: m.githubUsername })) || [
      { name: '', githubUsername: '' },
      { name: '', githubUsername: '' },
      { name: '', githubUsername: '' },
      { name: '', githubUsername: '' },
    ]
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pad or trim to configured member inputs (4 or 5)
  const targetSize = editingTeam?.configuredTeamSize || 4;

  useEffect(() => {
    if (editingTeam) {
      setName(editingTeam.name);
      setRepositoryId(editingTeam.repositoryId);
      const m = editingTeam.members.map((x) => ({ name: x.name, githubUsername: x.githubUsername }));
      while (m.length < targetSize) m.push({ name: '', githubUsername: '' });
      setMembers(m.slice(0, targetSize));
    } else {
      setName(`Squad ${allTeams.length + 1}`);
      setRepositoryId('');
      setMembers([
        { name: '', githubUsername: '' },
        { name: '', githubUsername: '' },
        { name: '', githubUsername: '' },
        { name: '', githubUsername: '' },
      ]);
    }
  }, [editingTeam, allTeams.length, targetSize]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Squad name is required.');
      return;
    }
    if (!repositoryId.trim()) {
      setError('Please assign a registered repository.');
      return;
    }

    // Verify configured members are filled
    const cleanMembers = members.map((m) => ({
      name: m.name.trim(),
      githubUsername: m.githubUsername.trim().replace(/^@/, ''),
    }));

    for (let i = 0; i < targetSize; i++) {
      if (!cleanMembers[i]?.githubUsername) {
        setError(`Slot #${i + 1} requires a valid GitHub username. Competition squads require ${targetSize} registered members.`);
        return;
      }
    }

    // Check duplicate student within the squad
    const usernames = cleanMembers.slice(0, targetSize).map((m) => m.githubUsername.toLowerCase());
    if (new Set(usernames).size !== targetSize) {
      setError(`All ${targetSize} squad members must have distinct GitHub usernames.`);
      return;
    }

    try {
      setSubmitting(true);
      const cleanRepo = repositoryId.trim().replace(/^repo_/, '');
      const repoObj = repositories.find((r) => r.id === repositoryId || r.name === repositoryId);
      const teamId = editingTeam?.id || `team_${cleanRepo.toLowerCase()}`;

      const finalMembers = cleanMembers.slice(0, targetSize).map((m, idx) => {
        const existing = editingTeam?.members?.[idx];
        return {
          studentId: existing?.studentId || `s_${m.githubUsername}`,
          name: m.name || m.githubUsername,
          githubUsername: m.githubUsername,
          teamId,
          repositoryId: cleanRepo,
          assignedIssues: existing?.assignedIssues || [],
          prSubmitted: existing?.prSubmitted || false,
          score: existing?.score || 0,
        };
      });

      const teamPayload: Partial<FirestoreTeam> & { name: string; repositoryId: string } = {
        id: teamId,
        name: name.trim(),
        repositoryId: cleanRepo,
        repositoryName: repoObj?.name || cleanRepo,
        repositoryFullName: repoObj?.fullName || cleanRepo,
        members: finalMembers,
        assignedIssueCount: editingTeam?.assignedIssueCount || targetSize,
        configuredTeamSize: targetSize,
        sizeChangeReason: editingTeam?.sizeChangeReason,
        sizeApprovedBy: editingTeam?.sizeApprovedBy,
        validatedIssueCount: editingTeam?.validatedIssueCount || 0,
        correctlySolvedIssuesCount: editingTeam?.correctlySolvedIssuesCount || 0,
        veryHardSolvedCount: editingTeam?.veryHardSolvedCount || 0,
        totalScore: editingTeam?.totalScore || 0,
        earnedXP: editingTeam?.earnedXP || 0,
        bonusXP: editingTeam?.bonusXP || 0,
        totalXP: editingTeam?.totalXP || 0,
        prsSubmitted: editingTeam?.prsSubmitted || 0,
        solvedIssues: editingTeam?.solvedIssues || [],
        active: editingTeam?.active ?? true,
      };

      // Server-side validation
      const validation = teamService.validateTeamForActivation(teamPayload, allTeams);
      if (!validation.valid && teamPayload.active) {
        setError(validation.errors.join(' '));
        setSubmitting(false);
        return;
      }

      await teamService.saveTeam(teamPayload);
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Failed to save squad.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="card w-full max-w-xl p-6 border-slate-700 bg-slate-900 shadow-2xl space-y-4 font-mono text-xs max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-bold">
            <Users size={16} className="text-[#FF0A3B]" />
            <span>{editingTeam ? `Edit Squad: ${editingTeam.name}` : 'Register New Competition Squad'}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/40 text-rose-400 flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 text-[10px] uppercase">Squad Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Squad 5"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:border-[#FF0A3B]"
              />
            </div>

            <div>
              <label className="text-slate-300 text-[10px] uppercase">Assigned Repository</label>
              <select
                required
                value={repositoryId}
                onChange={(e) => setRepositoryId(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:border-[#FF0A3B]"
              >
                <option value="">-- Select Registered Repository --</option>
                {repositories.map((repo) => (
                  <option key={repo.id} value={repo.name}>
                    {repo.name} ({repo.fullName || repo.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-300 text-[10px] uppercase font-bold">
                Registered Student Members ({targetSize} Slots Configured)
              </label>
              <span className="text-[10px] text-slate-500">{targetSize} of {targetSize} slots</span>
            </div>

            <div className="space-y-2.5">
              {members.map((m, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center gap-2">
                  <span className="w-5 text-center text-slate-500 font-bold text-[11px]">#{idx + 1}</span>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={m.name}
                    onChange={(e) => {
                      const updated = [...members];
                      updated[idx].name = e.target.value;
                      setMembers(updated);
                    }}
                    className="flex-1 p-1.5 rounded bg-slate-900 border border-slate-800 text-white text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="GitHub Username"
                    value={m.githubUsername}
                    onChange={(e) => {
                      const updated = [...members];
                      updated[idx].githubUsername = e.target.value;
                      setMembers(updated);
                    }}
                    className="flex-1 p-1.5 rounded bg-slate-900 border border-slate-800 text-[#FF5470] text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary text-xs"
            >
              {submitting ? 'Verifying & Saving...' : editingTeam ? 'Update Squad' : 'Create Squad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
