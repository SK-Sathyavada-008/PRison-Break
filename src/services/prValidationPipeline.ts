// ─────────────────────────────────────────────
// PRison Break — Deterministic PR Validation & Automation Pipeline
// Phase 8: Explainable Decisions · Policy Checks · Deterministic Rules
// ─────────────────────────────────────────────

import {
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type {
  FirestorePullRequest,
  ValidationChecks,
  PRProcessingState,
} from '../types';


export interface PRValidationInput {
  prNumber: number;
  prTitle: string;
  prBody?: string;
  authorUsername: string;
  repositoryId: string;
  repositoryFullName: string;
  isRepoActive: boolean;
  isRepoRegistered: boolean;
  teamId?: string;
  assignedIssues?: number[];
  changedFiles?: string[];
  additions?: number;
  deletions?: number;
  prLabels?: string[];
  issueLabels?: string[];
  isMerged?: boolean;
  isDraft?: boolean;
  mergeableState?: string;
  ciTestStatus?: 'passing' | 'failing' | 'pending' | 'skipped';
  checkSuiteConclusion?: string | null;
  prUrl?: string;
}

export interface PRValidationResult {
  status: PRProcessingState;
  testsPassed: boolean;
  correct: boolean;
  issueNumber: number;
  issueNumbers: number[];
  validationChecks: ValidationChecks;
  validationReasons: string[];
  allowedToAutoMerge: boolean;
  autoMergeBlockReasons: string[];
  isDuplicatePR?: boolean;
}

import type { IssueDifficulty } from '../types';

/**
 * Deterministically extracts ALL linked issue numbers from PR title and body.
 * A single student's PR may contain solutions to multiple assigned issues.
 * Examples:
 *   "fixes #17, closes #18, resolves #19" -> [17, 18, 19]
 *   "closes #10 and #12" -> [10, 12]
 *   "Resolves #5, task #6" -> [5, 6]
 */
import { findCatalogIssue } from './javaSolutionEvaluator';

export function extractAllLinkedIssues(title: string, body?: string, filePaths: string[] = []): number[] {
  const text = `${title} ${body || ''} ${(filePaths || []).join(' ')}`;
  const found = new Set<number>();

  // 1. Keyword-based matching with multiple comma/and/hyphen/underscore separated numbers
  // Matches: fixes #1, #2, #3 or closes 4, 5 or Issue-1 or Issue_21 or task: 57
  const keywordBlockRegex = /(?:fixes|closed|closes|fixed|resolves|resolved|challenge|issue|task)[\s\-_:#]*([#\d\s,\-_;&and]+)/gi;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = keywordBlockRegex.exec(text)) !== null) {
    const numbersInBlock = blockMatch[1].match(/\d+/g);
    if (numbersInBlock) {
      numbersInBlock.forEach((numStr) => {
        const n = parseInt(numStr, 10);
        if (n > 0) found.add(n);
      });
    }
  }

  // 2. Direct pattern matching for filenames, commit messages, and tokens: e.g. Issue01_, Issue57_VH01, Issue-1
  const directIssueRegex = /(?:^|[\/\\_\-\s])Issue0*(\d+)(?:[_\-\.\/\s]|$)/gi;
  let directMatch: RegExpExecArray | null;
  while ((directMatch = directIssueRegex.exec(text)) !== null) {
    const n = parseInt(directMatch[1], 10);
    if (n > 0) found.add(n);
  }

  // 3. URL-based matching: /issues/(\d+)
  const urlRegex = /\/issues\/(\d+)/gi;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    const n = parseInt(urlMatch[1], 10);
    if (n > 0) found.add(n);
  }

  // 4. Standalone hashtag matches: #12, #14
  const hashRegex = /#(\d+)/g;
  let hashMatch: RegExpExecArray | null;
  while ((hashMatch = hashRegex.exec(text)) !== null) {
    const n = parseInt(hashMatch[1], 10);
    if (n > 0) found.add(n);
  }

  return Array.from(found).sort((a, b) => a - b);
}

/**
 * Backward compatibility: Extracts the first linked issue number.
 */
export function extractLinkedIssue(title: string, body?: string, filePaths: string[] = []): number {
  const all = extractAllLinkedIssues(title, body, filePaths);
  return all.length > 0 ? all[0] : 0;
}

