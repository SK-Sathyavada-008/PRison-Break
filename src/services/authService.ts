// ─────────────────────────────────────────────
// Auth Service — Firestore & Firebase Authentication
// ─────────────────────────────────────────────

import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as onFirebaseAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../config/firebase';
import { ADMIN_CONFIG } from '../config/adminConfig';

export interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAuthorized: boolean;
  isDemo?: boolean;
}

const SESSION_KEY = 'prison_admin_session';

export const authService = {
  /**
   * Listen to auth state changes, checking Firestore session and Firebase Auth.
   */
  onAuthStateChanged(callback: (user: AdminUser | null) => void): Unsubscribe {
    // 1. Check for active session in storage
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        callback(parsed);
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
        callback(null);
      }
      return () => {};
    }

    if (!isFirebaseConfigured() || !auth) {
      callback(null);
      return () => {};
    }

    // 2. Listen to Firebase Auth state
    return onFirebaseAuthStateChanged(auth, (firebaseUser: User | null) => {
      // Re-check sessionStorage in case user logged in via Firestore credentials
      const activeSession = sessionStorage.getItem(SESSION_KEY);
      if (activeSession) {
        try {
          callback(JSON.parse(activeSession));
          return;
        } catch {
          // continue
        }
      }

      if (firebaseUser) {
        const isAuth = ADMIN_CONFIG.isAuthorized(firebaseUser.email, firebaseUser.uid);
        if (!isAuth) {
          firebaseSignOut(auth).catch(() => {});
          callback(null);
          return;
        }

        const adminUser: AdminUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Admin Officer',
          isAuthorized: true,
        };
        callback(adminUser);
      } else {
        callback(null);
      }
    });
  },

  /**
   * Normalize input to a valid email format.
   * If user enters username 'unknown', convert to 'unknown@prisonbreak.dev'.
   */
  normalizeEmail(identifier: string): string {
    const trimmed = identifier.trim();
    if (!trimmed.includes('@')) {
      return `${trimmed.toLowerCase()}@prisonbreak.dev`;
    }
    return trimmed.toLowerCase();
  },

  /**
   * Admin sign-in:
   * First checks Firestore collection 'admin' -> document 'credentials'
   * Second falls back to Firebase Auth / local allowlist
   */
  async signIn(identifier: string, pass: string): Promise<AdminUser> {
    const email = this.normalizeEmail(identifier);
    const rawUsername = identifier.trim().toLowerCase();

    // 1. Check Firestore 'admin/credentials' document first
    if (isFirebaseConfigured() && db) {
      try {
        const credRef = doc(db, 'admin', 'credentials');
        const credSnap = await getDoc(credRef);

        if (credSnap.exists()) {
          const credData = credSnap.data();
          const dbUsername = (credData.username || '').toString().trim().toLowerCase();
          const dbPassword = (credData.password || '').toString();

          const isUsernameMatch = rawUsername === dbUsername || email === `${dbUsername}@prisonbreak.dev`;
          const isPasswordMatch = pass === dbPassword;

          if (isUsernameMatch && isPasswordMatch) {
            const adminUser: AdminUser = {
              uid: `admin-${dbUsername}`,
              email: `${dbUsername}@prisonbreak.dev`,
              displayName: dbUsername,
              isAuthorized: true,
            };
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(adminUser));
            return adminUser;
          } else if (isUsernameMatch && !isPasswordMatch) {
            throw new Error('ACCESS DENIED: Invalid security key.');
          }
        }
      } catch (firestoreErr: any) {
        // If it was an explicit password rejection, propagate it
        if (firestoreErr.message?.includes('ACCESS DENIED')) {
          throw firestoreErr;
        }
        console.warn('[AuthService] Firestore credentials check note:', firestoreErr.message);
      }
    }

    // 2. Allowlist authorization check
    const isAllowlisted = ADMIN_CONFIG.isAuthorized(email) || ADMIN_CONFIG.isAuthorized(rawUsername);
    if (!isAllowlisted) {
      throw new Error('ACCESS DENIED: Officer account is not on the authorized Warden allowlist.');
    }

    // 3. Check default credentials
    if (
      (rawUsername === ADMIN_CONFIG.defaultAdmin.username || email === ADMIN_CONFIG.defaultAdmin.email) &&
      pass === ADMIN_CONFIG.defaultAdmin.password
    ) {
      const defaultUser: AdminUser = {
        uid: 'admin-unknown',
        email: ADMIN_CONFIG.defaultAdmin.email,
        displayName: ADMIN_CONFIG.defaultAdmin.username,
        isAuthorized: true,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(defaultUser));
      return defaultUser;
    }

    // 4. Attempt Firebase Authentication if enabled
    if (isFirebaseConfigured() && auth) {
      try {
        const credential = await signInWithEmailAndPassword(auth, email, pass);
        const isAuth = ADMIN_CONFIG.isAuthorized(credential.user.email, credential.user.uid);
        if (!isAuth) {
          await firebaseSignOut(auth);
          throw new Error('ACCESS DENIED: Officer account is not on the authorized Warden allowlist.');
        }

        const adminUser: AdminUser = {
          uid: credential.user.uid,
          email: credential.user.email,
          displayName: credential.user.displayName ?? rawUsername,
          isAuthorized: true,
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(adminUser));
        return adminUser;
      } catch (firebaseErr: any) {
        if (
          firebaseErr.code === 'auth/wrong-password' ||
          firebaseErr.code === 'auth/invalid-credential'
        ) {
          throw new Error('ACCESS DENIED: Invalid officer credentials.');
        }
        throw firebaseErr;
      }
    }

    throw new Error('ACCESS DENIED: Invalid officer credentials.');
  },

  /**
   * Admin sign out.
   */
  async signOut(): Promise<void> {
    sessionStorage.removeItem(SESSION_KEY);
    if (isFirebaseConfigured() && auth) {
      try {
        await firebaseSignOut(auth);
      } catch {
        // ignore
      }
    }
  },

  /**
   * Local demo bypass.
   */
  signInDemo(): AdminUser {
    const demoUser: AdminUser = {
      uid: 'admin-unknown',
      email: 'unknown@prisonbreak.dev',
      displayName: 'unknown',
      isAuthorized: true,
      isDemo: true,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(demoUser));
    return demoUser;
  },
};
