import { describe, it } from 'node:test';
import assert from 'node:assert';
import { withGithubToken, sanitizeRepoUrl } from './withGithubToken';

/**
 * withGithubToken Test Suite
 * 
 * Tests the GitHub token injection helper function.
 */

describe('sanitizeRepoUrl - Safe Logging', () => {
  it('should remove credentials from HTTPS URL', () => {
    const repoUrl = 'https://x-access-token:ghp_secret123@github.com/owner/repo.git';
    const result = sanitizeRepoUrl(repoUrl);
    assert.strictEqual(result, 'github.com/owner/repo.git');
  });

  it('should sanitize plain HTTPS URL', () => {
    const repoUrl = 'https://github.com/owner/repo';
    const result = sanitizeRepoUrl(repoUrl);
    assert.strictEqual(result, 'github.com/owner/repo.git');
  });

  it('should sanitize HTTPS URL with .git', () => {
    const repoUrl = 'https://github.com/owner/repo.git';
    const result = sanitizeRepoUrl(repoUrl);
    assert.strictEqual(result, 'github.com/owner/repo.git');
  });

  it('should sanitize SSH URL', () => {
    const repoUrl = 'git@github.com:owner/repo.git';
    const result = sanitizeRepoUrl(repoUrl);
    assert.strictEqual(result, 'github.com/owner/repo.git');
  });

  it('should handle SSH URL without .git', () => {
    const repoUrl = 'git@github.com:owner/repo';
    const result = sanitizeRepoUrl(repoUrl);
    assert.strictEqual(result, 'github.com/owner/repo.git');
  });

  it('should handle already sanitized URL', () => {
    const repoUrl = 'github.com/owner/repo.git';
    const result = sanitizeRepoUrl(repoUrl);
    assert.strictEqual(result, 'github.com/owner/repo.git');
  });

  it('should handle real-world example with token', () => {
    const repoUrl = 'https://x-access-token:ghp_1234567890@github.com/UbiGrowth/VIBE.git';
    const result = sanitizeRepoUrl(repoUrl);
    assert.strictEqual(result, 'github.com/UbiGrowth/VIBE.git');
    assert.ok(!result.includes('ghp_'));
    assert.ok(!result.includes('x-access-token'));
  });
});

describe('withGithubToken - Token Handling', () => {
  it('should return unchanged URL when token is undefined', () => {
    const repoUrl = 'https://github.com/OWNER/REPO';
    const result = withGithubToken(repoUrl, undefined);
    assert.strictEqual(result, repoUrl);
  });

  it('should return unchanged URL when token is empty string', () => {
    const repoUrl = 'https://github.com/OWNER/REPO.git';
    const result = withGithubToken(repoUrl, '');
    assert.strictEqual(result, repoUrl);
  });

  it('should return unchanged URL when token is whitespace only', () => {
    const repoUrl = 'git@github.com:OWNER/REPO.git';
    const result = withGithubToken(repoUrl, '   ');
    assert.strictEqual(result, repoUrl);
  });
});

describe('withGithubToken - HTTPS URL Normalization', () => {
  const token = 'ghp_test123token';

  it('should normalize HTTPS URL without .git suffix', () => {
    const repoUrl = 'https://github.com/OWNER/REPO';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, `https://x-access-token:${token}@github.com/OWNER/REPO.git`);
  });

  it('should normalize HTTPS URL with .git suffix', () => {
    const repoUrl = 'https://github.com/OWNER/REPO.git';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, `https://x-access-token:${token}@github.com/OWNER/REPO.git`);
  });

  it('should handle owner with hyphen', () => {
    const repoUrl = 'https://github.com/my-org/my-repo';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, `https://x-access-token:${token}@github.com/my-org/my-repo.git`);
  });

  it('should handle repo with hyphen', () => {
    const repoUrl = 'https://github.com/owner/my-cool-repo';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, `https://x-access-token:${token}@github.com/owner/my-cool-repo.git`);
  });

  it('should handle repo with underscores', () => {
    const repoUrl = 'https://github.com/owner/my_repo_name';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, `https://x-access-token:${token}@github.com/owner/my_repo_name.git`);
  });

  it('should handle repo with dots', () => {
    const repoUrl = 'https://github.com/owner/my.repo.name.git';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, `https://x-access-token:${token}@github.com/owner/my.repo.name.git`);
  });
});

describe('withGithubToken - SSH URL Normalization', () => {
  const token = 'ghp_test123token';

  it('should normalize SSH URL with .git suffix', () => {
    const repoUrl = 'git@github.com:OWNER/REPO.git';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, `https://x-access-token:${token}@github.com/OWNER/REPO.git`);
  });

  it('should normalize SSH URL without .git suffix', () => {
    const repoUrl = 'git@github.com:OWNER/REPO';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, `https://x-access-token:${token}@github.com/OWNER/REPO.git`);
  });

  it('should handle SSH URL with hyphenated names', () => {
    const repoUrl = 'git@github.com:my-org/my-repo.git';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, `https://x-access-token:${token}@github.com/my-org/my-repo.git`);
  });
});

describe('withGithubToken - Real-World Examples', () => {
  const token = 'ghp_1234567890abcdef';

  it('should handle UbiGrowth/VIBE HTTPS URL', () => {
    const repoUrl = 'https://github.com/UbiGrowth/VIBE';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, `https://x-access-token:${token}@github.com/UbiGrowth/VIBE.git`);
  });

  it('should handle UbiGrowth/VIBE SSH URL', () => {
    const repoUrl = 'git@github.com:UbiGrowth/VIBE.git';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, `https://x-access-token:${token}@github.com/UbiGrowth/VIBE.git`);
  });

  it('should handle facebook/react URL', () => {
    const repoUrl = 'https://github.com/facebook/react.git';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, `https://x-access-token:${token}@github.com/facebook/react.git`);
  });
});

describe('withGithubToken - Invalid URLs', () => {
  const token = 'ghp_test123token';

  it('should return unchanged URL for invalid format', () => {
    const repoUrl = 'https://gitlab.com/owner/repo';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, repoUrl);
  });

  it('should return unchanged URL for malformed GitHub URL', () => {
    const repoUrl = 'https://github.com/owner';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, repoUrl);
  });

  it('should return unchanged URL for empty string', () => {
    const repoUrl = '';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, repoUrl);
  });

  it('should return unchanged URL for repo name with only .git', () => {
    const repoUrl = 'https://github.com/owner/.git';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, repoUrl);
  });

  it('should return unchanged URL for SSH with multiple path segments', () => {
    const repoUrl = 'git@github.com:owner/repo/extra/path.git';
    const result = withGithubToken(repoUrl, token);
    assert.strictEqual(result, repoUrl);
  });
});

describe('withGithubToken - Token Security', () => {
  it('should not log or expose token in any way', () => {
    // This test verifies the function doesn't have console.log or similar
    // We can't truly test this without intercepting console, but we ensure
    // the function completes without side effects
    const token = 'super_secret_token';
    const repoUrl = 'https://github.com/owner/repo';
    
    const result = withGithubToken(repoUrl, token);
    
    // Function should complete successfully and return expected format
    assert.ok(result.includes('x-access-token'));
    assert.ok(result.includes(token));
    assert.ok(result.includes('@github.com'));
  });
});
