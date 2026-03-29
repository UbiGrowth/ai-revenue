import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { buildCredentialedUrl } from './git-url';

/**
 * buildCredentialedUrl Test Suite
 * 
 * Tests the helper function that adds GitHub token authentication to repository URLs
 */

describe('buildCredentialedUrl - With Token', () => {
  const originalToken = process.env.GITHUB_TOKEN;
  
  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'ghp_test_token_123';
  });
  
  afterEach(() => {
    if (originalToken) {
      process.env.GITHUB_TOKEN = originalToken;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
  });
  
  it('should add token to GitHub URL without .git', () => {
    const url = 'https://github.com/UbiGrowth/VIBE';
    const result = buildCredentialedUrl(url);
    
    assert.strictEqual(result, 'https://x-access-token:ghp_test_token_123@github.com/UbiGrowth/VIBE.git');
  });
  
  it('should add token to GitHub URL with .git', () => {
    const url = 'https://github.com/UbiGrowth/VIBE.git';
    const result = buildCredentialedUrl(url);
    
    assert.strictEqual(result, 'https://x-access-token:ghp_test_token_123@github.com/UbiGrowth/VIBE.git');
  });
  
  it('should handle URL with multiple path segments', () => {
    const url = 'https://github.com/org/repo/with/path';
    const result = buildCredentialedUrl(url);
    
    assert.strictEqual(result, 'https://x-access-token:ghp_test_token_123@github.com/org/repo/with/path.git');
  });
  
  it('should always end with .git', () => {
    const urls = [
      'https://github.com/UbiGrowth/VIBE',
      'https://github.com/UbiGrowth/VIBE.git',
      'https://github.com/user/repo'
    ];
    
    for (const url of urls) {
      const result = buildCredentialedUrl(url);
      assert.ok(result.endsWith('.git'), `Expected ${result} to end with .git`);
    }
  });
});

describe('buildCredentialedUrl - Without Token', () => {
  const originalToken = process.env.GITHUB_TOKEN;
  
  beforeEach(() => {
    delete process.env.GITHUB_TOKEN;
  });
  
  afterEach(() => {
    if (originalToken) {
      process.env.GITHUB_TOKEN = originalToken;
    }
  });
  
  it('should return URL with .git when no token is set', () => {
    const url = 'https://github.com/UbiGrowth/VIBE';
    const result = buildCredentialedUrl(url);
    
    assert.strictEqual(result, 'https://github.com/UbiGrowth/VIBE.git');
    assert.ok(!result.includes('@'), 'Should not contain @ when no token');
    assert.ok(!result.includes('x-access-token'), 'Should not contain x-access-token when no token');
  });
  
  it('should preserve .git suffix when no token', () => {
    const url = 'https://github.com/UbiGrowth/VIBE.git';
    const result = buildCredentialedUrl(url);
    
    assert.strictEqual(result, 'https://github.com/UbiGrowth/VIBE.git');
  });
  
  it('should add .git suffix to non-GitHub URLs when no token', () => {
    const url = 'https://gitlab.com/user/repo';
    const result = buildCredentialedUrl(url);
    
    assert.strictEqual(result, 'https://gitlab.com/user/repo.git');
    assert.ok(!result.includes('@'), 'Should not add token to non-GitHub URLs');
  });
});

describe('buildCredentialedUrl - Non-GitHub URLs', () => {
  const originalToken = process.env.GITHUB_TOKEN;
  
  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'ghp_test_token_123';
  });
  
  afterEach(() => {
    if (originalToken) {
      process.env.GITHUB_TOKEN = originalToken;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
  });
  
  it('should not add token to non-GitHub HTTPS URLs', () => {
    const urls = [
      'https://gitlab.com/user/repo',
      'https://bitbucket.org/user/repo',
      'https://example.com/repo'
    ];
    
    for (const url of urls) {
      const result = buildCredentialedUrl(url);
      assert.ok(!result.includes('@'), `${result} should not contain token for non-GitHub URL`);
      assert.ok(!result.includes('x-access-token'), `${result} should not contain x-access-token`);
      assert.ok(result.endsWith('.git'), `${result} should end with .git`);
    }
  });
  
  it('should not add token to SSH URLs', () => {
    const url = 'git@github.com:UbiGrowth/VIBE.git';
    const result = buildCredentialedUrl(url);
    
    assert.ok(!result.includes('x-access-token'), 'Should not modify SSH URLs');
    assert.strictEqual(result, 'git@github.com:UbiGrowth/VIBE.git');
  });
  
  it('should handle http:// GitHub URLs (not https://)', () => {
    const url = 'http://github.com/UbiGrowth/VIBE';
    const result = buildCredentialedUrl(url);
    
    // Should not add token to non-HTTPS URLs
    assert.ok(!result.includes('x-access-token'), 'Should not add token to HTTP URLs');
    assert.ok(result.endsWith('.git'), 'Should still add .git suffix');
  });
});
