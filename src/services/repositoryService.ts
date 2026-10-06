// ─────────────────────────────────────────────
// Repository Service — Firestore Operations
// ─────────────────────────────────────────────

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { Repository, FirestoreRepository } from '../types';
import { mockRepositories } from '../data/mockData';

const COLLECTION_NAME = 'repositories';

// In-memory cache & listeners for offline / demo mode
let inMemoryRepositories: Repository[] = [...mockRepositories];
const listeners = new Set<(repos: Repository[]) => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn([...inMemoryRepositories]));
}

/**
 * Maps a Firestore repository document into the UI-ready Repository model.
 */
export function mapFirestoreToRepository(data: FirestoreRepository): Repository {
  const isActive = data.active ?? true;
  return {
    id: data.id,
    name: data.name,
    owner: data.owner,
    fullName: data.fullName ?? `${data.owner}/${data.name}`,
    githubUrl: data.githubUrl,
    active: isActive,
    status: (isActive ? 'active' : 'inactive') as Repository['status'],
    issues: 0,
    prs: 0,
    stars: 0,
    language: 'Code',
    addedAt: data.createdAt ?? new Date().toISOString(),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export const repositoryService = {
  /**
   * Subscribes to the repositories collection in real-time.
   */
  subscribeToRepositories(
    onUpdate: (repos: Repository[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured()) {
      listeners.add(onUpdate);
      onUpdate([...inMemoryRepositories]);
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

          const repos: Repository[] = snapshot.docs.map((docSnap) => {
            const data = { id: docSnap.id, ...docSnap.data() } as FirestoreRepository;
            return mapFirestoreToRepository(data);
          });

          // Sort by creation date descending (newest first)
          repos.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });

          onUpdate(repos);
        },
        (error) => {
          console.error('[RepositoryService] Firestore subscription error:', error);
          if (onError) onError(error);
          else onUpdate([...inMemoryRepositories]);
        }
      );
    } catch (err) {
      console.warn('[RepositoryService] Failed to establish real-time listener:', err);
      onUpdate([...inMemoryRepositories]);
      return () => {};
    }
  },

  /**
   * Fetches all repositories once.
   */
  async getRepositories(): Promise<Repository[]> {
    if (!isFirebaseConfigured()) {
      return [...inMemoryRepositories];
    }

    try {
      const colRef = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(colRef);
      const repos = snapshot.docs.map((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() } as FirestoreRepository;
        return mapFirestoreToRepository(data);
      });

      repos.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      return repos;
    } catch (error) {
      console.error('[RepositoryService] Error fetching repositories:', error);
      return [...inMemoryRepositories];
    }
  },

  /**
   * Checks if a repository is already registered in Firestore (case-insensitive).
   */
  async checkRepositoryExists(fullName: string, githubUrl: string): Promise<boolean> {
    const targetFullName = fullName.toLowerCase();
    const targetUrl = githubUrl.toLowerCase().replace(/\/$/, '');

    if (!isFirebaseConfigured()) {
      return inMemoryRepositories.some((r) => {
        const currentFullName = (r.fullName ?? `${r.owner}/${r.name}`).toLowerCase();
        const currentUrl = (r.githubUrl ?? '').toLowerCase().replace(/\/$/, '');
        return currentFullName === targetFullName || currentUrl === targetUrl;
      });
    }

    try {
      const colRef = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(colRef);

      return snapshot.docs.some((docSnap) => {
        const data = docSnap.data() as FirestoreRepository;
        const currentFullName = (data.fullName ?? `${data.owner}/${data.name}`).toLowerCase();
        const currentUrl = (data.githubUrl ?? '').toLowerCase().replace(/\/$/, '');
        return currentFullName === targetFullName || currentUrl === targetUrl;
      });
    } catch (error) {
      console.error('[RepositoryService] Error checking repository existence:', error);
      throw error;
    }
  },

  /**
   * Adds a new repository to Firestore after validating uniqueness.
   *
   * Document fields:
   * - id: string
   * - owner: string
   * - name: string
   * - fullName: string
   * - githubUrl: string
   * - active: boolean (defaults to true)
   * - createdAt: string (ISO)
   * - updatedAt: string (ISO)
   */
  async addRepository(params: {
    owner: string;
    name: string;
    fullName?: string;
    githubUrl: string;
    active?: boolean;
  }): Promise<FirestoreRepository> {
    const fullName = params.fullName ?? `${params.owner}/${params.name}`;
    const githubUrl = params.githubUrl;

    // Check Firestore to ensure repository is not already registered
    const exists = await this.checkRepositoryExists(fullName, githubUrl);
    if (exists) {
      throw new Error(`Repository "${fullName}" is already registered in PRison Control.`);
    }

    const id = `repo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const firestoreData: FirestoreRepository = {
      id,
      owner: params.owner,
      name: params.name,
      fullName,
      githubUrl,
      active: params.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    if (isFirebaseConfigured()) {
      const docRef = doc(db, COLLECTION_NAME, id);
      await setDoc(docRef, firestoreData);
    } else {
      inMemoryRepositories = [mapFirestoreToRepository(firestoreData), ...inMemoryRepositories];
      notifyListeners();
    }

    return firestoreData;
  },

  /**
   * Deletes a repository document from Firestore.
   *
   * IMPORTANT:
   * This ONLY removes the repository record from PRison Control Firestore.
   * It does NOT delete or alter the actual GitHub repository.
   */
  async deleteRepository(id: string): Promise<void> {
    if (isFirebaseConfigured()) {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } else {
      inMemoryRepositories = inMemoryRepositories.filter((r) => r.id !== id);
      notifyListeners();
    }
  },

  /**
   * Toggles the active status of a repository in Firestore.
   * Inactive repositories remain in Firestore but do not participate in event automation.
   */
  async toggleRepositoryStatus(id: string, active: boolean): Promise<void> {
    const now = new Date().toISOString();

    if (isFirebaseConfigured()) {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        active,
        updatedAt: now,
      });
    } else {
      inMemoryRepositories = inMemoryRepositories.map((r) =>
        r.id === id
          ? {
              ...r,
              active,
              status: (active ? 'active' : 'inactive') as Repository['status'],
              updatedAt: now,
            }
          : r
      );
      notifyListeners();
    }
  },

  /**
   * Seed helper: populates initial repositories into Firestore.
   */
  async seedInitialRepositories(): Promise<void> {
    if (!isFirebaseConfigured()) return;

    for (const r of mockRepositories) {
      const firestoreData: FirestoreRepository = {
        id: r.id,
        owner: r.owner,
        name: r.name,
        fullName: r.fullName ?? `${r.owner}/${r.name}`,
        githubUrl: r.githubUrl,
        active: r.active ?? r.status === 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, COLLECTION_NAME, r.id), firestoreData);
    }
  },
};
