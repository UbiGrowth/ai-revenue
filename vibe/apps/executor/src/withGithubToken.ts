/**
 * Sanitizes a GitHub repository URL for safe logging (removes tokens and credentials).
 * 
 * @param repoUrl - GitHub repository URL in various formats
 * @returns Sanitized URL in format: github.com/OWNER/REPO.git
 */
export function sanitizeRepoUrl(repoUrl: string): string {
  // Remove any credentials from HTTPS URLs (e.g., https://token@github.com/...)
  const httpsWithCredsMatch = repoUrl.match(/^https:\/\/(?:[^@]+@)?github\.com\/([^\/]+)\/([^\/]+?)(\.git)?$/);
  if (httpsWithCredsMatch) {
    const owner = httpsWithCredsMatch[1];
    let repo = httpsWithCredsMatch[2].replace(/\.git$/, '');
    return `github.com/${owner}/${repo}.git`;
  }

  // Handle SSH format: git@github.com:OWNER/REPO.git
  const sshMatch = repoUrl.match(/^git@github\.com:([^\/]+)\/([^\/]+?)(\.git)?$/);
  if (sshMatch) {
    const owner = sshMatch[1];
    let repo = sshMatch[2].replace(/\.git$/, '');
    return `github.com/${owner}/${repo}.git`;
  }

  // If already in simple format or unrecognized, return as-is (but try to normalize)
  const simpleMatch = repoUrl.match(/(?:github\.com\/)?([^\/]+)\/([^\/]+?)(?:\.git)?$/);
  if (simpleMatch) {
    const owner = simpleMatch[1];
    let repo = simpleMatch[2].replace(/\.git$/, '');
    return `github.com/${owner}/${repo}.git`;
  }

  // Fallback: return original URL (shouldn't happen for GitHub URLs)
  return repoUrl;
}

/**
 * Injects a GitHub token into a repository URL using x-access-token format.
 * 
 * @param repoUrl - GitHub repository URL in various formats
 * @param token - Optional GitHub access token
 * @returns Normalized HTTPS URL with token, or original URL if token is missing
 */
export function withGithubToken(repoUrl: string, token?: string): string {
  // If token is missing or empty, return unchanged
  if (!token || token.trim() === '') {
    return repoUrl;
  }

  // Parse the repository URL to extract owner and repo
  let owner: string;
  let repo: string;

  // Handle HTTPS format: https://github.com/OWNER/REPO or https://github.com/OWNER/REPO.git
  const httpsMatch = repoUrl.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(\.git)?$/);
  if (httpsMatch) {
    owner = httpsMatch[1];
    repo = httpsMatch[2];
  } else {
    // Handle SSH format: git@github.com:OWNER/REPO.git
    const sshMatch = repoUrl.match(/^git@github\.com:([^\/]+)\/([^\/]+?)(\.git)?$/);
    if (sshMatch) {
      owner = sshMatch[1];
      repo = sshMatch[2];
    } else {
      // If format is unrecognized, return unchanged
      return repoUrl;
    }
  }

  // Remove .git suffix if present in repo name
  repo = repo.replace(/\.git$/, '');

  // Validate that owner and repo are non-empty after processing
  if (!owner || !repo) {
    return repoUrl;
  }

  // Return HTTPS URL with x-access-token format
  return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
}
