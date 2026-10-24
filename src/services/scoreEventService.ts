// ─────────────────────────────────────────────
// Score Event Service — Firestore Operations
// ─────────────────────────────────────────────

import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { ScoreEvent, FirestoreScoreEvent } from '../types';
import { mockScoreEvents } from '../data/mockData';

const COLLECTION_NAME = 'scoreEvents';

export function mapFirestoreToScoreEvent(data: FirestoreScoreEvent): ScoreEvent {
  const cleanUsername = data.githubUsername || data.participantId.replace(/^p_/, '');
  return {
    id: data.id,
    participantId: data.participantId,
    participantName: data.participantName || `@${cleanUsername}`,
    githubUsername: cleanUsername,
    event: data.reason ?? data.type ?? 'Score update',
    type: data.type,
    points: data.points,
    prId: data.prId,
    prNumber: data.prNumber,
    issueId: data.issueId,
    issueNumber: data.issueNumber,
    repository: data.repositoryFullName || data.repositoryId || data.teamName || undefined,
    timestamp: data.timestamp,
  };
}

export const scoreEventService = {
  /**
   * Subscribes to recent score events in real time.
   */
  subscribeToScoreEvents(
    onUpdate: (events: ScoreEvent[]) => void,
    maxLimit: number = 50,
    onError?: (error: Error) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured()) {
      onUpdate(mockScoreEvents);
      return () => {};
    }

    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('timestamp', 'desc'),
        limit(maxLimit)
      );

      return onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            onUpdate([]);
            return;
          }

          const events: ScoreEvent[] = snapshot.docs.map((docSnap) => {
            const data = { id: docSnap.id, ...docSnap.data() } as FirestoreScoreEvent;
            return mapFirestoreToScoreEvent(data);
          });
          onUpdate(events);
        },
        (error) => {
          console.error('[ScoreEventService] Firestore subscription error:', error);
          if (onError) onError(error);
          else onUpdate(mockScoreEvents);
        }
      );
    } catch (err) {
      console.warn('[ScoreEventService] Failed to establish real-time listener:', err);
      onUpdate(mockScoreEvents);
      return () => {};
    }
  },

  /**
   * Fetch all score events once.
   */
  async getScoreEvents(): Promise<ScoreEvent[]> {
    if (!isFirebaseConfigured()) return mockScoreEvents;

    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() } as FirestoreScoreEvent;
        return mapFirestoreToScoreEvent(data);
      });
    } catch (error) {
      console.error('[ScoreEventService] Error fetching events:', error);
      return mockScoreEvents;
    }
  },

  /**
   * Records a new score event in Firestore.
   */
  async logScoreEvent(event: Partial<FirestoreScoreEvent> & { id?: string }): Promise<string> {
    const id = event.id || `se_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const data: FirestoreScoreEvent = {
      id,
      participantId: event.participantId ?? 'unknown',
      type: event.type ?? 'MERGE_PR',
      points: event.points ?? 0,
      prId: event.prId,
      issueId: event.issueId,
      reason: event.reason ?? 'PR Merged',
      timestamp: event.timestamp ?? now,
    };

    if (isFirebaseConfigured()) {
      const docRef = doc(db, COLLECTION_NAME, id);
      await setDoc(docRef, data);
    }

    return id;
  },

  /**
   * Seed helper: populates mock score events into Firestore.
   */
  async seedInitialScoreEvents(): Promise<void> {
    if (!isFirebaseConfigured()) return;

    for (const ev of mockScoreEvents) {
      const firestoreData: FirestoreScoreEvent = {
        id: ev.id,
        participantId: ev.participantId,
        type: 'MERGE_PR',
        points: ev.points,
        prId: ev.prNumber ? `pr-${ev.prNumber}` : undefined,
        issueId: ev.issueNumber ? `issue-${ev.issueNumber}` : undefined,
        reason: ev.event,
        timestamp: ev.timestamp,
      };
      await setDoc(doc(db, COLLECTION_NAME, ev.id), firestoreData);
    }
  },
};
