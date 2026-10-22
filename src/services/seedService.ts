// ─────────────────────────────────────────────
// Seed Service — Populates Firestore with Mock Data
// ─────────────────────────────────────────────

import { participantService } from './participantService';
import { repositoryService } from './repositoryService';
import { pullRequestService } from './pullRequestService';
import { scoreEventService } from './scoreEventService';
import { eventConfigService } from './eventConfigService';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';

import { teamService } from './teamService';
import { issueService } from './issueService';

export const seedService = {
  /**
   * Seeds all initial mock data into Firestore if Firebase is connected.
   */
  async seedAll(): Promise<{ success: boolean; message: string }> {
    if (!isFirebaseConfigured()) {
      return {
        success: false,
        message: 'Firebase is not yet configured. Please add your credentials to the .env file.',
      };
    }

    try {
      await Promise.all([
        teamService.seedInitialTeams(),
        issueService.seedIssues(),
        participantService.seedInitialParticipants(),
        repositoryService.seedInitialRepositories(),
        pullRequestService.seedInitialPullRequests(),
        scoreEventService.seedInitialScoreEvents(),
        eventConfigService.updateEventConfig({
          eventName: 'PRison Break',
          tagline: 'Escape the Code. Earn the Merge.',
          status: 'ongoing',
        }),
      ]);

      return {
        success: true,
        message: 'Successfully populated Firestore with sample participants, repositories, PRs, and events!',
      };
    } catch (error: any) {
      console.error('[SeedService] Seeding failed:', error);
      return {
        success: false,
        message: error?.message ?? 'Seeding failed. Check Firestore security rules or internet connection.',
      };
    }
  },

  /**
   * Completely purges all data from participants, repositories, pullRequests, and scoreEvents collections.
   */
  async clearAll(): Promise<{ success: boolean; message: string }> {
    if (!isFirebaseConfigured()) {
      return {
        success: false,
        message: 'Firebase is not configured.',
      };
    }

    try {
      const collectionsToPurge = ['teams', 'issues', 'auditLogs', 'participants', 'repositories', 'pullRequests', 'scoreEvents'];
      for (const colName of collectionsToPurge) {
        const snap = await getDocs(collection(db, colName));
        const deletions = snap.docs.map((d) => deleteDoc(d.ref));
        await Promise.all(deletions);
      }

      return {
        success: true,
        message: 'Successfully purged all dummy data from Firestore.',
      };
    } catch (error: any) {
      console.error('[SeedService] Purge failed:', error);
      return {
        success: false,
        message: error?.message ?? 'Purge failed.',
      };
    }
  },
};