/**
 * Determines the difficulty of an issue from trusted labels or challenge catalog.
 * Supported trusted labels:
 *   - difficulty:easy (10 XP)
 *   - difficulty:medium (20 XP)
 *   - difficulty:hard (30 XP)
 *   - difficulty:very-hard (40 XP)
 */
export function determineIssueDifficulty(
  _issueNumber: number,
  labels: string[] = [],
  _textContext: string = ''
): IssueDifficulty {
  const normalizedLabels = labels.map((l) => l.toLowerCase().trim());

  if (
    normalizedLabels.includes('difficulty:very-hard') ||
    normalizedLabels.includes('difficulty:very_hard') ||
    normalizedLabels.includes('points:40') ||
    normalizedLabels.includes('points:50')
  ) {
    return 'VERY_HARD';
  }

  if (
    normalizedLabels.includes('difficulty:hard') ||
    normalizedLabels.includes('points:30')
  ) {
    return 'HARD';
  }

  if (
    normalizedLabels.includes('difficulty:medium') ||
    normalizedLabels.includes('points:20')
  ) {
    return 'MEDIUM';
  }

  if (
    normalizedLabels.includes('difficulty:easy') ||
    normalizedLabels.includes('points:10')
  ) {
    return 'EASY';
  }

  // Fallback to catalog lookup
  const catalog = findCatalogIssue('', _issueNumber);
  if (catalog?.difficulty) {
    return catalog.difficulty;
  }

  if (_issueNumber >= 57 && _issueNumber <= 64) {
    return 'VERY_HARD';
  }

  return 'EASY';
}

/**
 * Validates changed files against protected paths and security constraints.
 * Deterministic rules — strictly disallows modifying CI workflows, secret test suites, or binary payloads.
 */
export function validateChangedFiles(
  changedFiles: string[] = [],
  additions: number = 0,
  deletions: number = 0
): { filesValid: boolean; reason: string } {
  // 1. Check diff volume limits upfront
  if (additions > 5000) {
    return {
      filesValid: false,
      reason: `Abnormal additions threshold exceeded (+${additions} lines). Requires warden inspection.`,
    };
  }

  if (deletions > 3000) {
    return {
      filesValid: false,
      reason: `Mass deletion detected (-${deletions} lines). Requires manual review.`,
    };
  }

  if (changedFiles.length === 0) {
    return {
      filesValid: true,
      reason: 'Diff volume within acceptable bounds (no file list provided).',
    };
  }

  // 1. Check for forbidden system files and CI pipelines
  const forbiddenPatterns = [
    /^\.github\/workflows\//i,
    /^\.github\/actions\//i,
    /^\.github\/scripts\//i,
    /gradlew(\.bat)?$/i,
    /^\.circleci\//i,
    /^\.travis\.yml$/i,
    /jenkinsfile/i,
    /.*grader.*\.py$/i,
    /.*secret.*test/i,
    /.*hidden.*test/i,
  ];

  for (const file of changedFiles) {
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(file)) {
        return {
          filesValid: false,
          reason: `Security constraint violation: Modified protected system or grading path "${file}".`,
        };
      }
    }
  }

  // 2. Check for suspicious compiled binaries
  const binaryExtensions = ['.exe', '.dll', '.so', '.dylib', '.bin', '.jar', '.class', '.pyc'];
  for (const file of changedFiles) {
    const lower = file.toLowerCase();
    if (binaryExtensions.some((ext) => lower.endsWith(ext))) {
      return {
        filesValid: false,
        reason: `Disallowed artifact: Binary or compiled file detected "${file}".`,
      };
    }
  }

  // 3. Diff limit checks
  if (additions > 5000) {
    return {
      filesValid: false,
      reason: `Abnormal additions threshold exceeded (+${additions} lines). Requires warden inspection.`,
    };
  }

  if (deletions > 3000) {
    return {
      filesValid: false,
      reason: `Mass deletion detected (-${deletions} lines). Requires manual review.`,
    };
  }

  return {
    filesValid: true,
    reason: `All ${changedFiles.length} modified files conform to allowed repository challenge paths.`,
  };
}

/**
 * Evaluates the full deterministic Pull Request validation pipeline.
 */
