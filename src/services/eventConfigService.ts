// ─────────────────────────────────────────────
// Event Config Service — Firestore Operations
// ─────────────────────────────────────────────

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { FirestoreEventConfig } from '../types';

const COLLECTION_NAME = 'eventConfig';
const DOC_ID = 'main';

const DEFAULT_CONFIG: FirestoreEventConfig = {
  eventName: 'PRison Break',
  tagline: 'Escape the Code. Earn the Merge.',
  status: 'ongoing',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const eventConfigService = {
  /**
   * Subscribes to the event configuration document in real-time.
   */
  subscribeToEventConfig(
    onUpdate: (config: FirestoreEventConfig) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured()) {
      onUpdate(DEFAULT_CONFIG);
      return () => {};
    }

    try {
      const docRef = doc(db, COLLECTION_NAME, DOC_ID);
      return onSnapshot(
        docRef,
        (snap) => {
          if (!snap.exists()) {
            onUpdate(DEFAULT_CONFIG);
            return;
          }
          onUpdate(snap.data() as FirestoreEventConfig);
        },
        (error) => {
          console.error('[EventConfigService] Firestore error:', error);
          if (onError) onError(error);
          else onUpdate(DEFAULT_CONFIG);
        }
      );
    } catch (err) {
      console.warn('[EventConfigService] Listener failed:', err);
      onUpdate(DEFAULT_CONFIG);
      return () => {};
    }
  },

  /**
   * Fetches event config once.
   */
  async getEventConfig(): Promise<FirestoreEventConfig> {
    if (!isFirebaseConfigured()) return DEFAULT_CONFIG;

    try {
      const docRef = doc(db, COLLECTION_NAME, DOC_ID);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return DEFAULT_CONFIG;
      return snap.data() as FirestoreEventConfig;
    } catch (error) {
      console.error('[EventConfigService] Fetch failed:', error);
      return DEFAULT_CONFIG;
    }
  },

  /**
   * Updates event configuration in Firestore.
   */
  async updateEventConfig(data: Partial<FirestoreEventConfig>): Promise<void> {
    if (!isFirebaseConfigured()) return;

    const docRef = doc(db, COLLECTION_NAME, DOC_ID);
    await setDoc(
      docRef,
      {
        ...data,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  },
};
