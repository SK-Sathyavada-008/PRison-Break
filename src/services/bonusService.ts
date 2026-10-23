// ─────────────────────────────────────────────
// PRison Break — Manual Bonus XP Service
// Append-only Ledger · Strict Validation · Concurrency Safe · Auditable
// totalXP = earnedXP + bonusXP (earnedXP is NEVER reduced or mutated by bonus awards)
// ─────────────────────────────────────────────

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  runTransaction,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { BonusTransaction, FirestoreTeam, AdminAuditLog } from '../types';
import { roundToTwoDecimals } from './javaGradingEngine';
import { teamService } from './teamService';

const BONUS_COLLECTION = 'bonusTransactions';
const AUDIT_COLLECTION = 'auditLogs';

// In-memory ledger for offline/demo operation and fast test execution
let inMemoryBonusTransactions: BonusTransaction[] = [];
const processedIdempotencyKeys = new Set<string>();
const bonusListeners = new Set<(transactions: BonusTransaction[]) => void>();

function notifyBonusListeners() {
  bonusListeners.forEach((fn) => fn([...inMemoryBonusTransactions]));
}

/**
 * Recursively cleans an object by removing any properties with `undefined` values.
 * Firestore strictly forbids `undefined` field values in set(), update(), or transaction.set().
 */
