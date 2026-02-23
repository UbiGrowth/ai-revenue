/**
 * Builds a credentialed GitHub HTTPS URL for authentication.
 * 
 * @param url - The repository URL (e.g., https://github.com/UbiGrowth/VIBE or https://github.com/UbiGrowth/VIBE.git)
 * @returns Credentialed URL with token if GITHUB_TOKEN is set, otherwise null if url is null
 * 
 * @example
 * // With GITHUB_TOKEN set
 * buildCredentialedUrl('https://github.com/UbiGrowth/VIBE')
 * // Returns: 'https://x-access-token:TOKEN@github.com/UbiGrowth/VIBE.git'
 * 
 * // Without GITHUB_TOKEN
 * buildCredentialedUrl('https://github.com/UbiGrowth/VIBE')
 * // Returns: 'https://github.com/UbiGrowth/VIBE.git'
 */
export function buildCredentialedUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const token = process.env.GITHUB_TOKEN;
  
  // If no token, return original URL with .git suffix
  if (!token) {
    return url.endsWith('.git') ? url : `${url}.git`;
  }
  
  // Only modify GitHub HTTPS URLs
  const githubHttpsPattern = /^https:\/\/github\.com\//;
  if (!githubHttpsPattern.test(url)) {
    return url.endsWith('.git') ? url : `${url}.git`;
  }
  
  // Remove .git suffix if present for processing
  const baseUrl = url.replace(/\.git$/, '');
  
  // Extract the path after github.com/
  const repoPath = baseUrl.replace('https://github.com/', '');
  
  // Build credentialed URL with token and .git suffix
  return `https://x-access-token:${token}@github.com/${repoPath}.git`;
}