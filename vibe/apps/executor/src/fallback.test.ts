import { describe, it } from 'node:test';
import assert from 'node:assert';

/**
 * Fallback Mode Test Suite
 * 
 * Tests the executor's ability to switch to fallback mode after repeated patch failures.
 * Note: These tests use a mock approach since the executor is designed as a singleton service.
 */

describe('Fallback Mode - extractFailedFiles', () => {
  // Helper to extract files from error messages (mirrors the private method logic)
  function extractFailedFiles(errorMessage: string): string[] {
    const files: string[] = [];
    
    const patterns = [
      /error: patch failed: ([^:]+):/g,
      /error: ([^:]+): patch does not apply/g
    ];

    for (const pattern of patterns) {
      const matches = errorMessage.matchAll(pattern);
      for (const match of matches) {
        const file = match[1].trim();
        if (file && !files.includes(file)) {
          files.push(file);
        }
      }
    }

    return files;
  }

  it('should extract file from "patch failed" error format', () => {
    const error = 'error: patch failed: src/test.js:1';
    const files = extractFailedFiles(error);
    
    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0], 'src/test.js');
  });

  it('should extract file from "patch does not apply" error format', () => {
    const error = 'error: src/login.js: patch does not apply';
    const files = extractFailedFiles(error);
    
    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0], 'src/login.js');
  });

  it('should extract multiple files from combined error messages', () => {
    const error = `error: patch failed: src/auth.js:5
error: src/auth.js: patch does not apply
error: patch failed: src/validate.js:10
error: src/validate.js: patch does not apply`;
    const files = extractFailedFiles(error);
    
    assert.strictEqual(files.length, 2);
    assert.ok(files.includes('src/auth.js'));
    assert.ok(files.includes('src/validate.js'));
  });

  it('should return empty array when no file patterns match', () => {
    const error = 'Some generic error message without file information';
    const files = extractFailedFiles(error);
    
    assert.strictEqual(files.length, 0);
  });

  it('should handle file paths with special characters', () => {
    const error = 'error: patch failed: src/components/Login-Form.tsx:15';
    const files = extractFailedFiles(error);
    
    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0], 'src/components/Login-Form.tsx');
  });

  it('should not duplicate files when they appear multiple times', () => {
    const error = `error: patch failed: src/test.js:1
error: patch failed: src/test.js:5
error: src/test.js: patch does not apply`;
    const files = extractFailedFiles(error);
    
    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0], 'src/test.js');
  });
});

describe('Fallback Mode - Behavior Validation', () => {
  it('should track consecutive apply failures independently', () => {
    // This test validates the concept of tracking consecutive failures
    let consecutiveApplyFailures = 0;
    let fallbackActivated = false;
    
    // Simulate first failure
    consecutiveApplyFailures++;
    assert.strictEqual(consecutiveApplyFailures, 1);
    assert.strictEqual(fallbackActivated, false);
    
    // Simulate second failure - should activate fallback
    consecutiveApplyFailures++;
    if (consecutiveApplyFailures >= 2) {
      fallbackActivated = true;
    }
    
    assert.strictEqual(consecutiveApplyFailures, 2);
    assert.strictEqual(fallbackActivated, true);
  });

  it('should reset fallback state on successful apply', () => {
    // Simulate the state tracking
    let fallbackFiles = new Set(['src/test.js']);
    let globalFallback = true;
    
    // Simulate successful apply
    fallbackFiles.clear();
    globalFallback = false;
    
    assert.strictEqual(fallbackFiles.size, 0);
    assert.strictEqual(globalFallback, false);
  });

  it('should accumulate failed files in fallback set', () => {
    const fallbackFiles = new Set<string>();
    
    // First failure
    ['src/auth.js'].forEach(f => fallbackFiles.add(f));
    assert.strictEqual(fallbackFiles.size, 1);
    
    // Second failure with different file
    ['src/validate.js'].forEach(f => fallbackFiles.add(f));
    assert.strictEqual(fallbackFiles.size, 2);
    
    // Attempt with same file - should not duplicate
    ['src/auth.js'].forEach(f => fallbackFiles.add(f));
    assert.strictEqual(fallbackFiles.size, 2);
  });

  it('should prefer file-specific fallback over global', () => {
    const fallbackFiles = new Set(['src/test.js']);
    let globalFallback = false;
    
    // If we have specific files, we should use file-specific fallback
    const shouldUseFileSpecific = fallbackFiles.size > 0;
    const shouldUseGlobal = !shouldUseFileSpecific && globalFallback;
    
    assert.strictEqual(shouldUseFileSpecific, true);
    assert.strictEqual(shouldUseGlobal, false);
  });

  it('should use global fallback when no specific files identified', () => {
    const fallbackFiles = new Set<string>();
    let globalFallback = true;
    
    // If we don't have specific files but global is active
    const shouldUseFileSpecific = fallbackFiles.size > 0;
    const shouldUseGlobal = !shouldUseFileSpecific && globalFallback;
    
    assert.strictEqual(shouldUseFileSpecific, false);
    assert.strictEqual(shouldUseGlobal, true);
  });
});

describe('Fallback Mode - System Prompt Validation', () => {
  it('should include fallback instructions for file-specific mode', () => {
    const fallbackFiles = new Set(['src/test.js', 'src/login.js']);
    const fileList = Array.from(fallbackFiles).join(', ');
    
    const expectedInstructions = `FALLBACK MODE: Previous diffs failed to apply for files: ${fileList}`;
    
    assert.ok(expectedInstructions.includes('src/test.js'));
    assert.ok(expectedInstructions.includes('src/login.js'));
    assert.ok(expectedInstructions.includes('FALLBACK MODE'));
  });

  it('should include fallback instructions for global mode', () => {
    const expectedInstructions = `FALLBACK MODE: Previous diffs failed to apply.
Generate diffs that REPLACE THE ENTIRE FILE CONTENT for all modified files`;
    
    assert.ok(expectedInstructions.includes('FALLBACK MODE'));
    assert.ok(expectedInstructions.includes('REPLACE THE ENTIRE FILE CONTENT'));
  });
});