export function cleanFirestoreData<T extends Record<string, any>>(obj: T): T {
  const result: any = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        result[key] = cleanFirestoreData(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

export interface BonusAwardRequest {
  teamId: string;
  amount: number;
  reason: string;
  adminUsername: string;
  adminId?: string;
  idempotencyKey?: string;
}

export interface BonusAwardPreview {
  teamId: string;
  teamName: string;
  earnedXP: number;
  currentBonusXP: number;
  awardAmount: number;
  bonusAmount?: number;
  newBonusXP: number;
  currentTotalXP: number;
  newTotalXP: number;
}

export const bonusService = {
  /**
   * Resets in-memory state (useful for test isolation).
   */
  resetInMemoryState() {
    inMemoryBonusTransactions = [];
    processedIdempotencyKeys.clear();
    notifyBonusListeners();
  },

  /**
   * Generates a preview calculation of awarding bonus XP to a team.
   * Does NOT persist any changes.
   */
  async previewBonusAward(teamId: string, amount: number): Promise<BonusAwardPreview> {
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new Error('Bonus XP award must be a strictly positive number greater than 0.');
    }

    const team = await teamService.getTeamById(teamId);
    if (!team) {
      throw new Error(`Team "${teamId}" not found.`);
    }

    const earnedXP = team.earnedXP ?? (team.totalScore !== undefined && team.bonusXP !== undefined
      ? Math.max(0, roundToTwoDecimals(team.totalScore - (team.bonusXP || 0)))
      : (team.totalScore ?? 0));
    const currentBonusXP = team.bonusXP ?? 0;
    const roundedAmount = roundToTwoDecimals(amount);
    const newBonusXP = roundToTwoDecimals(currentBonusXP + roundedAmount);
    const currentTotalXP = team.totalXP ?? (team.totalScore ?? roundToTwoDecimals(earnedXP + currentBonusXP));
    const newTotalXP = roundToTwoDecimals(earnedXP + newBonusXP);

    return {
      teamId: team.id,
      teamName: team.name,
      earnedXP,
      currentBonusXP,
      awardAmount: roundedAmount,
      bonusAmount: roundedAmount,
      newBonusXP,
      currentTotalXP,
      newTotalXP,
    };
  },

  /**
   * Concurrency-safe award of manual bonus XP.
   * Strictly enforces:
   * - Positive amounts only (no subtraction, no negatives).
   * - Mandatory non-empty reason.
   * - Authorized admin identification.
   * - Duplicate request prevention via idempotency keys.
   * - earnedXP is strictly preserved.
   * - Appends to immutable bonusTransactions ledger and auditLogs.
   */
  async awardBonus(req: BonusAwardRequest): Promise<{
    success: boolean;
    transaction: BonusTransaction;
    bonusAmount?: number;
    newTotalXP: number;
  }> {
    // 1. Validation: Admin identity
    if (!req.adminUsername || !req.adminUsername.trim()) {
      throw new Error('Unauthorized: Admin username is required to award bonus XP.');
    }

    // 2. Validation: Positive bonus amount
    if (typeof req.amount !== 'number' || isNaN(req.amount) || req.amount <= 0) {
      throw new Error('Invalid bonus amount: Bonus XP award must be a strictly positive number greater than 0.');
    }

    // 3. Validation: Mandatory justification reason
    if (!req.reason || !req.reason.trim()) {
      throw new Error('A mandatory reason is required to award manual bonus XP.');
    }

    const roundedAmount = roundToTwoDecimals(req.amount);
    const now = new Date().toISOString();
    const idempotencyKey = req.idempotencyKey || `bonus_idem_${req.teamId}_${roundedAmount}_${req.reason.trim().toLowerCase().replace(/\\s+/g, '_')}`;

    // 4. Duplicate request detection (idempotency)
    if (processedIdempotencyKeys.has(idempotencyKey)) {
      const existing = inMemoryBonusTransactions.find((tx) => tx.idempotencyKey === idempotencyKey);
      if (existing) {
        return {
          success: true,
          transaction: existing,
          newTotalXP: existing.newTotalXP ?? 0,
        };
      }
    }

    const txId = `bonus_tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 5. Atomic transaction execution
    if (isFirebaseConfigured()) {
      const teamDocRef = doc(db, 'teams', req.teamId);
      const bonusDocRef = doc(db, BONUS_COLLECTION, txId);
      const auditDocRef = doc(db, AUDIT_COLLECTION, `audit_${txId}`);

      const result = await runTransaction(db, async (transaction) => {
        const teamDoc = await transaction.get(teamDocRef);
        if (!teamDoc.exists()) {
          throw new Error(`Team with ID "${req.teamId}" does not exist in Firestore.`);
        }

        const teamData = teamDoc.data() as FirestoreTeam;

        // Ensure earnedXP is correctly captured and preserved
        const existingEarnedXP = teamData.earnedXP ?? (
          teamData.totalScore !== undefined && teamData.bonusXP !== undefined
            ? Math.max(0, roundToTwoDecimals(teamData.totalScore - (teamData.bonusXP || 0)))
            : (teamData.totalScore ?? 0)
        );
        const previousBonusXP = teamData.bonusXP ?? 0;
        const newBonusXP = roundToTwoDecimals(previousBonusXP + roundedAmount);
        const previousTotalXP = teamData.totalXP ?? (teamData.totalScore ?? roundToTwoDecimals(existingEarnedXP + previousBonusXP));
        const newTotalXP = roundToTwoDecimals(existingEarnedXP + newBonusXP);

        const bonusTx: BonusTransaction = {
          id: txId,
          teamId: req.teamId,
          teamName: teamData.name || req.teamId,
          repositoryName: teamData.repositoryName || teamData.repositoryId || '',
          amount: roundedAmount,
          reason: req.reason.trim(),
          adminId: req.adminId || req.adminUsername.trim() || 'admin_warden',
          adminUsername: req.adminUsername.trim(),
          timestamp: now,
          idempotencyKey: idempotencyKey || txId,
          previousBonusXP,
          newBonusXP,
          previousTotalXP,
          newTotalXP,
        };

        const auditLog: AdminAuditLog = {
          id: `audit_${txId}`,
          action: 'MANUAL_BONUS_AWARD',
          teamId: req.teamId,
          performedBy: req.adminUsername.trim(),
          adminUsername: req.adminUsername.trim(),
          targetId: req.teamId,
          targetName: teamData.name || req.teamId,
          previousValue: { bonusXP: previousBonusXP, totalXP: previousTotalXP },
          newValue: { bonusXP: newBonusXP, totalXP: newTotalXP },
          details: {
            awardAmount: roundedAmount,
            reason: req.reason.trim(),
            transactionId: txId,
            earnedXPPreserved: existingEarnedXP,
          },
          reason: req.reason.trim(),
          timestamp: now,
        };

        // Write append-only transaction and audit record with clean data
        transaction.set(bonusDocRef, cleanFirestoreData(bonusTx));
        transaction.set(auditDocRef, cleanFirestoreData(auditLog));

        // Update team fields (earnedXP is NEVER changed by bonus)
        transaction.update(teamDocRef, {
          earnedXP: existingEarnedXP,
          bonusXP: newBonusXP,
          totalXP: newTotalXP,
          totalScore: newTotalXP, // Backwards compatibility for existing sorting
          updatedAt: now,
        });

        return { bonusTx, newTotalXP };
      });

      processedIdempotencyKeys.add(idempotencyKey);
      inMemoryBonusTransactions.push(result.bonusTx);
      notifyBonusListeners();

      return {
        success: true,
        transaction: result.bonusTx,
        bonusAmount: roundedAmount,
        newTotalXP: result.newTotalXP,
      };
    }

    // In-Memory fallback for tests or offline execution
    const team = await teamService.getTeamById(req.teamId);
    if (!team) {
      throw new Error(`Team with ID "${req.teamId}" does not exist.`);
    }

    const existingEarnedXP = team.earnedXP ?? (
      team.totalScore !== undefined && team.bonusXP !== undefined
        ? Math.max(0, roundToTwoDecimals(team.totalScore - (team.bonusXP || 0)))
        : (team.totalScore ?? 0)
    );
    const previousBonusXP = team.bonusXP ?? 0;
    const newBonusXP = roundToTwoDecimals(previousBonusXP + roundedAmount);
    const previousTotalXP = team.totalXP ?? (team.totalScore ?? roundToTwoDecimals(existingEarnedXP + previousBonusXP));
    const newTotalXP = roundToTwoDecimals(existingEarnedXP + newBonusXP);

    const bonusTx: BonusTransaction = {
      id: txId,
      teamId: req.teamId,
      teamName: team.name || req.teamId,
      repositoryName: team.repositoryName || team.repositoryId || '',
      amount: roundedAmount,
      reason: req.reason.trim(),
      adminId: req.adminId || req.adminUsername.trim() || 'admin_warden',
      adminUsername: req.adminUsername.trim(),
      timestamp: now,
      idempotencyKey: idempotencyKey || txId,
      previousBonusXP,
      newBonusXP,
      previousTotalXP,
      newTotalXP,
    };

    processedIdempotencyKeys.add(idempotencyKey);
    inMemoryBonusTransactions.push(bonusTx);
    notifyBonusListeners();

    // Update in-memory team record directly
    await teamService.updateTeam(req.teamId, {
      earnedXP: existingEarnedXP,
      bonusXP: newBonusXP,
      totalXP: newTotalXP,
      totalScore: newTotalXP,
      updatedAt: now,
    });

    return {
      success: true,
      transaction: bonusTx,
      bonusAmount: roundedAmount,
      newTotalXP,
    };
  },

  /**
   * Retrieves all bonus transactions for a team, sorted newest first.
   */
  async getTeamBonusTransactions(teamId: string): Promise<BonusTransaction[]> {
    if (isFirebaseConfigured()) {
      try {
        const q = query(collection(db, BONUS_COLLECTION), where('teamId', '==', teamId));
        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => d.data() as BonusTransaction);
        return docs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } catch (err) {
        console.error('[BonusService] Firestore error getting team transactions:', err);
      }
    }

    return inMemoryBonusTransactions
      .filter((tx) => tx.teamId === teamId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  /**
   * Real-time subscription to a team's bonus transactions.
   */
  subscribeToTeamBonusTransactions(
    teamId: string,
    callback: (transactions: BonusTransaction[]) => void
  ): Unsubscribe {
    if (isFirebaseConfigured()) {
      const q = query(collection(db, BONUS_COLLECTION), where('teamId', '==', teamId));
      return onSnapshot(
        q,
        (snap) => {
          const docs = snap.docs.map((d) => d.data() as BonusTransaction);
          const sorted = docs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          callback(sorted);
        },
        (err) => {
          console.error('[BonusService] onSnapshot error:', err);
          callback(inMemoryBonusTransactions.filter((tx) => tx.teamId === teamId));
        }
      );
    }

    const handler = (txs: BonusTransaction[]) => {
      callback(txs.filter((t) => t.teamId === teamId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    };
    bonusListeners.add(handler);
    handler(inMemoryBonusTransactions);

    return () => {
      bonusListeners.delete(handler);
    };
  },
};
