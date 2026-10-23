// ─────────────────────────────────────────────
// PRison Break — Deterministic Java Grading Engine
// Formula: awardedPoints = round2(basePoints * (0.70 * C + 0.20 * Q + 0.10 * M))
// Beginner Syllabus · Sandbox Execution · Duplicate Protection · Auditable
// ─────────────────────────────────────────────

import type {
  IssueDifficulty,
  GradingStatus,
  IssueGradingRecord,
  AdminAuditLog,
} from '../types';
import { ISSUE_DIFFICULTY_POINTS } from '../types';
import { sandboxRunner, type PRChangedFile, type SandboxTestResult } from './sandboxRunner';
import { db, isFirebaseConfigured } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';

export const RUBRIC_VERSION = 'v1.0-beginner-java';

export const SCORING_WEIGHTS = {
  CORRECTNESS: 0.70,
  CODE_QUALITY: 0.20,
  COMMIT_QUALITY: 0.10,
} as const;

export interface IssueGradingInput {
  issueNumber: number;
  difficulty: IssueDifficulty;
  studentUsername: string;
  assignedStudentIssues: number[];
  teamId?: string;
  repositoryId: string;
  prNumber: number;
  changedFiles: PRChangedFile[];
  commitMessages?: string[];
  commits?: Array<{ sha?: string; message: string; author?: string; email?: string; timestamp?: string }>;
  commitAuthors?: string[];
  testExecutionResult?: {
    compiles?: boolean;
    compilationPassed?: boolean;
    testsPassed?: number;
    testsFailed?: number;
    totalTests?: number;
    normalInputsPassed?: boolean;
    edgeCasesPassed?: boolean;
    outputMatchesExpected?: boolean;
  };
  expectedOutput?: string;
  referenceSolutionSnippet?: string;
  mockExecutionResult?: {
    compiles?: boolean;
    testsPassed?: number;
    testsFailed?: number;
    totalTests?: number;
    normalInputsPassed?: boolean;
    edgeCasesPassed?: boolean;
    timeout?: boolean;
    crash?: boolean;
    outputMatchesExpected?: boolean;
  };
  codeAnalysis?: {
    singleLetterVariables?: boolean;
    unnecessaryComplexity?: boolean;
    deepNestingOrEmptyCatch?: boolean;
    missingBasicBoundaryCheck?: boolean;
    unrelatedFilesTouched?: boolean;
    hardcodedOutputDetected?: boolean;
    bypassedRequiredConcept?: boolean;
    emptyCommitsDetected?: boolean;
    duplicateCommitsDetected?: boolean;
    formattingOnlyCommitsDetected?: boolean;
    isStructurallyAlternative?: boolean;
    resemblesReferenceButBroken?: boolean;
  };
  existingTeamSolvedIssues?: number[];
  aiReviewSignal?: {
    aiPassed?: boolean;
    aiScoreEstimate?: number;
    commentary?: string;
  };
}

/**
 * Rounds a number to exactly two decimal places, preventing floating-point accumulation errors.
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates awarded points based on base points and normalized component scores:
 * awardedPoints = basePoints * (0.70 * C + 0.20 * Q + 0.10 * M)
 */
export function calculateAwardedPoints(
  basePoints: number,
  correctness: number,
  codeQuality: number,
  commitQuality: number
): number {
  const c = Math.max(0, Math.min(1, correctness));
  const q = Math.max(0, Math.min(1, codeQuality));
  const m = Math.max(0, Math.min(1, commitQuality));

  const weightedSum =
    SCORING_WEIGHTS.CORRECTNESS * c +
    SCORING_WEIGHTS.CODE_QUALITY * q +
    SCORING_WEIGHTS.COMMIT_QUALITY * m;

  return roundToTwoDecimals(basePoints * weightedSum);
}

