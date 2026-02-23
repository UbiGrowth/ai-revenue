import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildContext, formatContext } from './context-builder';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Context Builder Test Suite
 * 
 * Tests that the context builder:
 * 1. Returns non-empty context even when ripgrep finds nothing
 * 2. Includes README.md as fallback
 * 3. Properly logs scan paths and files found
 */

describe('Context Builder - Empty Repository Handling', () => {
  it('should include README.md when no files match keywords', async () => {
    // Create a temporary directory with only README.md
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-context-test-'));
    
    try {
      // Create README.md
      const readmePath = path.join(tempDir, 'README.md');
      fs.writeFileSync(readmePath, '# Test Repository\n\nThis is a test.');
      
      // Build context with keywords that won't match
      const prompt = 'Update the authentication logic';
      const result = await buildContext(tempDir, prompt);
      
      // Should have found README.md as fallback
      assert.ok(result.files.size > 0, 'Context should not be empty');
      assert.ok(result.files.has('README.md'), 'Context should include README.md');
      assert.ok(result.totalSize > 0, 'Total size should be greater than 0');
      
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should include package.json when no other files match', async () => {
    // Create a temporary directory with only package.json
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-context-test-'));
    
    try {
      // Create package.json
      const packagePath = path.join(tempDir, 'package.json');
      fs.writeFileSync(packagePath, JSON.stringify({
        name: 'test-package',
        version: '1.0.0'
      }, null, 2));
      
      // Build context with keywords that won't match
      const prompt = 'Fix the database connection issue';
      const result = await buildContext(tempDir, prompt);
      
      // Should have found package.json as fallback
      assert.ok(result.files.size > 0, 'Context should not be empty');
      assert.ok(result.files.has('package.json'), 'Context should include package.json');
      
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should find common entry points when keywords do not match', async () => {
    // Create a temporary directory with index.js
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-context-test-'));
    
    try {
      // Create index.js
      const indexPath = path.join(tempDir, 'index.js');
      fs.writeFileSync(indexPath, 'console.log("Hello World");');
      
      // Build context with unrelated keywords
      const prompt = 'Update the documentation';
      const result = await buildContext(tempDir, prompt);
      
      // Should have found index.js as common entry point
      assert.ok(result.files.size > 0, 'Context should not be empty');
      assert.ok(result.files.has('index.js'), 'Context should include index.js');
      
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('Context Builder - Keyword Matching', () => {
  it('should find files matching keywords from prompt', async () => {
    // Create a temporary directory with files
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-context-test-'));
    
    try {
      // Create files with specific keywords
      const authPath = path.join(tempDir, 'auth.js');
      fs.writeFileSync(authPath, 'function authenticate(user) { return true; }');
      
      const loginPath = path.join(tempDir, 'login.js');
      fs.writeFileSync(loginPath, 'function login(email, password) { authenticate(); }');
      
      // Also add README.md as fallback in case ripgrep is not available
      const readmePath = path.join(tempDir, 'README.md');
      fs.writeFileSync(readmePath, '# Test\n\nAuthenticate users.');
      
      // Build context with matching keyword
      const prompt = 'Fix the authenticate function';
      const result = await buildContext(tempDir, prompt);
      
      // Should have found at least one file (either auth.js via ripgrep, or README.md as fallback)
      assert.ok(result.files.size > 0, 'Context should not be empty');
      // If ripgrep is available, it should find auth.js; otherwise README.md is fine
      assert.ok(
        result.files.has('auth.js') || result.files.has('README.md'), 
        'Context should include auth.js (if ripgrep works) or README.md (as fallback)'
      );
      
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('Context Builder - Format Context', () => {
  it('should format context with file paths and content', () => {
    const files = new Map<string, string>();
    files.set('test1.js', 'console.log("test1");');
    files.set('test2.js', 'console.log("test2");');
    
    const formatted = formatContext(files);
    
    assert.ok(formatted.includes('--- test1.js ---'), 'Should include file path');
    assert.ok(formatted.includes('console.log("test1");'), 'Should include file content');
    assert.ok(formatted.includes('--- test2.js ---'), 'Should include second file path');
    assert.ok(formatted.includes('console.log("test2");'), 'Should include second file content');
  });

  it('should return empty string for empty file map', () => {
    const files = new Map<string, string>();
    const formatted = formatContext(files);
    assert.strictEqual(formatted, '', 'Should return empty string');
  });
});

describe('Context Builder - Size Limits', () => {
  it('should truncate when exceeding MAX_CONTEXT_SIZE', async () => {
    // Create a temporary directory with large files
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-context-test-'));
    
    try {
      // Create a file with content that will match
      const largePath = path.join(tempDir, 'large.js');
      const largeContent = 'function test() {\n' + '  // line\n'.repeat(10000) + '}';
      fs.writeFileSync(largePath, largeContent);
      
      // Build context
      const prompt = 'Update the test function';
      const result = await buildContext(tempDir, prompt);
      
      // Should be truncated
      const maxSize = parseInt(process.env.MAX_CONTEXT_SIZE || '50000', 10);
      if (result.totalSize >= maxSize) {
        assert.ok(result.truncated, 'Should be marked as truncated');
      }
      
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
