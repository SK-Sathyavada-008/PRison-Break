// ─────────────────────────────────────────────
// Webhook Event Service — Firestore Subscriptions & Queries
// ─────────────────────────────────────────────

import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { WebhookEvent } from '../types';

const COLLECTION_NAME = 'webhookEvents';

// In-memory events cache for offline/demo mode
let inMemoryEvents: WebhookEvent[] = [];
const listeners = new Set<(events: WebhookEvent[]) => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn([...inMemoryEvents]));
}

export const webhookEventService = {
  /**
   * Subscribes to real-time webhook event records in Firestore.
   * Sorted newest first (receivedAt descending).
   */
  subscribeToWebhookEvents(
    onUpdate: (events: WebhookEvent[]) => void,
    onErrorOrLimit?: ((error: Error) => void) | number,
    optionalOnError?: (error: Error) => void
  ): Unsubscribe {
    const maxLimit = typeof onErrorOrLimit === 'number' ? onErrorOrLimit : 100;
    const onError = typeof onErrorOrLimit === 'function' ? onErrorOrLimit : optionalOnError;

    if (!isFirebaseConfigured()) {
      listeners.add(onUpdate);
      onUpdate([...inMemoryEvents]);
      return () => {
        listeners.delete(onUpdate);
      };
    }

    try {
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(colRef, orderBy('receivedAt', 'desc'), limit(maxLimit));

      return onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            onUpdate([]);
            return;
          }

          const events: WebhookEvent[] = snapshot.docs.map((docSnap) => {
            return {
              deliveryId: docSnap.id,
              ...docSnap.data(),
            } as WebhookEvent;
          });

          onUpdate(events);
        },
        (error) => {
          console.error('[WebhookEventService] Firestore subscription error:', error);
          if (onError) onError(error);
          else onUpdate([...inMemoryEvents]);
        }
      );
    } catch (err) {
      console.warn('[WebhookEventService] Failed to establish real-time listener:', err);
      onUpdate([...inMemoryEvents]);
      return () => {};
    }
  },

  /**
   * Fetch all recent webhook events once.
   */
  async getWebhookEvents(maxLimit: number = 100): Promise<WebhookEvent[]> {
    if (!isFirebaseConfigured()) {
      return [...inMemoryEvents];
    }

    try {
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(colRef, orderBy('receivedAt', 'desc'), limit(maxLimit));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap) => ({
        deliveryId: docSnap.id,
        ...docSnap.data(),
      })) as WebhookEvent[];
    } catch (error) {
      console.error('[WebhookEventService] Error fetching webhook events:', error);
      return [...inMemoryEvents];
    }
  },

  /**
   * Fetch a single webhook event by deliveryId.
   */
  async getWebhookEventById(deliveryId: string): Promise<WebhookEvent | null> {
    if (!isFirebaseConfigured()) {
      return inMemoryEvents.find((e) => e.deliveryId === deliveryId) || null;
    }

    try {
      const docRef = doc(db, COLLECTION_NAME, deliveryId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { deliveryId: snap.id, ...snap.data() } as WebhookEvent;
    } catch (error) {
      console.error('[WebhookEventService] Error fetching event by ID:', error);
      return null;
    }
  },

  /**
   * Helper for in-memory / test simulation
   */
  simulateIncomingEvent(event: WebhookEvent) {
    inMemoryEvents = [event, ...inMemoryEvents];
    notifyListeners();
  },
};
