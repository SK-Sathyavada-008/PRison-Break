// ─────────────────────────────────────────────
// PRison Control — Core Types & Firestore Models
// ─────────────────────────────────────────────

export type ParticipantStatus = 'active' | 'inactive' | 'flagged' | 'escaped';
export type RepositoryStatus = 'active' | 'inactive' | 'archived';
export type PRProcessingState = 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | 'MERGED';
export type PRStatus = 'open' | 'merged' | 'closed' | 'flagged' | 'pending' | PRProcessingState;
export type EventStatus = 'ongoing' | 'completed' | 'upcoming';
export type TestStatus = 'passing' | 'failing' | 'skipped' | 'pending';

// ── OFFLINE HACKATHON ISSUE & TEAM MODELS ───────────

export type IssueDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'VERY_HARD';

export const ISSUE_DIFFICULTY_POINTS: Record<IssueDifficulty, number> = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 30,
  VERY_HARD: 40,
};

export type IssueGradingStatus =
  | 'UNGRADED'
  | 'GRADED'
  | 'PENDING'
  | 'REJECTED'
  | 'RECEIVED'
  | 'WAITING_FOR_TESTS'
  | 'AUTO_GRADED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'MERGED'
  | 'GRADING_FAILED';

export type GradingStatus =
  | 'RECEIVED'
  | 'WAITING_FOR_TESTS'
  | 'AUTO_GRADED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'MERGED'
  | 'GRADING_FAILED';

export interface IssueComponentScores {
  correctness: number; // 0.00 to 1.00 (weight 0.70)
  codeQuality: number; // 0.00 to 1.00 (weight 0.20)
  commitQuality: number; // 0.00 to 1.00 (weight 0.10)
}

export interface IssueGradingRecord {
  issueNumber: number;
  difficulty: IssueDifficulty;
  basePoints: number; // 10, 20, 30, or 40
  maxPoints: number;
  rawComponentScores: IssueComponentScores;
  formula: string; // "basePoints * (0.70 * C + 0.20 * Q + 0.10 * M)"
  rubricVersion: string; // e.g. "v1.0-beginner-java"
  awardedPoints: number; // rounded to 2 decimal places
  gradingStatus: GradingStatus;
  gradingExplanation: string;
  gradedAt: string;
  configVersion?: number;
  gradingRunId?: string;
  weightedContribution?: {
    correctness: number;
    codeQuality: number;
    commitQuality: number;
  };
  humanReviewAdjustment?: {
    previousScore: number;
    newScore: number;
    adminUsername: string;
    reason: string;
    timestamp: string;
  };
  deductions: {
    correctness: string[];
    codeQuality: string[];
    commitQuality: string[];
  };
  evidence: {
    compilationPassed: boolean;
    testsPassed?: number;
    testsFailed?: number;
    totalTests?: number;
    normalInputsPassed?: boolean;
    edgeCasesPassed?: boolean;
    testTamperingDetected: boolean;
    scopeViolations?: string[];
    unassignedIssueDetected: boolean;
    authorMismatch: boolean;
    sandboxAvailable: boolean;
  };
}

