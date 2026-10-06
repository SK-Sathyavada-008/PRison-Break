// ─────────────────────────────────────────────
// PRison Control — Core Types & Firestore Models
// ─────────────────────────────────────────────

export type ParticipantStatus = 'active' | 'inactive' | 'flagged' | 'escaped';
export type RepositoryStatus = 'active' | 'inactive' | 'archived';
export type PRProcessingState = 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | 'MERGED';
export type PRStatus = 'open' | 'merged' | 'closed' | 'flagged' | 'pending' | PRProcessingState;
export type EventStatus = 'ongoing' | 'completed' | 'upcoming';
export type TestStatus = 'passing' | 'failing' | 'skipped' | 'pending';

// ── FIRESTORE SCHEMAS (Phase 2 & Phase 7) ───────────

/**
 * Collection: participants
 */
export interface FirestoreParticipant {
  id: string;
  name: string;
  githubUsername: string;
  avatarUrl?: string;
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
  participantId: string;
  participantName?: string;
  githubUsername?: string;
  type: string;
  points: number;
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

/**
 * Collection: eventConfig
 */
export interface FirestoreEventConfig {
  eventName: string;
  tagline: string;
  status: string;
  createdAt: string;
  updatedAt: string;
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
}

export interface ScoreEvent {
  id: string;
  participantId: string;
  participantName: string;
  githubUsername: string;
  event: string;
  type?: string;
  points: number;
  prNumber?: number;
  prId?: string;
  issueNumber?: number;
  issueId?: string;
  repository?: string;
  reason?: string;
  timestamp: string;
}

export interface DashboardStats {
  totalParticipants: number;
  totalRepositories: number;
  totalPRs: number;
  mergedPRs: number;
  pendingReviews: number;
  flaggedPRs: number;
  totalXP: number;
  topParticipant?: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

export type AdminPage =
  | 'dashboard'
  | 'participants'
  | 'repositories'
  | 'pull-requests'
  | 'leaderboard'
  | 'score-events'
  | 'webhook-events'
  | 'settings';
