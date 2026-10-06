// ─────────────────────────────────────────────
// Participant Service — Firestore Operations & Live Leaderboard
// ─────────────────────────────────────────────

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { Participant, FirestoreParticipant, ScoreEvent } from '../types';
import { mockParticipants, mockScoreEvents } from '../data/mockData';
import { scoreEventService } from './scoreEventService';

const COLLECTION_NAME = 'participants';

// In-memory cache for demo/offline mode
let inMemoryParticipants: Participant[] = mockParticipants.map((p) => ({
  ...p,
  active: p.status !== 'inactive',
  totalScore: p.xp,
  prCount: p.prs,
  mergedPrCount: p.mergedPRs,
}));
const listeners = new Set<(participants: Participant[]) => void>();

function notifyListeners() {
  const sorted = sortParticipants(inMemoryParticipants).map((p, index) => ({
    ...p,
    rank: index + 1,
  }));
  listeners.forEach((fn) => fn(sorted));
}

// Track previous ranks across real-time updates for animations
const rankHistory = new Map<string, number>();

/**
 * Deterministic sorting algorithm for public leaderboard:
 * 1. totalScore descending
 * 2. mergedPrCount descending
 * 3. earliest successful PR timestamp (firstSuccessfulPr) ascending
 * Tie-breaker: createdAt ascending, then githubUsername alphabetical
 */
export function sortParticipants(participants: Participant[]): Participant[] {
  return [...participants].sort((a, b) => {
    // 1. totalScore descending
    const scoreA = a.totalScore ?? a.xp ?? 0;
    const scoreB = b.totalScore ?? b.xp ?? 0;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // 2. mergedPrCount descending
    const mergedA = a.mergedPrCount ?? a.mergedPRs ?? 0;
    const mergedB = b.mergedPrCount ?? b.mergedPRs ?? 0;
    if (mergedB !== mergedA) {
      return mergedB - mergedA;
    }

    // 3. earliest successful PR timestamp ascending (earlier timestamp = higher rank)
    const timeA = a.firstSuccessfulPr ? new Date(a.firstSuccessfulPr).getTime() : Infinity;
    const timeB = b.firstSuccessfulPr ? new Date(b.firstSuccessfulPr).getTime() : Infinity;
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // Tie-breaker 1: createdAt ascending
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (createdA !== createdB) {
      return createdA - createdB;
    }

    // Tie-breaker 2: githubUsername alphabetical
    return (a.githubUsername || '').localeCompare(b.githubUsername || '');
  });
}

/**
 * Converts a Firestore participant document into the UI-ready Participant model.
 */