export const javaGradingEngine = {
  /**
   * Evaluates Correctness (C: 70% weight) based on reproducible evidence from the isolated sandbox.
   */
  async evaluateCorrectness(
    input: IssueGradingInput
  ): Promise<{
    score: number;
    deductions: string[];
    explanation: string;
    sandboxResult: SandboxTestResult;
  }> {
    const deductions: string[] = [];

    // Run tests in isolated sandbox
    const sandboxResult = await sandboxRunner.executeJavaTests({
      repositoryId: input.repositoryId,
      prNumber: input.prNumber,
      studentUsername: input.studentUsername,
      changedFiles: input.changedFiles,
      mockExecutionResult: input.mockExecutionResult,
    });

    // Case 1: Sandbox environment unavailable
    if (sandboxResult.status === 'SANDBOX_UNAVAILABLE') {
      return {
        score: 0,
        deductions: ['Automated execution sandbox unavailable — requires manual evaluation.'],
        explanation: 'Execution could not be verified automatically. Code sent to manual review.',
        sandboxResult,
      };
    }

    // Case 2: Test tampering or suite weakening attempt detected
    if (sandboxResult.tamperingDetected || sandboxResult.status === 'TAMPERING_DETECTED') {
      deductions.push(
        'Security Violation: PR attempted to modify, delete, or weaken test assertions/annotations.'
      );
      return {
        score: 0,
        deductions,
        explanation:
          'Correctness score 0.00: Solution rejected due to unauthorized test tampering.',
        sandboxResult,
      };
    }

    // Case 2b: Hardcoded output detection without algorithmic computation
    if (input.codeAnalysis?.hardcodedOutputDetected) {
      deductions.push(
        'Suspicious Submission: Hardcoded output detected without algorithmic computation (-0.80).'
      );
      return {
        score: 0.10,
        deductions,
        explanation:
          'Correctness score 0.10: Program hardcodes expected output rather than implementing required logic.',
        sandboxResult,
      };
    }

    // Case 2c: Algorithmic concept bypass (e.g. calling library sort when task asks for sorting algorithm)
    if (input.codeAnalysis?.bypassedRequiredConcept) {
      deductions.push(
        'Concept Bypass: Solution bypassed required algorithm using forbidden library shortcut (-0.50).'
      );
      return {
        score: 0.50,
        deductions,
        explanation:
          'Correctness score 0.50: Algorithm requirement bypassed with library utility.',
        sandboxResult,
      };
    }

    // Case 3: Compilation failure
    if (!sandboxResult.compilationPassed) {
      deductions.push(
        `Compilation failure: ${sandboxResult.compilationError || 'Syntax or type errors in submitted code.'}`
      );
      return {
        score: 0,
        deductions,
        explanation: 'Correctness score 0.00: Java solution does not compile.',
        sandboxResult,
      };
    }

    // Case 4: Process timeout or crash (possible infinite loop or OOM)
    if (sandboxResult.status === 'TIMEOUT') {
      deductions.push('Execution timeout: Code exceeded 10-second limit (possible infinite loop).');
      return {
        score: 0,
        deductions,
        explanation: 'Correctness score 0.00: Execution timed out in sandbox.',
        sandboxResult,
      };
    }

    if (sandboxResult.status === 'CRASHED') {
      deductions.push('Process crash: JVM terminated unexpectedly or exceeded memory limit.');
      return {
        score: 0,
        deductions,
        explanation: 'Correctness score 0.00: Execution crashed.',
        sandboxResult,
      };
    }

    // Case 5: Evaluate tests output
    const total = sandboxResult.totalTests || 1;
    const passed = sandboxResult.testsPassed || 0;

    if (total === 0 || passed === 0) {
      deductions.push('All unit test cases failed.');
      return {
        score: 0,
        deductions,
        explanation: 'Correctness score 0.00: All automated test assertions failed.',
        sandboxResult,
      };
    }

    if (passed === total) {
      const altNote = input.codeAnalysis?.isStructurallyAlternative
        ? ' (Alternative valid beginner implementation verified).'
        : '';
      return {
        score: 1.0,
        deductions: [],
        explanation: `All ${total} automated unit tests and edge cases passed successfully.${altNote}`,
        sandboxResult,
      };
    }

    // Standard inputs pass, but edge cases fail
    if (sandboxResult.normalInputsPassed && !sandboxResult.edgeCasesPassed) {
      deductions.push(
        `Edge case failures: Solution handles basic inputs but fails boundary/edge tests (${passed}/${total} passed).`
      );
      return {
        score: 0.70,
        deductions,
        explanation:
          'Correctness score 0.70: Basic requirements met, but edge case handling failed.',
        sandboxResult,
      };
    }

    // Proportional score
    const ratio = roundToTwoDecimals(passed / total);
    deductions.push(`Failed ${sandboxResult.testsFailed} of ${total} tests.`);
    return {
      score: ratio,
      deductions,
      explanation: `Correctness score ${ratio}: ${passed}/${total} test cases passed.`,
      sandboxResult,
    };
  },

  /**
   * Evaluates Code Quality (Q: 20% weight) tailored to beginner Java syllabus.
   * Does NOT penalize harmless formatting differences or require advanced patterns.
   */
  evaluateCodeQuality(
    input: IssueGradingInput
  ): {
    score: number;
    deductions: string[];
    explanation: string;
  } {
    let score = 1.0;
    const deductions: string[] = [];

    const analysis = input.codeAnalysis || {};

    // 1. Variable naming and readability (single-letter non-loop variables)
    if (analysis.singleLetterVariables) {
      score -= 0.10;
      deductions.push(
        'Naming readability: Single-letter or obscure variable names used outside loop indexes (-0.10).'
      );
    }

    // 2. Control flow discipline (empty catch blocks or deep unreadable nesting)
    if (analysis.deepNestingOrEmptyCatch) {
      score -= 0.15;
      deductions.push(
        'Control flow: Overly deep nested conditionals (>4 levels) or empty catch blocks (-0.15).'
      );
    }

    // 3. Unnecessary complexity (over-engineered reflection/proxies for beginner task)
    if (analysis.unnecessaryComplexity) {
      score -= 0.15;
      deductions.push(
        'Complexity: Unnecessary advanced patterns (e.g. reflection) where basic Java constructs suffice (-0.15).'
      );
    }

    // 4. Scope discipline: modified files outside assigned issue boundaries
    const hasScopeViolation =
      analysis.unrelatedFilesTouched ||
      input.changedFiles.some((f) => {
        const lower = f.filename.toLowerCase();
        return (
          lower.startsWith('.github/') ||
          lower.endsWith('pom.xml') ||
          lower.endsWith('.gitignore') ||
          lower.includes('docker')
        );
      });

    if (hasScopeViolation) {
      score -= 0.20;
      deductions.push(
        'Scope discipline: Modified project configuration or files unrelated to assigned issue (-0.20).'
      );
    }

    // 5. Basic boundary check (array length - 1, null checks)
    if (analysis.missingBasicBoundaryCheck) {
      score -= 0.10;
      deductions.push(
        'Edge case awareness: Missing basic boundary or null check in method arguments (-0.10).'
      );
    }

    // 6. Concept / Algorithm Bypass
    if (analysis.bypassedRequiredConcept) {
      score -= 0.50;
      deductions.push(
        'Concept Bypass: Bypassed required concept using forbidden library shortcut (-0.50).'
      );
    }

    score = Math.max(0, Math.min(1, roundToTwoDecimals(score)));

    const explanation =
      deductions.length === 0
        ? 'Code quality is clear, well-structured, and appropriate for beginner Java syllabus (1.00).'
        : `Code quality score ${score}: ${deductions.join(' ')}`;

    return { score, deductions, explanation };
  },

  /**
   * Evaluates Commit Quality (M: 10% weight).
   * High commit count does NOT inflate score. Substantive messages referencing issue are rewarded.
   * Cross-checks commit author against verified PR student author.
   */
  evaluateCommitQuality(
    input: IssueGradingInput
  ): {
    score: number;
    deductions: string[];
    explanation: string;
    authorMismatch: boolean;
  } {
    let score = 1.0;
    const deductions: string[] = [];
    let authorMismatch = false;

    // 1. Check commit author identity against verified GitHub PR student
    if (input.commitAuthors && input.commitAuthors.length > 0) {
      const cleanStudent = input.studentUsername.toLowerCase();
      const mismatched = input.commitAuthors.filter(
        (author) => !author.toLowerCase().includes(cleanStudent)
      );

      if (mismatched.length > 0) {
        authorMismatch = true;
        score -= 0.20;
        deductions.push(
          `Attribution Conflict: Commit author (${mismatched.join(', ')}) does not match registered student @${input.studentUsername} (-0.20).`
        );
      }
    }

    // 2. Check commit messages for usefulness
    const messages = input.commitMessages || [];
    if (messages.length === 0) {
      score -= 0.30;
      deductions.push('No commit history found in submission (-0.30).');
    } else {
      const vagueMessages = messages.filter((msg) => {
        const lower = msg.trim().toLowerCase();
        return (
          lower === 'update' ||
          lower === 'changes' ||
          lower === 'fixes' ||
          lower === 'asdf' ||
          lower === '.' ||
          lower.length < 4
        );
      });

      if (vagueMessages.length > 0) {
        score -= 0.20;
        deductions.push(
          `Uninformative commit messages detected: "${vagueMessages.join('", "')}" (-0.20).`
        );
      }

      // Check if beginner commit format like "Fix issue #12" or "Solved #12" is present
      const referencesIssue = messages.some((msg) =>
        new RegExp(`(issue|#|fixes)\\s*#?${input.issueNumber}\\b`, 'i').test(msg)
      );

      if (!referencesIssue && messages.length > 0) {
        // Minor deduction if no commit ties changes to this issue number
        score -= 0.10;
        deductions.push(
          `Commit message does not explicitly reference issue #${input.issueNumber} (-0.10).`
        );
      }
    }

    // 3. Detect empty commits / no-op commits
    if (input.codeAnalysis?.emptyCommitsDetected) {
      score -= 0.20;
      deductions.push('Empty commits: Commits with zero effective changes do not earn commit quality credit (-0.20).');
    }

    // 4. Detect duplicate commits or repeated patches
    if (input.codeAnalysis?.duplicateCommitsDetected) {
      score -= 0.20;
      deductions.push('Duplicate commits: Repeated identical patches without progress (-0.20).');
    }

    // 5. Detect repeated formatting-only commits
    if (input.codeAnalysis?.formattingOnlyCommitsDetected) {
      score -= 0.20;
      deductions.push('Formatting-only changes: Repeated cosmetic commits unrelated to assigned task (-0.20).');
    }

    score = Math.max(0, Math.min(1, roundToTwoDecimals(score)));

    const explanation =
      deductions.length === 0
        ? 'Commit history is substantive, clearly organized, and correctly traces to the issue (1.00).'
        : `Commit quality score ${score}: ${deductions.join(' ')}`;

    return { score, deductions, explanation, authorMismatch };
  },

  /**
   * Main grading pipeline for a single issue.
   * Performs attribution check, duplicate prevention, deterministic sandbox tests,
   * rubric evaluation, and calculates awardedPoints = basePoints * (0.70*C + 0.20*Q + 0.10*M).
   */
  async gradeIssue(input: IssueGradingInput): Promise<IssueGradingRecord> {
    const basePoints = ISSUE_DIFFICULTY_POINTS[input.difficulty] || 10;
    const now = new Date().toISOString();

    // 1. Attribution check: Ensure student is actually assigned to this issue
    const isAssigned = (input.assignedStudentIssues || []).includes(input.issueNumber);
    if (!isAssigned) {
      return {
        issueNumber: input.issueNumber,
        difficulty: input.difficulty,
        basePoints,
        maxPoints: basePoints,
        rawComponentScores: { correctness: 0, codeQuality: 0, commitQuality: 0 },
        formula: 'basePoints * (0.70 * C + 0.20 * Q + 0.10 * M)',
        rubricVersion: RUBRIC_VERSION,
        awardedPoints: 0,
        gradingStatus: 'PENDING_REVIEW',
        gradingExplanation: `Issue Attribution Failure: Issue #${input.issueNumber} is NOT assigned to student @${input.studentUsername}. 0 points awarded. Flagged for organizer review.`,
        gradedAt: now,
        deductions: {
          correctness: [`Unassigned issue: Student is not registered for issue #${input.issueNumber}.`],
          codeQuality: [],
          commitQuality: [],
        },
        evidence: {
          compilationPassed: false,
          testTamperingDetected: false,
          unassignedIssueDetected: true,
          authorMismatch: false,
          sandboxAvailable: true,
        },
      };
    }

    // 2. Duplicate protection: Check if team already received credit for this issue
    const alreadyCredited = (input.existingTeamSolvedIssues || []).includes(input.issueNumber);
    if (alreadyCredited) {
      return {
        issueNumber: input.issueNumber,
        difficulty: input.difficulty,
        basePoints,
        maxPoints: basePoints,
        rawComponentScores: { correctness: 0, codeQuality: 0, commitQuality: 0 },
        formula: 'basePoints * (0.70 * C + 0.20 * Q + 0.10 * M)',
        rubricVersion: RUBRIC_VERSION,
        awardedPoints: 0,
        gradingStatus: 'REJECTED',
        gradingExplanation: `Duplicate issue credit blocked: Team ${input.teamId} has already earned points for Issue #${input.issueNumber}. Points can only be awarded once per squad.`,
        gradedAt: now,
        deductions: {
          correctness: ['Duplicate credit: Issue already solved for this team.'],
          codeQuality: [],
          commitQuality: [],
        },
        evidence: {
          compilationPassed: true,
          testTamperingDetected: false,
          unassignedIssueDetected: false,
          authorMismatch: false,
          sandboxAvailable: true,
        },
      };
    }

    const commitMessages = input.commitMessages || input.commits?.map((c) => c.message) || [];
    const commitAuthors = input.commitAuthors || input.commits?.map((c) => c.author || '').filter((a) => !!a) || [];
    const mockExecutionResult = input.mockExecutionResult || input.testExecutionResult;
    const normalizedInput: IssueGradingInput = {
      ...input,
      commitMessages,
      commitAuthors,
      mockExecutionResult,
    };

    // 3. Evaluate Correctness (C: 70%)
    const correctnessResult = await this.evaluateCorrectness(normalizedInput);

    // 4. Handle Sandbox Failure / Unavailable
    if (correctnessResult.sandboxResult.status === 'SANDBOX_UNAVAILABLE') {
      return {
        issueNumber: input.issueNumber,
        difficulty: input.difficulty,
        basePoints,
        maxPoints: basePoints,
        rawComponentScores: { correctness: 0, codeQuality: 0, commitQuality: 0 },
        formula: 'basePoints * (0.70 * C + 0.20 * Q + 0.10 * M)',
        rubricVersion: RUBRIC_VERSION,
        awardedPoints: 0,
        gradingStatus: 'GRADING_FAILED',
        gradingExplanation:
          'Automated execution sandbox is unavailable. Solution queued for organizer manual review.',
        gradedAt: now,
        deductions: {
          correctness: ['Sandbox environment unavailable.'],
          codeQuality: [],
          commitQuality: [],
        },
        evidence: {
          compilationPassed: false,
          testTamperingDetected: false,
          unassignedIssueDetected: false,
          authorMismatch: false,
          sandboxAvailable: false,
        },
      };
    }

    // 5. Evaluate Code Quality (Q: 20%)
    const qualityResult = this.evaluateCodeQuality(normalizedInput);

    // 6. Evaluate Commit Quality (M: 10%)
    const commitResult = this.evaluateCommitQuality(normalizedInput);

    // 7. Calculate Final Points with Formula
    const awardedPoints = calculateAwardedPoints(
      basePoints,
      correctnessResult.score,
      qualityResult.score,
      commitResult.score
    );

    // 8. Determine Grading Status
    let gradingStatus: GradingStatus = 'AUTO_GRADED';
    if (correctnessResult.sandboxResult.tamperingDetected) {
      gradingStatus = 'PENDING_REVIEW';
    } else if (commitResult.authorMismatch) {
      gradingStatus = 'PENDING_REVIEW';
    } else if (correctnessResult.score === 0) {
      gradingStatus = 'REJECTED';
    } else if (correctnessResult.score === 1.0 && qualityResult.score >= 0.8) {
      gradingStatus = 'AUTO_GRADED';
    }

    // 9. Secondary AI signal check
    let aiSignalNote = '';
    if (input.aiReviewSignal) {
      if (!correctnessResult.sandboxResult.compilationPassed && input.aiReviewSignal.aiPassed) {
        aiSignalNote =
          ' [Notice: Secondary AI review marked code as passing, but deterministic compiler failed. Deterministic test result is authoritative.]';
      }
    }

    const gradingExplanation =
      `Awarded ${awardedPoints} / ${basePoints} pts. [C: ${(correctnessResult.score * 100).toFixed(0)}%, Q: ${(qualityResult.score * 100).toFixed(0)}%, M: ${(commitResult.score * 100).toFixed(0)}%]. ` +
      `Correctness: ${correctnessResult.explanation} ` +
      `Quality: ${qualityResult.explanation} ` +
      `Commits: ${commitResult.explanation}` +
      aiSignalNote;

    return {
      issueNumber: input.issueNumber,
      difficulty: input.difficulty,
      basePoints,
      maxPoints: basePoints,
      rawComponentScores: {
        correctness: correctnessResult.score,
        codeQuality: qualityResult.score,
        commitQuality: commitResult.score,
      },
      formula: 'basePoints * (0.70 * C + 0.20 * Q + 0.10 * M)',
      rubricVersion: RUBRIC_VERSION,
      awardedPoints,
      gradingStatus,
      gradingExplanation,
      gradedAt: now,
      deductions: {
        correctness: correctnessResult.deductions,
        codeQuality: qualityResult.deductions,
        commitQuality: commitResult.deductions,
      },
      evidence: {
        compilationPassed: correctnessResult.sandboxResult.compilationPassed,
        testsPassed: correctnessResult.sandboxResult.testsPassed,
        testsFailed: correctnessResult.sandboxResult.testsFailed,
        totalTests: correctnessResult.sandboxResult.totalTests,
        normalInputsPassed: correctnessResult.sandboxResult.normalInputsPassed,
        edgeCasesPassed: correctnessResult.sandboxResult.edgeCasesPassed,
        testTamperingDetected: correctnessResult.sandboxResult.tamperingDetected,
        scopeViolations: qualityResult.deductions.filter((d) => d.includes('Scope discipline')),
        unassignedIssueDetected: false,
        authorMismatch: commitResult.authorMismatch,
        sandboxAvailable: true,
        hardcodedOutputDetected: !!input.codeAnalysis?.hardcodedOutputDetected,
        conceptBypassed: !!input.codeAnalysis?.bypassedRequiredConcept,
        emptyCommitsDetected: !!input.codeAnalysis?.emptyCommitsDetected,
        duplicateCommitsDetected: !!input.codeAnalysis?.duplicateCommitsDetected,
        formattingOnlyDetected: !!input.codeAnalysis?.formattingOnlyCommitsDetected,
        isStructurallyAlternative: !!input.codeAnalysis?.isStructurallyAlternative,
      },
    };
  },

  /**
   * Records a manual grading override with audit logging in Firestore.
   */
  async overrideGradeWithAudit(
    issueRecord: IssueGradingRecord,
    newPoints: number,
    adminName: string,
    reason: string,
    teamId?: string
  ): Promise<AdminAuditLog> {
    if (!reason || !reason.trim()) {
      throw new Error('Audit justification is required for manual grading override.');
    }

    const now = new Date().toISOString();
    const auditId = `audit_grade_override_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const auditLog: AdminAuditLog = {
      id: auditId,
      action: 'MANUAL_GRADING_OVERRIDE',
      teamId,
      issueNumber: issueRecord.issueNumber,
      performedBy: adminName,
      details: {
        previousPoints: issueRecord.awardedPoints,
        newPoints,
        rubricVersion: issueRecord.rubricVersion,
        basePoints: issueRecord.basePoints,
        componentScores: issueRecord.rawComponentScores,
      },
      reason: reason.trim(),
      timestamp: now,
    };

    if (isFirebaseConfigured()) {
      await setDoc(doc(db, 'auditLogs', auditId), auditLog);
    }

    issueRecord.awardedPoints = newPoints;
    issueRecord.gradingStatus = 'APPROVED';
    issueRecord.gradingExplanation += ` [Manual override by ${adminName}: ${newPoints} pts. Reason: ${reason.trim()}]`;

    return auditLog;
  },
};
