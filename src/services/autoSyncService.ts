// ─────────────────────────────────────────────
// Real-Time Background Auto-Sync Service
// Automatically synchronizes PRs from GitHub in the background
// Runs AI Code Judge & Auto-Merges on every cycle
// Drives instantaneous, live Firestore Leaderboard updates
// ─────────────────────────────────────────────

import { githubSyncService } from './githubSyncService';

export interface AutoSyncState {
  isRunning: boolean;
  isSyncing: boolean;
  intervalSeconds: number;
  lastSyncTime: string | null;
  totalSyncedCount: number;
  lastError: string | null;
}

type AutoSyncListener = (state: AutoSyncState) => void;

class AutoSyncService {
  private timer: any = null;
  private intervalSeconds: number = 10; // 10 seconds default
  private isRunning: boolean = false;
  private isSyncing: boolean = false;
  private lastSyncTime: string | null = null;
  private totalSyncedCount: number = 0;
  private lastError: string | null = null;
  private listeners: Set<AutoSyncListener> = new Set();

  constructor() {
    // Read optional interval from localStorage if stored
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('PRISON_AUTOSYNC_INTERVAL');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 5 && parsed <= 300) {
          this.intervalSeconds = parsed;
        }
      }
    }
  }

  public getState(): AutoSyncState {
    return {
      isRunning: this.isRunning,
      isSyncing: this.isSyncing,
      intervalSeconds: this.intervalSeconds,
      lastSyncTime: this.lastSyncTime,
      totalSyncedCount: this.totalSyncedCount,
      lastError: this.lastError,
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.warn('[AutoSyncService] Listener error:', err);
      }
    });
  }

  public subscribe(listener: AutoSyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Starts periodic background synchronization.
   */
  public start(intervalSeconds?: number) {
    if (intervalSeconds && intervalSeconds >= 5) {
      this.intervalSeconds = intervalSeconds;
    }

    if (this.isRunning && this.timer) {
      return;
    }

    this.isRunning = true;
    this.lastError = null;
    this.notify();

    console.log(`[AutoSyncService] Starting live auto-sync engine (every ${this.intervalSeconds}s)...`);

    // Run first sync immediately
    this.runSyncCycle();

    // Schedule periodic loop
    this.timer = setInterval(() => {
      this.runSyncCycle();
    }, this.intervalSeconds * 1000);
  }

  /**
   * Stops periodic background synchronization.
   */
  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.notify();
    console.log('[AutoSyncService] Live auto-sync engine stopped.');
  }

  /**
   * Changes the sync interval dynamically.
   */
  public setInterval(seconds: number) {
    if (seconds < 5) seconds = 5;
    this.intervalSeconds = seconds;
    if (typeof window !== 'undefined') {
      localStorage.setItem('PRISON_AUTOSYNC_INTERVAL', String(seconds));
    }

    if (this.isRunning) {
      this.stop();
      this.start(seconds);
    } else {
      this.notify();
    }
  }

  /**
   * Runs an immediate synchronization cycle on demand.
   */
  public async triggerImmediateSync(): Promise<void> {
    await this.runSyncCycle();
  }

  /**
   * Internal execution of one sync cycle.
   * Prevents overlapping cycles.
   */
  private async runSyncCycle(): Promise<void> {
    if (this.isSyncing) {
      return; // Previous cycle still in flight, skip tick
    }

    try {
      this.isSyncing = true;
      this.notify();

      const result = await githubSyncService.syncAllRegisteredRepositories();

      this.lastSyncTime = new Date().toISOString();
      this.totalSyncedCount = result.totalSyncedPRs;
      this.lastError = null;
    } catch (err: any) {
      console.warn('[AutoSyncService] Background sync cycle failed:', err);
      this.lastError = err?.message || 'Sync cycle error';
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }
}

export const autoSyncService = new AutoSyncService();
