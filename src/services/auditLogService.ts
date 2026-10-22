// ─────────────────────────────────────────────
// Audit Log Service — Immutable Admin & Grading Audit Trail
// Tracks manual score adjustments, review decisions, and participant replacements
// ─────────────────────────────────────────────

import {
  collection,
  doc,
  getDocs,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { AdminAuditLog } from '../types';

const COLLECTION_NAME = 'auditLogs';

export const initialMockAuditLogs: AdminAuditLog[] = [
  {
    id: 'audit_init_1',
    action: 'SCORE_OVERRIDE',
    adminUsername: 'lead_organizer',
    reason: 'Offline judge confirmed edge case handling for MatrixRotate',
    targetId: 'team_squard_1',
    targetName: 'Squad 1 — Issue #1',
    previousValue: 9.0,
    newValue: 10.0,
    details: { previousPoints: 9.0, newPoints: 10.0 },
    timestamp: '2026-10-22T08:15:00Z',
  },
  {
    id: 'audit_init_2',
    action: 'PR_APPROVAL',
    adminUsername: 'lead_organizer',
    reason: 'Verified beginner Java loop compliance on PR #42',
    targetId: 'pr_squard_1_42',
    targetName: 'PR #42 (@rahul123)',
    previousValue: 'PENDING_REVIEW',
    newValue: 'AUTO_APPROVED',
    details: {},
    timestamp: '2026-10-22T08:20:00Z',
  },
  {
    id: 'audit_init_3',
    action: 'PARTICIPANT_REPLACEMENT',
    adminUsername: 'head_judge',
    reason: 'Student device failure prior to competition start',
    targetId: 'team_squard_3',
    targetName: 'Squad 3',
    previousValue: 'student_old',
    newValue: 'rohan-g',
    details: {},
    timestamp: '2026-10-21T17:30:00Z',
  },
];

let inMemoryAuditLogs: AdminAuditLog[] = [...initialMockAuditLogs];
const listeners = new Set<(logs: AdminAuditLog[]) => void>();

export const auditLogService = {
  /**
   * Fetches the latest audit logs.
   */
  async getAuditLogs(maxCount: number = 50): Promise<AdminAuditLog[]> {
    if (!isFirebaseConfigured()) {
      return [...inMemoryAuditLogs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, maxCount);
    }

    try {
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(maxCount));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return inMemoryAuditLogs.slice(0, maxCount);
      }

      return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    } catch (error) {
      console.warn('[AuditLogService] Error fetching audit logs:', error);
      return inMemoryAuditLogs.slice(0, maxCount);
    }
  },

  /**
   * Subscribes to live audit logs in real time.
   */
  subscribeToAuditLogs(
    onUpdate: (logs: AdminAuditLog[]) => void,
    maxCount: number = 50
  ): Unsubscribe {
    if (!isFirebaseConfigured()) {
      listeners.add(onUpdate);
      const sorted = [...inMemoryAuditLogs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, maxCount);
      onUpdate(sorted);
      return () => {
        listeners.delete(onUpdate);
      };
    }

    try {
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(maxCount));
      return onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            onUpdate(inMemoryAuditLogs.slice(0, maxCount));
            return;
          }

          const logs = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          })) as AdminAuditLog[];
          onUpdate(logs);
        },
        (error) => {
          console.error('[AuditLogService] Snapshot error:', error);
          onUpdate(inMemoryAuditLogs.slice(0, maxCount));
        }
      );
    } catch (error) {
      console.warn('[AuditLogService] Subscription setup failed:', error);
      onUpdate(inMemoryAuditLogs.slice(0, maxCount));
      return () => {};
    }
  },

  /**
   * Persists an audit log entry.
   */
  async recordAuditLog(log: AdminAuditLog): Promise<void> {
    inMemoryAuditLogs.unshift(log);
    listeners.forEach((fn) => fn([...inMemoryAuditLogs]));

    if (!isFirebaseConfigured()) return;

    try {
      const docRef = doc(db, COLLECTION_NAME, log.id);
      await setDoc(docRef, log);
    } catch (error) {
      console.error('[AuditLogService] Error recording audit log:', error);
    }
  },
};