export interface FirestoreIssue {
  id: string; // e.g. "issue_squard_1_10"
  repositoryId: string;
  repositoryFullName?: string;
  issueNumber: number;
  title: string;
  difficulty: IssueDifficulty;
  basePoints: number; // 10, 20, 30, or 40
  assignedStudentId?: string;
  assignedStudentUsername?: string;
  teamId?: string;
  url: string;
  active: boolean;
  gradingStatus: IssueGradingStatus;
  correctnessScore?: number;
  qualityScore?: number;
  commitQualityScore?: number;
  finalScore?: number;
  rawComponentScores?: IssueComponentScores;
  rubricVersion?: string;
  maxPoints?: number;
  awardedPoints?: number;
  gradingExplanation?: string;
  gradedAt?: string;
  deductions?: {
    correctness: string[];
    codeQuality: string[];
    commitQuality: string[];
  };
  evidence?: Record<string, any>;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

export type Issue = FirestoreIssue;

export interface TeamMember {
  studentId: string;
  name: string;
  githubUsername: string;
  teamId?: string;
  repositoryId?: string;
  assignedIssues: number[];
  prSubmitted?: boolean;
  prNumber?: number;
  prUrl?: string;
  prStatus?: string;
  issueScores?: Record<number, number>;
  score?: number;
  totalScore?: number;
  validationStatus?: string;
}

export interface SolvedIssue {
  issueNumber: number;
  difficulty: IssueDifficulty;
  points: number;
  solvedByUsername: string;
  prNumber: number;
  solvedAt: string;
  title?: string;
  correctnessScore?: number; // C normalized (0 - 1.0)
  codeQualityScore?: number; // Q normalized (0 - 1.0)
  commitQualityScore?: number; // M normalized (0 - 1.0)
  explanation?: string;
  prStatus?: string;
}

export interface FirestoreTeam {
  id: string; // e.g. "team_squard_1"
  name: string; // e.g. "Squad 1"
  repositoryId: string; // e.g. "squard_1"
  repositoryName: string; // e.g. "squard_1" (The actual registered repository name displayed on public leaderboard)
  repositoryFullName?: string; // e.g. "PRison-Break-2026/squard_1"
  members: TeamMember[]; // Exactly 4 registered student members for active competition team
  totalScore: number;
  assignedIssueCount: number; // Number of assigned issues
  validatedIssueCount: number; // Number of correctly solved issues
  correctlySolvedIssuesCount?: number;
  veryHardSolvedCount: number; // Number of accurately solved Very Hard issues
  veryHardScore?: number; // Total points from Very Hard solved issues
  correctnessScoreTotal?: number; // Total correctness score across validated issues
  validSubmissionsCount?: number; // Number of registered students with valid submissions
  submissionStatus?: 'ALL_VALID' | 'PARTIAL' | 'PENDING_PRS';
  prsSubmitted: number;
  solvedIssues: SolvedIssue[];
  lastMergedAt?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Team extends FirestoreTeam {
  rank: number;
  previousRank: number;
  rankText?: string; // e.g. "#1" or "T-1"
  isTied?: boolean;
}

export interface AwardsSummary {
  champions: Team[]; // 1st Place — PRison Break Champions (may be tied)
  runnerUp: Team[]; // 2nd Place — Runner-Up
  thirdPlace: Team[]; // 3rd Place — Third Place
  veryHardSpecialist: {
    winners: Team[];
    highestCount: number;
    highestScore: number;
    isTied: boolean;
  };
}

export interface AdminAuditLog {
  id: string;
  action:
    | 'PARTICIPANT_REPLACEMENT'
    | 'REPOSITORY_REASSIGNMENT'
    | 'TEAM_ACTIVATION'
    | 'TEAM_DEACTIVATION'
    | 'ISSUE_REASSIGNMENT'
    | 'SCORE_OVERRIDE'
    | 'MANUAL_GRADING_OVERRIDE'
    | 'TEST_MANIPULATION_DETECTED'
    | 'ATTRIBUTION_CONFLICT'
    | 'PR_APPROVAL'
    | 'PR_REJECTION'
    | 'PR_REQUEST_REVIEW';
  teamId?: string;
  repositoryId?: string;
  issueNumber?: number;
  prNumber?: number;
  studentUsername?: string;
  performedBy?: string;
  adminUsername?: string;
  targetId?: string;
  targetName?: string;
  previousValue?: any;
  newValue?: any;
  details: Record<string, any>;
  reason: string;
  timestamp: string;
}

// ── FIRESTORE SCHEMAS (Phase 2 & Phase 7) ───────────

/**
 * Collection: participants
 */
export interface FirestoreParticipant {
  id: string;
  name: string;
  githubUsername: string;
  avatarUrl?: string;
  teamId?: string;
  teamName?: string;
  assignedIssues?: number[];
  totalScore: number;
  prCount: number;
  mergedPrCount: number;
  escapedCells: number;
  firstSuccessfulPr?: string | null;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Collection: repositories
 */
export interface FirestoreRepository {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  githubUrl: string;
  teamId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationChecks {
  participantRegistered: boolean;
  repositoryRegistered: boolean;
  issueValid: boolean;
  testsPassed: boolean;
  filesValid: boolean;
}

export interface FirestorePullRequest {
  id: string;
  repositoryId: string;
  repositoryFullName?: string;
  prNumber: number;
  githubUsername: string;
  issueNumber: number;
  issueNumbers?: number[];
  solvedIssueNumbers?: number[];
  issueDifficulty?: IssueDifficulty;
  solvedIssues?: SolvedIssue[];
  teamId?: string;
  hasMultiplePRViolation?: boolean;
  title: string;
  status: PRStatus | string;
  processingState?: PRProcessingState;
  testsPassed: boolean;
  correct: boolean;
  merged: boolean;
  score: number;
  labels?: string[];
  issueLabels?: string[];
  url?: string;
  validationChecks?: ValidationChecks;
  validationReasons?: string[];
  validationSignals?: {
    participantRegistered?: boolean;
    repositoryActive?: boolean;
    validIssueLinked?: boolean;
    testsPassed?: boolean;
    filesAllowed?: boolean;
    noSuspiciousDiff?: boolean;
  };
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  baseBranch?: string;
  headBranch?: string;
  baseCommitSha?: string;
  headCommitSha?: string;
  commitShas?: string[];
  commitMessages?: string[];
  commits?: Array<{ sha: string; message: string; author?: string; email?: string; timestamp?: string }>;
  changedFilesList?: Array<{ filename: string; status?: string; additions?: number; deletions?: number; patch?: string }>;
  associatedAssignedIssueIds?: number[];
  checkRunResults?: Record<string, any>;
  isDraft?: boolean;
  attributionWarnings?: string[];
  duplicateSubmissionWarning?: boolean;
  gradingRecords?: IssueGradingRecord[];
  aiValidation?: {
    verdict?: 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED';
    confidence?: number;
    summary?: string;
    feedback?: string;
    codeQuality?: string;
    autoMergeAllowed?: boolean;
    autoMergeBlockedReason?: string;
    evaluatedAt?: string;
    model?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Collection: scoreEvents
 */
export interface FirestoreScoreEvent {
  id: string;
  teamId?: string;
  teamName?: string;
  participantId: string;
  participantName?: string;
  githubUsername?: string;
  type: string;
  points: number;
  basePoints?: number;
  componentScores?: IssueComponentScores;
  rubricVersion?: string;
  formula?: string;
  prId?: string;
  prNumber?: number;
  repositoryId?: string;
  repositoryFullName?: string;
  issueId?: string;
  issueNumber?: number;
  reason?: string;
  idempotencyKey?: string;
  timestamp: string;
}

/**
 * Collection: reviews
 */
export interface FirestoreReview {
  id: string;
  prId: string;
  prNumber?: number;
  repositoryId?: string;
  status: string;
  reason: string;
  reviewedBy: string;
  pointsAwarded?: number;
  createdAt: string;
}

export interface EventScoringWeights {
  correctness: number; // 0.70
  codeQuality: number; // 0.20
  commitQuality: number; // 0.10
}

/**
 * Collection: eventConfig
 */
export interface FirestoreEventConfig {
  eventName: string;
  tagline?: string;
  status: string;
  active: boolean; // Active event status
  requiredTeamSize: number; // 4
  maxCompetitionPRsPerStudent: number; // 1
  difficultyPoints: {
    EASY: number; // 10
    MEDIUM: number; // 20
    HARD: number; // 30
    VERY_HARD: number; // 40
  };
  weights: EventScoringWeights;
  veryHardAccuracyThreshold: number; // 0.95
  baseBranch: string; // 'main'
  permittedSourceFilePatterns: string[]; // ['src/**/*.java']
  testExecutionConfig: {
    timeoutMs: number;
    memoryLimitMb: number;
    sandboxProfile: string;
  };
  manualReviewPolicy: 'ALL' | 'FLAGGED_ONLY' | 'ANOMALIES_ONLY';
  submissionDeadline?: string;
  gradingFreeze: boolean;
  version: number;
  updatedBy?: string;
  updateReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationDiscrepancy {
  id: string;
  type: 'CACHED_SCORE_MISMATCH' | 'DUPLICATE_ISSUE_AWARD' | 'MISSING_REFERENCE' | 'DUPLICATE_COMPETITION_PR';
  severity: 'ERROR' | 'WARNING';
  teamId?: string;
  repositoryId?: string;
  studentUsername?: string;
  prNumber?: number;
  issueNumber?: number;
  cachedValue?: any;
  calculatedValue?: any;
  description: string;
}

export interface ReconciliationReport {
  timestamp: string;
  totalTeamsAudited: number;
  totalScoreEventsAudited: number;
  totalPullRequestsAudited: number;
  discrepancies: ReconciliationDiscrepancy[];
  isHealthy: boolean;
  calculatedTeamScores: Record<string, number>;
  cachedTeamScores: Record<string, number>;
}

/**
 * Collection: webhookEvents
 */
export type WebhookProcessingStatus = 'RECEIVED' | 'PROCESSED' | 'IGNORED' | 'FAILED';

export interface FirestoreWebhookEvent {
  deliveryId: string;
  eventType: string;
  action: string;
  repositoryId: string;
  repositoryFullName: string;
  receivedAt: string;
  processingStatus: WebhookProcessingStatus;
  processedAt?: string;
  error?: string | null;
  normalizedData?: Record<string, any>;
  rawPayload?: Record<string, any>;
}

export type WebhookEvent = FirestoreWebhookEvent;

// ── UI-FACING INTERFACES ──────────────────────────

export interface Participant {
  id: string;
  name: string;
  githubUsername: string;
  avatarUrl?: string;
  teamId?: string;
  teamName?: string;
  assignedIssues?: number[];
  xp: number;
  totalScore?: number;
  prs: number;
  prCount?: number;
  mergedPRs: number;
  mergedPrCount?: number;
  escapedCells: number;
  firstSuccessfulPr?: string | null;
  active?: boolean;
  rank: number;
  previousRank: number;
  status: ParticipantStatus;
  joinedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  fullName?: string;
  githubUrl: string;
  teamId?: string;
  description?: string;
  status: RepositoryStatus;
  active?: boolean;
  issues: number;
  prs: number;
  stars: number;
  language?: string;
  addedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  repository: string;
  repositoryId?: string;
  repositoryFullName?: string;
  author: string;
  githubUsername: string;
  issueNumber?: number;
  issueNumbers?: number[];
  solvedIssueNumbers?: number[];
  issueDifficulty?: IssueDifficulty;
  solvedIssues?: SolvedIssue[];
  teamId?: string;
  hasMultiplePRViolation?: boolean;
  status: PRStatus;
  processingState?: PRProcessingState;
  testStatus: TestStatus;
  testsPassed?: boolean;
  correct?: boolean;
  merged?: boolean;
  score: number;
  labels?: string[];
  issueLabels?: string[];
  validationChecks?: ValidationChecks;
  validationReasons?: string[];
  validationSignals?: {
    participantRegistered?: boolean;
    repositoryActive?: boolean;
    validIssueLinked?: boolean;
    testsPassed?: boolean;
    filesAllowed?: boolean;
    noSuspiciousDiff?: boolean;
  };
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  aiValidation?: {
    verdict?: 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED';
    confidence?: number;
    summary?: string;
    feedback?: string;
    codeQuality?: string;
    autoMergeAllowed?: boolean;
    autoMergeBlockedReason?: string;
    evaluatedAt?: string;
    model?: string;
  };
  createdAt: string;
  updatedAt?: string;
  mergedAt?: string;
  url?: string;
  baseBranch?: string;
  headBranch?: string;
  baseCommitSha?: string;
  headCommitSha?: string;
  commitShas?: string[];
  commitMessages?: string[];
  commits?: Array<{ sha: string; message: string; author?: string; email?: string; timestamp?: string }>;
  changedFilesList?: Array<{ filename: string; status?: string; additions?: number; deletions?: number; patch?: string }>;
  associatedAssignedIssueIds?: number[];
  checkRunResults?: Record<string, any>;
  isDraft?: boolean;
  attributionWarnings?: string[];
  duplicateSubmissionWarning?: boolean;
  gradingRecords?: IssueGradingRecord[];
}

export interface ScoreEvent {
  id: string;
  participantId: string;
  participantName: string;
  githubUsername: string;
  teamId?: string;
  teamName?: string;
  event: string;
  type?: string;
  points: number;
  prNumber?: number;
  prId?: string;
  issueNumber?: number;
  issueId?: string;
  difficulty?: IssueDifficulty;
  repository?: string;
  reason?: string;
  timestamp: string;
}

export interface DashboardStats {
  totalParticipants: number;
  totalTeams?: number;
  totalRepositories: number;
  totalPRs: number;
  mergedPRs: number;
  pendingReviews: number;
  flaggedPRs: number;
  totalXP: number;
  topParticipant?: string;
  topTeam?: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

export type AdminPage =
  | 'dashboard'
  | 'teams'
  | 'participants'
  | 'repositories'
  | 'pull-requests'
  | 'leaderboard'
  | 'score-events'
  | 'webhook-events'
  | 'settings';