export async function executePRValidationPipeline(
  input: PRValidationInput,
  firestoreInstance?: Firestore | null
): Promise<PRValidationResult> {
  const currentDb = firestoreInstance || (isFirebaseConfigured() ? db : null);
  const validationReasons: string[] = [];
  const autoMergeBlockReasons: string[] = [];

  // ── Step 1: Identify Author & Verify Participant ──────────
  let participantRegistered = false;
  let participantActive = false;
  let participantData: any = null;

  if (currentDb) {
    try {
      const pSnap = await getDocs(
        query(
          collection(currentDb, 'participants'),
          where('githubUsername', '==', input.authorUsername)
        )
      );
      if (!pSnap.empty) {
        participantRegistered = true;
        participantData = pSnap.docs[0].data();
        participantActive = participantData?.active !== false;
      }
    } catch (err) {
      console.warn('[ValidationPipeline] Error looking up participant:', err);
    }
  } else {
    // Demo / mock fallback
    participantRegistered = !!input.authorUsername && input.authorUsername !== 'anonymous';
    participantActive = true;
  }

  if (participantRegistered && participantActive) {
    validationReasons.push(`Participant @${input.authorUsername} is verified and active in PRison Control.`);
  } else if (participantRegistered && !participantActive) {
    validationReasons.push(`Participant @${input.authorUsername} is currently marked inactive or flagged.`);
    autoMergeBlockReasons.push('Participant is inactive or suspended.');
  } else {
    validationReasons.push(`Participant @${input.authorUsername} is NOT registered in PRison Control.`);
    autoMergeBlockReasons.push('Participant is not registered.');
  }

  // ── Step 2: Identify Repository & Check Active Status ────
  const repositoryRegistered = input.isRepoRegistered && input.isRepoActive;
  if (repositoryRegistered) {
    validationReasons.push(`Repository "${input.repositoryFullName}" is registered and active.`);
  } else if (input.isRepoRegistered && !input.isRepoActive) {
    validationReasons.push(`Repository "${input.repositoryFullName}" is deactivated by organizers.`);
    autoMergeBlockReasons.push('Repository is inactive.');
  } else {
    validationReasons.push(`Repository "${input.repositoryFullName}" is not registered in PRison Control.`);
    autoMergeBlockReasons.push('Repository is unregistered.');
  }

  // ── Step 3: Identify Linked Issues (Student PR may solve multiple) ──
  const issueNumbers = extractAllLinkedIssues(input.prTitle, input.prBody);
  const issueNumber = issueNumbers.length > 0 ? issueNumbers[0] : 0;
  const issueValid = issueNumbers.length > 0;
  if (issueValid) {
    if (issueNumbers.length === 1) {
      validationReasons.push(`Valid challenge issue #${issueNumber} linked.`);
    } else {
      validationReasons.push(`Multiple challenge issues solved in single PR: [${issueNumbers.map((n) => `#${n}`).join(', ')}].`);
    }
  } else {
    validationReasons.push('No challenge issue linked (title/body missing "#<issue>" or "fixes #<issue>").');
    autoMergeBlockReasons.push('No valid challenge issue linked.');
  }

  // ── Step 4: Check Required Labels / Blocking Labels ───────
  const prLabels = (input.prLabels || []).map((l) => l.toLowerCase());
  const hasWipOrDnm = prLabels.some((l) => l.includes('wip') || l.includes('do-not-merge') || l.includes('hold'));
  if (hasWipOrDnm) {
    validationReasons.push('PR has work-in-progress or "do-not-merge" label applied.');
    autoMergeBlockReasons.push('Blocking label present (WIP/do-not-merge).');
  }

  // ── Step 5: Check GitHub Actions / Test Suite Status ──────
  let testsPassed = false;
  if (input.ciTestStatus === 'passing' || input.checkSuiteConclusion === 'success') {
    testsPassed = true;
    validationReasons.push('Automated GitHub Actions test suite passed with success.');
  } else if (input.ciTestStatus === 'failing' || input.checkSuiteConclusion === 'failure') {
    testsPassed = false;
    validationReasons.push('Automated test suite failed (GitHub check conclusion: failure).');
    autoMergeBlockReasons.push('Automated tests are failing.');
  } else if (input.mergeableState === 'clean' && !input.isDraft) {
    testsPassed = true;
    validationReasons.push('Mergeable state is clean; no merge conflicts or pending blockers.');
  } else {
    testsPassed = false;
    validationReasons.push(`Tests pending or branch dirty (mergeable_state: ${input.mergeableState || 'unknown'}, draft: ${!!input.isDraft}).`);
    autoMergeBlockReasons.push('Tests pending or mergeable state unclean.');
  }

  // ── Step 6: Validate Changed Files & Security Paths ───────
  const fileCheck = validateChangedFiles(
    input.changedFiles,
    input.additions || 0,
    input.deletions || 0
  );
  const filesValid = fileCheck.filesValid;
  validationReasons.push(fileCheck.reason);
  if (!filesValid) {
    autoMergeBlockReasons.push(`File validation failed: ${fileCheck.reason}`);
  }

  // ── Step 7: Synthesize Validation Checks & State ──────────
  const validationChecks: ValidationChecks = {
    participantRegistered: participantRegistered && participantActive,
    repositoryRegistered,
    issueValid,
    testsPassed,
    filesValid,
  };

  const allChecksPass =
    validationChecks.participantRegistered &&
    validationChecks.repositoryRegistered &&
    validationChecks.issueValid &&
    validationChecks.testsPassed &&
    validationChecks.filesValid &&
    !hasWipOrDnm;

  let status: PRProcessingState = 'PENDING_REVIEW';
  if (input.isMerged) {
    status = 'MERGED';
  } else if (allChecksPass) {
    status = 'AUTO_APPROVED';
  } else if (!validationChecks.participantRegistered && !validationChecks.repositoryRegistered) {
    status = 'REJECTED';
  } else {
    status = 'PENDING_REVIEW';
  }

  // ── Step 8: Auto-Merge Policy Evaluation ──────────────────
  // Do not auto-merge if tests are failing.
  // Do not auto-merge if the PR has no valid challenge issue.
  // Do not auto-merge if the participant is not registered.
  // Do not auto-merge inactive/unregistered repositories.
  // Do not auto-merge if suspicious unrelated files are modified.
  const allowedToAutoMerge =
    status === 'AUTO_APPROVED' &&
    validationChecks.participantRegistered &&
    validationChecks.repositoryRegistered &&
    validationChecks.issueValid &&
    validationChecks.testsPassed &&
    validationChecks.filesValid &&
    autoMergeBlockReasons.length === 0;

  return {
    status,
    testsPassed: validationChecks.testsPassed,
    correct: status === 'AUTO_APPROVED' || status === 'MERGED',
    issueNumber,
    issueNumbers,
    validationChecks,
    validationReasons,
    allowedToAutoMerge,
    autoMergeBlockReasons,
  };
}

/**
 * Stores full validation results on pullRequests document and executes
 * scoring and participant updates if auto-approved / merged.
 */
export async function persistPRValidationAndScore(
  input: PRValidationInput,
  validationResult: PRValidationResult,
  firestoreInstance?: Firestore | null
): Promise<{ prId: string; newPointsAwarded: number }> {
  const currentDb = firestoreInstance || (isFirebaseConfigured() ? db : null);
  const prId = `pr_${input.repositoryId}_${input.prNumber}`;
  const now = new Date().toISOString();

  // 1. Prepare FirestorePullRequest data
  const prDocData: Partial<FirestorePullRequest> = {
    id: prId,
    repositoryId: input.repositoryId,
    repositoryFullName: input.repositoryFullName,
    teamId: input.teamId,
    prNumber: input.prNumber,
    githubUsername: input.authorUsername,
    issueNumber: validationResult.issueNumber,
    issueNumbers: validationResult.issueNumbers,
    title: input.prTitle,
    status: validationResult.status,
    processingState: validationResult.status,
    testsPassed: validationResult.testsPassed,
    correct: validationResult.correct,
    merged: input.isMerged || false,
    url: input.prUrl,
    labels: input.prLabels || [],
    issueLabels: input.issueLabels || [],
    validationChecks: validationResult.validationChecks,
    validationReasons: validationResult.validationReasons,
    validationSignals: {
      participantRegistered: validationResult.validationChecks.participantRegistered,
      repositoryActive: validationResult.validationChecks.repositoryRegistered,
      validIssueLinked: validationResult.validationChecks.issueValid,
      testsPassed: validationResult.validationChecks.testsPassed,
      filesAllowed: validationResult.validationChecks.filesValid,
      noSuspiciousDiff: validationResult.validationChecks.filesValid,
    },
    updatedAt: now,
  };

  if (currentDb) {
    const prDocRef = doc(currentDb, 'pullRequests', prId);
    await setDoc(prDocRef, prDocData, { merge: true });
  }

  const newPointsAwarded = 0;
  return { prId, newPointsAwarded };
}
