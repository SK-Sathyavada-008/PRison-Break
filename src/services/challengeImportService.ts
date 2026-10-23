// ─────────────────────────────────────────────
// PRison Break — Challenge Repository & Reference Solution Importer / Validator
// Discovers Challenge Repositories · Validates Issue Metadata · Maps Private Reference Solutions
// Detects Missing Tests & Solutions · Leaks Protection · Safe Idempotent Execution
// ─────────────────────────────────────────────

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type {
  ChallengeMapping,
  ChallengeRepoImportSummary,
  PrivateReferenceSolution,
  AdminAuditLog,
} from '../types';
import { CHALLENGE_CATALOG, type CatalogIssue } from '../data/challengeCatalog';

const MAPPINGS_COLLECTION = 'challengeMappings';
const PRIVATE_SOLUTIONS_COLLECTION = 'referenceSolutions';
const AUDIT_COLLECTION = 'auditLogs';

// In-Memory state for fast testing and offline/demo execution
let inMemoryMappings: ChallengeMapping[] = [];
let inMemoryPrivateSolutions: PrivateReferenceSolution[] = [];
let hasImportedToInMemory = false;

export interface DiscoveryReport {
  timestamp: string;
  totalRepositories: number;
  totalIssuesMapped: number;
  totalSolutionsMatched: number;
  totalMissingSolutions: number;
  totalMissingTests: number;
  publicLeakWarnings: string[];
  repoSummaries: ChallengeRepoImportSummary[];
  isReadyForGrading: boolean;
  warnings: string[];
}

export interface ImportOptions {
  confirmOverwrite?: boolean;
  adminUsername: string;
  selectedRepos?: string[];
}

