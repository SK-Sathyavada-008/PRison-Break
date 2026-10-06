// ─────────────────────────────────────────────
// GitHub URL Validator & Normalizer
// ─────────────────────────────────────────────

export interface ParsedGithubRepo {
  owner: string;
  name: string;
  fullName: string;
  githubUrl: string;
}

export type ParseResult =
  | { success: true; data: ParsedGithubRepo }
  | { success: false; error: string };

/**
 * Validates, parses, and normalizes a GitHub repository URL.
 *
 * Rules:
 * - Must be hosted on github.com (or www.github.com)
 * - Must contain exactly owner and repository name
 * - Handles trailing slashes ('/') and '.git' suffixes
 * - Normalizes to canonical 'https://github.com/{owner}/{name}'
 * - Rejects non-GitHub URLs, empty strings, and subpaths (e.g. /issues, /pulls, /tree)
 */
export function parseAndNormalizeGithubUrl(rawUrl: string): ParseResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { success: false, error: 'Repository URL cannot be empty.' };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { success: false, error: 'Repository URL cannot be empty.' };
  }

  // Prepend protocol if user pasted e.g. "github.com/owner/repo"
  let urlToParse = trimmed;
  if (!/^https?:\/\//i.test(urlToParse)) {
    urlToParse = `https://${urlToParse}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(urlToParse);
  } catch {
    return { success: false, error: 'Invalid URL format. Please provide a valid URL.' };
  }

  // Verify hostname is github.com
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'github.com' && hostname !== 'www.github.com') {
    return {
      success: false,
      error: 'Only GitHub repository URLs are accepted (must be hosted on github.com).',
    };
  }

  // Split and filter path segments
  // Example pathname: "/PRisonBreak/java-cell-01.git/"
  const segments = parsed.pathname
    .split('/')
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return { success: false, error: 'Missing owner and repository name in URL.' };
  }

  if (segments.length === 1) {
    return {
      success: false,
      error: `Missing repository name. "${segments[0]}" appears to be a user or organization account, not a repository.`,
    };
  }

  if (segments.length > 2) {
    return {
      success: false,
      error: 'Invalid repository path. URL must point directly to the repository root (not a branch, file, or issue subpath).',
    };
  }

  const owner = segments[0];
  let name = segments[1];

  // Strip trailing '.git'
  if (name.endsWith('.git')) {
    name = name.slice(0, -4);
  }

  if (!name) {
    return { success: false, error: 'Repository name cannot be empty.' };
  }

  // GitHub naming conventions: alphanumeric, dashes, dots, underscores
  const validGithubIdent = /^[a-zA-Z0-9_.-]+$/;
  if (!validGithubIdent.test(owner) || !validGithubIdent.test(name)) {
    return {
      success: false,
      error: 'Repository URL contains invalid characters in the owner or repository name.',
    };
  }

  const fullName = `${owner}/${name}`;
  const normalizedUrl = `https://github.com/${owner}/${name}`;

  return {
    success: true,
    data: {
      owner,
      name,
      fullName,
      githubUrl: normalizedUrl,
    },
  };
}
