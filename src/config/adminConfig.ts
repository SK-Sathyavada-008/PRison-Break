// ─────────────────────────────────────────────
// Admin Authorization Configuration
// Explicit allowlist of authorized admin accounts
// ─────────────────────────────────────────────

export const ADMIN_CONFIG = {
  // Configured default admin credentials requested by organizer
  defaultAdmin: {
    username: 'unknown',
    email: 'unknown@prisonbreak.dev',
    password: '12345678',
  },

  // Explicit allowlist of emails authorized to access the admin dashboard
  allowlistEmails: [
    'unknown@prisonbreak.dev',
    'unknown@prisonbreak.com',
    'unknown@admin.com',
    'warden@prisonbreak.dev',
    'admin@prisonbreak.com',
  ],

  // Explicit allowlist of usernames (case-insensitive)
  allowlistUsernames: [
    'unknown',
    'warden',
    'admin',
  ],

  // Explicit allowlist of Firebase UIDs
  allowlistUids: [
    'warden-demo-01',
  ],

  /**
   * Verifies if a user identifier (email, username, or UID) is on the admin authorization allowlist.
   */
  isAuthorized(identifier: string | null | undefined, uid?: string | null): boolean {
    if (!identifier && !uid) return false;

    if (uid && ADMIN_CONFIG.allowlistUids.includes(uid)) {
      return true;
    }

    if (!identifier) return false;

    const clean = identifier.trim().toLowerCase();

    // Check exact email match
    if (ADMIN_CONFIG.allowlistEmails.some((e) => e.toLowerCase() === clean)) {
      return true;
    }

    // Check username portion (e.g. unknown from unknown@prisonbreak.dev)
    const username = clean.includes('@') ? clean.split('@')[0] : clean;
    if (ADMIN_CONFIG.allowlistUsernames.some((u) => u.toLowerCase() === username)) {
      return true;
    }

    return false;
  },
};