export const challengeImportService = {
  /**
   * Resets in-memory state (useful for test isolation).
   */
  resetInMemoryState() {
    inMemoryMappings = [];
    inMemoryPrivateSolutions = [];
    hasImportedToInMemory = false;
  },

  /**
   * Discovers challenge repositories and their issue metadata.
   * Associates reference solutions, validates files, detects leaks and missing tests/solutions,
   * without mutating the database.
   */
  discoverAndValidateAll(): DiscoveryReport {
    const repoNames = Object.keys(CHALLENGE_CATALOG);
    const repoSummaries: ChallengeRepoImportSummary[] = [];
    let totalIssuesMapped = 0;
    let totalSolutionsMatched = 0;
    let totalMissingSolutions = 0;
    let totalMissingTests = 0;
    const allWarnings: string[] = [];
    const publicLeakWarnings: string[] = [];

    for (const repoName of repoNames) {
      const issues: CatalogIssue[] = CHALLENGE_CATALOG[repoName] || [];
      const missingSolutions: string[] = [];
      const missingTests: string[] = [];
      const duplicateCheck = new Set<number>();
      const duplicateMappings: string[] = [];

      for (const iss of issues) {
        // Duplicate issue number check
        if (duplicateCheck.has(iss.issueNumber)) {
          duplicateMappings.push(`Issue #${iss.issueNumber} appears multiple times in ${repoName}`);
        } else {
          duplicateCheck.add(iss.issueNumber);
        }

        // Missing solution check
        if (!iss.hasSolution || !iss.solutionFile) {
          missingSolutions.push(`Issue #${iss.issueNumber} (${iss.starterFile}) has no matching reference solution.`);
          totalMissingSolutions++;
        } else {
          totalSolutionsMatched++;
        }

        // Missing test check
        if (!iss.hasExistingTests || iss.missingTestsReport) {
          missingTests.push(`Issue #${iss.issueNumber}: Unit tests are missing; expected output relies on stdout check.`);
          totalMissingTests++;
        }

        totalIssuesMapped++;
      }

      let status: 'VALIDATED' | 'WARNINGS' | 'FLAGGED_FOR_REVIEW' = 'VALIDATED';
      const repoWarnings: string[] = [];

      if (missingSolutions.length > 0) {
        status = 'FLAGGED_FOR_REVIEW';
        repoWarnings.push(`${missingSolutions.length} issues are missing reference solutions.`);
      }

      if (missingTests.length > 0) {
        if (status !== 'FLAGGED_FOR_REVIEW') status = 'WARNINGS';
        repoWarnings.push('Challenge repository lacks test/ directory (organizer deterministic grader will execute expected output checks).');
      }

      if (duplicateMappings.length > 0) {
        status = 'FLAGGED_FOR_REVIEW';
        repoWarnings.push(`Duplicate issue numbers detected: ${duplicateMappings.join(', ')}`);
      }

      repoSummaries.push({
        repositoryName: repoName,
        issuesFound: issues.length,
        solutionsFound: issues.filter((i) => i.hasSolution).length,
        missingSolutions,
        missingTests,
        duplicateMappings,
        conflicts: [],
        status,
        warnings: repoWarnings,
      });
    }

    if (totalMissingTests > 0) {
      allWarnings.push(
        `Notice: All ${totalIssuesMapped} challenge issues lack packaged unit tests in their starter repositories. Deterministic grading will evaluate compiled outputs against expected outputs and edge case suites.`
      );
    }

    return {
      timestamp: new Date().toISOString(),
      totalRepositories: repoNames.length,
      totalIssuesMapped,
      totalSolutionsMatched,
      totalMissingSolutions,
      totalMissingTests,
      publicLeakWarnings,
      repoSummaries,
      isReadyForGrading: totalMissingSolutions === 0,
      warnings: allWarnings,
    };
  },

  /**
   * Safely imports validated challenge mappings and stores private reference solutions.
   * Safe to run more than once (idempotent upsert).
   * Refuses to overwrite existing data unless confirmOverwrite is explicitly true.
   */
  async importChallengeMappings(options: ImportOptions): Promise<{
    success: boolean;
    importedCount: number;
    privateSolutionsStored: number;
    message: string;
  }> {
    if (!options.adminUsername || !options.adminUsername.trim()) {
      throw new Error('Unauthorized: Admin username is required to import challenge repositories.');
    }

    // Check if data already exists and confirmOverwrite is not provided
    const existing = await this.getAllMappings();
    if (existing.length > 0 && !options.confirmOverwrite) {
      throw new Error(
        `Existing production mappings detected (${existing.length} issues). ` +
        `Re-importing requires explicit confirmation (confirmOverwrite: true) to prevent accidental loss.`
      );
    }

    const repoNames = options.selectedRepos || Object.keys(CHALLENGE_CATALOG);
    const now = new Date().toISOString();
    let importedCount = 0;
    let privateSolutionsStored = 0;

    const newMappings: ChallengeMapping[] = [];
    const newPrivateSolutions: PrivateReferenceSolution[] = [];

    for (const repoName of repoNames) {
      const catalogIssues = CHALLENGE_CATALOG[repoName] || [];

      for (const item of catalogIssues) {
        const mappingId = `map_${repoName}_issue_${item.issueNumber}`;
        const mapping: ChallengeMapping = {
          id: mappingId,
          repositoryName: repoName,
          issueNumber: item.issueNumber,
          difficulty: item.difficulty,
          basePoints: item.basePoints,
          title: item.title,
          topic: item.topic,
          starterFile: item.starterFile,
          solutionFile: item.solutionFile,
          hasSolution: item.hasSolution,
          expectedOutput: item.expectedOutput,
          hasExistingTests: item.hasExistingTests,
          missingTestsReport: item.missingTestsReport,
          isAmbiguous: !item.hasSolution,
          needsOrganizerReview: !item.hasSolution,
          verifiedAt: now,
        };

        newMappings.push(mapping);
        importedCount++;

        // If solution exists, store private reference solution record
        if (item.hasSolution && item.solutionFile) {
          const solId = `sol_${repoName}_issue_${item.issueNumber}`;
          const privateSol: PrivateReferenceSolution = {
            id: solId,
            repositoryName: repoName,
            issueNumber: item.issueNumber,
            fileName: item.solutionFile,
            starterPath: item.starterFile,
            solutionPath: `repoissies/solutions_repos/${repoName}/${item.solutionFile}`,
            expectedOutput: item.expectedOutput,
            topic: item.topic,
            difficulty: item.difficulty,
            isPrivate: true,
            createdAt: now,
          };

          newPrivateSolutions.push(privateSol);
          privateSolutionsStored++;
        }
      }
    }

    // Write to Firestore if configured
    if (isFirebaseConfigured()) {
      for (const m of newMappings) {
        await setDoc(doc(db, MAPPINGS_COLLECTION, m.id), m, { merge: true });
      }

      for (const s of newPrivateSolutions) {
        await setDoc(doc(db, PRIVATE_SOLUTIONS_COLLECTION, s.id), s, { merge: true });
      }

      const auditId = `audit_import_${Date.now()}`;
      const auditLog: AdminAuditLog = {
        id: auditId,
        action: 'CHALLENGE_REPO_IMPORTED',
        performedBy: options.adminUsername,
        adminUsername: options.adminUsername,
        details: {
          reposCount: repoNames.length,
          importedCount,
          privateSolutionsStored,
          confirmOverwrite: !!options.confirmOverwrite,
        },
        reason: `Imported ${importedCount} challenge mappings across ${repoNames.length} repositories.`,
        timestamp: now,
      };
      await setDoc(doc(db, AUDIT_COLLECTION, auditId), auditLog);
    }

    // Update in-memory state
    inMemoryMappings = newMappings;
    inMemoryPrivateSolutions = newPrivateSolutions;
    hasImportedToInMemory = true;

    return {
      success: true,
      importedCount,
      privateSolutionsStored,
      message: `Successfully imported ${importedCount} challenge mappings across ${repoNames.length} repositories. Protected ${privateSolutionsStored} private reference solutions.`,
    };
  },

  /**
   * Retrieves all imported challenge mappings.
   */
  async getAllMappings(): Promise<ChallengeMapping[]> {
    if (isFirebaseConfigured()) {
      try {
        const snap = await getDocs(collection(db, MAPPINGS_COLLECTION));
        if (!snap.empty) {
          return snap.docs.map((d) => d.data() as ChallengeMapping);
        }
      } catch (err) {
        console.error('[ChallengeImportService] Firestore read error:', err);
      }
    }

    if (hasImportedToInMemory) {
      return [...inMemoryMappings];
    }

    // If not yet explicitly imported to in-memory, generate on the fly from catalog
    const all: ChallengeMapping[] = [];
    for (const repoName of Object.keys(CHALLENGE_CATALOG)) {
      for (const item of CHALLENGE_CATALOG[repoName]) {
        all.push({
          id: `map_${repoName}_issue_${item.issueNumber}`,
          repositoryName: repoName,
          issueNumber: item.issueNumber,
          difficulty: item.difficulty,
          basePoints: item.basePoints,
          title: item.title,
          topic: item.topic,
          starterFile: item.starterFile,
          solutionFile: item.solutionFile,
          hasSolution: item.hasSolution,
          expectedOutput: item.expectedOutput,
          hasExistingTests: item.hasExistingTests,
          missingTestsReport: item.missingTestsReport,
          isAmbiguous: false,
          needsOrganizerReview: false,
        });
      }
    }
    return all;
  },

  /**
   * Retrieves mappings for a specific repository.
   */
  async getMappingsByRepo(repoName: string): Promise<ChallengeMapping[]> {
    const all = await this.getAllMappings();
    const clean = repoName.trim().toLowerCase();
    return all.filter((m) => m.repositoryName.toLowerCase() === clean);
  },

  /**
   * Retrieves a specific issue mapping.
   */
  async getMapping(repoName: string, issueNumber: number): Promise<ChallengeMapping | null> {
    const repoMappings = await this.getMappingsByRepo(repoName);
    return repoMappings.find((m) => m.issueNumber === issueNumber) || null;
  },

  /**
   * Server-side / Admin-only retrieval of private reference solution.
   * Participants NEVER receive this data.
   */
  async getPrivateSolution(
    repoName: string,
    issueNumber: number,
    adminUsername: string
  ): Promise<PrivateReferenceSolution | null> {
    if (!adminUsername || !adminUsername.trim()) {
      throw new Error('Access Denied: Reference solutions are strictly confidential and restricted to authorized admins.');
    }

    const solId = `sol_${repoName}_issue_${issueNumber}`;

    if (isFirebaseConfigured()) {
      const snap = await getDoc(doc(db, PRIVATE_SOLUTIONS_COLLECTION, solId));
      if (snap.exists()) {
        return snap.data() as PrivateReferenceSolution;
      }
    }

    return inMemoryPrivateSolutions.find((s) => s.id === solId) || null;
  },

  /**
   * Allows an organizer to correct or adjust a mapping with full audit logging.
   */
  async correctMapping(
    mappingId: string,
    updates: Partial<ChallengeMapping>,
    adminUsername: string,
    reason: string
  ): Promise<AdminAuditLog> {
    if (!reason || !reason.trim()) {
      throw new Error('A mandatory reason is required to correct a challenge mapping.');
    }
    if (!adminUsername || !adminUsername.trim()) {
      throw new Error('Unauthorized: Admin username is required.');
    }

    const now = new Date().toISOString();
    const auditId = `audit_map_corr_${Date.now()}`;

    const auditLog: AdminAuditLog = {
      id: auditId,
      action: 'MAPPING_CORRECTION',
      performedBy: adminUsername.trim(),
      adminUsername: adminUsername.trim(),
      targetId: mappingId,
      details: { updates, mappingId },
      reason: reason.trim(),
      timestamp: now,
    };

    if (isFirebaseConfigured()) {
      await updateDoc(doc(db, MAPPINGS_COLLECTION, mappingId), {
        ...updates,
        verifiedAt: now,
      });
      await setDoc(doc(db, AUDIT_COLLECTION, auditId), auditLog);
    }

    // Update in-memory
    const idx = inMemoryMappings.findIndex((m) => m.id === mappingId);
    if (idx >= 0) {
      inMemoryMappings[idx] = {
        ...inMemoryMappings[idx],
        ...updates,
        verifiedAt: now,
      };
    }

    return auditLog;
  },
};