export function mapFirestoreToParticipant(
  data: FirestoreParticipant,
  rank: number = 0,
  prevRank: number = 0
): Participant {
  const isActive = data.active ?? true;
  const status = !isActive
    ? 'inactive'
    : data.escapedCells > 0
    ? 'escaped'
    : 'active';

  return {
    id: data.id,
    name: data.name ?? 'Unknown Prisoner',
    githubUsername: data.githubUsername ?? 'anonymous',
    avatarUrl: `https://github.com/${data.githubUsername}.png`,
    xp: data.totalScore ?? 0,
    totalScore: data.totalScore ?? 0,
    prs: data.prCount ?? 0,
    prCount: data.prCount ?? 0,
    mergedPRs: data.mergedPrCount ?? 0,
    mergedPrCount: data.mergedPrCount ?? 0,
    escapedCells: data.escapedCells ?? 0,
    firstSuccessfulPr: data.firstSuccessfulPr ?? null,
    active: isActive,
    rank: rank || 1,
    previousRank: prevRank || rank || 1,
    status,
    joinedAt: data.createdAt ?? new Date().toISOString(),
    createdAt: data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

export const participantService = {
  /**
   * Subscribes to the live leaderboard in real-time.
   * Updates automatically when participant scores, PRs, or statuses change in Firestore.
   */
  subscribeToLeaderboard(
    onUpdate: (participants: Participant[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured()) {
      listeners.add(onUpdate);
      const sorted = sortParticipants(inMemoryParticipants).map((p, index) => ({
        ...p,
        rank: index + 1,
        previousRank: rankHistory.get(p.id) ?? index + 1,
      }));
      onUpdate(sorted);
      return () => {
        listeners.delete(onUpdate);
      };
    }

    try {
      const colRef = collection(db, COLLECTION_NAME);
      return onSnapshot(
        colRef,
        (snapshot) => {
          if (snapshot.empty) {
            onUpdate([]);
            return;
          }

          // Map all documents
          const rawParticipants: Participant[] = snapshot.docs.map((docSnap) => {
            const data = { id: docSnap.id, ...docSnap.data() } as FirestoreParticipant;
            return mapFirestoreToParticipant(data);
          });

          // Sort deterministically
          const sorted = sortParticipants(rawParticipants);

          // Assign ranks and calculate rank deltas
          const ranked: Participant[] = sorted.map((p, index) => {
            const currentRank = index + 1;
            const previousRank = rankHistory.get(p.id) ?? currentRank;
            return {
              ...p,
              rank: currentRank,
              previousRank,
            };
          });

          // Update rank history for subsequent transitions
          ranked.forEach((p) => {
            rankHistory.set(p.id, p.rank);
          });

          onUpdate(ranked);
        },
        (error) => {
          console.error('[ParticipantService] Firestore subscription error:', error);
          if (onError) onError(error);
          else {
            const fallback = sortParticipants(inMemoryParticipants).map((p, i) => ({
              ...p,
              rank: i + 1,
            }));
            onUpdate(fallback);
          }
        }
      );
    } catch (err) {
      console.warn('[ParticipantService] Failed to establish real-time listener:', err);
      const fallback = sortParticipants(inMemoryParticipants).map((p, i) => ({
        ...p,
        rank: i + 1,
      }));
      onUpdate(fallback);
      return () => {};
    }
  },

  /**
   * Fetch all participants once from Firestore.
   */
  async getParticipants(): Promise<Participant[]> {
    if (!isFirebaseConfigured()) {
      return sortParticipants(inMemoryParticipants).map((p, i) => ({
        ...p,
        rank: i + 1,
      }));
    }

    try {
      const colRef = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(colRef);
      const raw = snapshot.docs.map((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() } as FirestoreParticipant;
        return mapFirestoreToParticipant(data);
      });

      return sortParticipants(raw).map((p, index) => ({
        ...p,
        rank: index + 1,
      }));
    } catch (error) {
      console.error('[ParticipantService] Error fetching participants:', error);
      return sortParticipants(inMemoryParticipants).map((p, i) => ({
        ...p,
        rank: i + 1,
      }));
    }
  },

  /**
   * Fetch a single participant by ID.
   */
  async getParticipantById(id: string): Promise<Participant | null> {
    if (!isFirebaseConfigured()) {
      const found = inMemoryParticipants.find((p) => p.id === id);
      return found ?? null;
    }

    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return mapFirestoreToParticipant({ id: snap.id, ...snap.data() } as FirestoreParticipant);
    } catch (error) {
      console.error('[ParticipantService] Error fetching participant:', error);
      return null;
    }
  },

  /**
   * Fetches the score event history for a given participant.
   */
  async getParticipantScoreHistory(participantId: string): Promise<ScoreEvent[]> {
    if (!isFirebaseConfigured()) {
      return mockScoreEvents.filter((ev) => ev.participantId === participantId);
    }

    try {
      const colRef = collection(db, 'scoreEvents');
      const q = query(colRef, where('participantId', '==', participantId));
      const snapshot = await getDocs(q);

      const events: ScoreEvent[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          participantId: data.participantId ?? participantId,
          participantName: data.participantName ?? '',
          githubUsername: data.githubUsername ?? '',
          event: data.reason ?? data.type ?? 'Score update',
          type: data.type,
          points: data.points ?? 0,
          prId: data.prId,
          prNumber: data.prNumber,
          issueId: data.issueId,
          issueNumber: data.issueNumber,
          timestamp: data.timestamp ?? new Date().toISOString(),
        };
      });

      // Sort newest first
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return events;
    } catch (error) {
      console.error('[ParticipantService] Error fetching score history:', error);
      return [];
    }
  },

  /**
   * Adds or registers a new participant in Firestore.
   */
  async saveParticipant(
    participant: Partial<FirestoreParticipant> & { name: string; githubUsername: string }
  ): Promise<string> {
    const id = participant.id || `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const docData: FirestoreParticipant = {
      id,
      name: participant.name.trim(),
      githubUsername: participant.githubUsername.trim().replace(/^@/, ''),
      totalScore: participant.totalScore ?? 0,
      prCount: participant.prCount ?? 0,
      mergedPrCount: participant.mergedPrCount ?? 0,
      escapedCells: participant.escapedCells ?? 0,
      firstSuccessfulPr: participant.firstSuccessfulPr ?? null,
      active: participant.active ?? true,
      createdAt: participant.createdAt ?? now,
      updatedAt: now,
    };

    if (isFirebaseConfigured()) {
      const docRef = doc(db, COLLECTION_NAME, id);
      await setDoc(docRef, docData, { merge: true });
    } else {
      const mapped = mapFirestoreToParticipant(docData);
      inMemoryParticipants = [mapped, ...inMemoryParticipants];
      notifyListeners();
    }

    return id;
  },

  /**
   * Toggles active status of a participant (Activate / Deactivate).
   */
  async toggleParticipantStatus(id: string, active: boolean): Promise<void> {
    const now = new Date().toISOString();

    if (isFirebaseConfigured()) {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        active,
        updatedAt: now,
      });
    } else {
      inMemoryParticipants = inMemoryParticipants.map((p) =>
        p.id === id
          ? {
              ...p,
              active,
              status: active ? (p.escapedCells > 0 ? 'escaped' : 'active') : 'inactive',
              updatedAt: now,
            }
          : p
      );
      notifyListeners();
    }
  },

  /**
   * Admin-only development function:
   * Modifies a participant's score in real time to verify that the public leaderboard
   * updates immediately across all screens without page refresh.
   */
  async adjustParticipantScore(
    participantId: string,
    deltaPoints: number,
    reason: string = 'Admin manual adjustment'
  ): Promise<number> {
    const now = new Date().toISOString();

    if (isFirebaseConfigured()) {
      const docRef = doc(db, COLLECTION_NAME, participantId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        throw new Error('Participant not found');
      }

      const currentData = snap.data() as FirestoreParticipant;
      const currentScore = currentData.totalScore ?? 0;
      const newScore = Math.max(0, currentScore + deltaPoints);

      // Check if this marks their first successful PR
      const updates: Partial<FirestoreParticipant> = {
        totalScore: newScore,
        updatedAt: now,
      };

      if (deltaPoints > 0 && !currentData.firstSuccessfulPr) {
        updates.firstSuccessfulPr = now;
      }

      await updateDoc(docRef, updates);

      // Log score event
      await scoreEventService.logScoreEvent({
        participantId,
        points: deltaPoints,
        type: deltaPoints >= 0 ? 'ADMIN_AWARD' : 'ADMIN_PENALTY',
        reason,
        timestamp: now,
      });

      return newScore;
    } else {
      let updatedScore = 0;
      inMemoryParticipants = inMemoryParticipants.map((p) => {
        if (p.id === participantId) {
          const current = p.totalScore ?? p.xp ?? 0;
          const next = Math.max(0, current + deltaPoints);
          updatedScore = next;
          return {
            ...p,
            totalScore: next,
            xp: next,
            firstSuccessfulPr: deltaPoints > 0 && !p.firstSuccessfulPr ? now : p.firstSuccessfulPr,
            updatedAt: now,
          };
        }
        return p;
      });

      // Log in memory event
      mockScoreEvents.unshift({
        id: `ev_dev_${Date.now()}`,
        participantId,
        participantName: inMemoryParticipants.find((p) => p.id === participantId)?.name ?? 'Prisoner',
        githubUsername: inMemoryParticipants.find((p) => p.id === participantId)?.githubUsername ?? '',
        event: reason,
        type: deltaPoints >= 0 ? 'ADMIN_AWARD' : 'ADMIN_PENALTY',
        points: deltaPoints,
        timestamp: now,
      });

      notifyListeners();
      return updatedScore;
    }
  },

  /**
   * Updates participant fields in Firestore.
   */
  async updateParticipant(id: string, fields: Partial<FirestoreParticipant>): Promise<void> {
    const now = new Date().toISOString();

    if (isFirebaseConfigured()) {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...fields,
        updatedAt: now,
      });
    } else {
      inMemoryParticipants = inMemoryParticipants.map((p) =>
        p.id === id
          ? {
              ...p,
              ...fields,
              xp: fields.totalScore ?? p.xp,
              updatedAt: now,
            }
          : p
      );
      notifyListeners();
    }
  },

  /**
   * Deletes a participant document from Firestore.
   */
  async deleteParticipant(id: string): Promise<void> {
    if (isFirebaseConfigured()) {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } else {
      inMemoryParticipants = inMemoryParticipants.filter((p) => p.id !== id);
      notifyListeners();
    }
  },

  /**
   * Seed helper: Populates mock participants into Firestore for initial setup.
   */
  async seedInitialParticipants(): Promise<void> {
    if (!isFirebaseConfigured()) return;

    for (const p of mockParticipants) {
      const firestoreData: FirestoreParticipant = {
        id: p.id,
        name: p.name,
        githubUsername: p.githubUsername,
        totalScore: p.xp,
        prCount: p.prs,
        mergedPrCount: p.mergedPRs,
        escapedCells: p.escapedCells,
        firstSuccessfulPr: p.joinedAt ?? null,
        active: p.status !== 'inactive',
        createdAt: p.joinedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, COLLECTION_NAME, p.id), firestoreData);
    }
  },
};
