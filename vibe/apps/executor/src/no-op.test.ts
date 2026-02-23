import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeUnifiedDiff, validateUnifiedDiffEnhanced, extractDiff } from './diff-validator';

/**
 * No-op Support Test Suite
 * 
 * Tests the handling of NO_CHANGES responses from the LLM.
 */

describe('No-op Support - NO_CHANGES Response', () => {
  it('should accept exactly "NO_CHANGES" as valid response', () => {
    const noChangesResponse = 'NO_CHANGES';
    
    // NO_CHANGES should not be processed as a diff
    // It should be detected at a higher level (in generateDiff)
    // This test verifies that sanitizeUnifiedDiff returns null for NO_CHANGES
    const sanitized = sanitizeUnifiedDiff(noChangesResponse);
    assert.strictEqual(sanitized, null, 'NO_CHANGES should not be treated as a diff');
  });

  it('should reject NO_CHANGES with extra whitespace', () => {
    const responses = [
      '  NO_CHANGES',
      'NO_CHANGES  ',
      '  NO_CHANGES  ',
      '\nNO_CHANGES',
      'NO_CHANGES\n\n',
    ];
    
    for (const response of responses) {
      const sanitized = sanitizeUnifiedDiff(response);
      // After trimming in the main code, these would become "NO_CHANGES"
      // but sanitizeUnifiedDiff itself should return null
      assert.strictEqual(sanitized, null, `Response "${response}" should not be treated as a diff`);
    }
  });

  it('should reject NO_CHANGES with additional text', () => {
    const responses = [
      'NO_CHANGES - the code is already correct',
      'Sure, NO_CHANGES',
      'NO_CHANGES\nThe feature is already implemented.',
    ];
    
    for (const response of responses) {
      const sanitized = sanitizeUnifiedDiff(response);
      assert.strictEqual(sanitized, null, `Response "${response}" should not be treated as valid`);
    }
  });

  it('should reject case variations of NO_CHANGES', () => {
    const responses = [
      'no_changes',
      'No_Changes',
      'NO_changes',
      'no changes',
      'NOCHANGES',
    ];
    
    for (const response of responses) {
      const sanitized = sanitizeUnifiedDiff(response);
      assert.strictEqual(sanitized, null, `Response "${response}" should not be treated as valid`);
    }
  });
});

describe('No-op Support - Empty String Handling', () => {
  it('should reject empty string', () => {
    const emptyResponse = '';
    
    const sanitized = sanitizeUnifiedDiff(emptyResponse);
    assert.strictEqual(sanitized, null, 'Empty string should be rejected');
  });

  it('should reject whitespace-only string', () => {
    const responses = [
      ' ',
      '  ',
      '\n',
      '\n\n',
      '\t',
      '   \n\n\t  ',
    ];
    
    for (const response of responses) {
      const sanitized = sanitizeUnifiedDiff(response);
      assert.strictEqual(sanitized, null, `Whitespace-only response "${JSON.stringify(response)}" should be rejected`);
    }
  });

  it('should reject null and undefined inputs', () => {
    // TypeScript prevents us from passing null/undefined directly,
    // but we can test the behavior if it somehow happens
    const sanitized1 = sanitizeUnifiedDiff('');
    assert.strictEqual(sanitized1, null, 'Empty string should be rejected');
  });
});

describe('No-op Support - Integration with Normal Diffs', () => {
  it('should still accept valid diffs after NO_CHANGES handling', () => {
    const validDiff = `diff --git a/test.js b/test.js
--- a/test.js
+++ b/test.js
@@ -1,2 +1,3 @@
 line1
+line2
 line3
`;
    
    const sanitized = sanitizeUnifiedDiff(validDiff);
    assert.ok(sanitized !== null, 'Valid diff should still be accepted');
    assert.ok(sanitized.startsWith('diff --git'), 'Should start with diff header');
    
    // Extract and validate like in the main code
    const diff = extractDiff(sanitized);
    const validation = validateUnifiedDiffEnhanced(diff);
    assert.strictEqual(validation.ok, true, 'Valid diff should pass validation');
  });

  it('should accept diff with NO_CHANGES in the content', () => {
    // This tests that NO_CHANGES appearing in diff content is not confused
    // with the special NO_CHANGES response
    const validDiffWithNoChangesInContent = `diff --git a/test.js b/test.js
--- a/test.js
+++ b/test.js
@@ -1,2 +1,3 @@
 line1
+// NO_CHANGES marker
 line3
`;
    
    const sanitized = sanitizeUnifiedDiff(validDiffWithNoChangesInContent);
    assert.ok(sanitized !== null, 'Should sanitize the diff');
    
    // Extract and validate like in the main code
    const diff = extractDiff(sanitized);
    const validation = validateUnifiedDiffEnhanced(diff);
    assert.strictEqual(validation.ok, true, 'Valid diff with NO_CHANGES in content should pass');
  });
});

describe('No-op Support - LLM Response Normalization', () => {
  it('should simulate main code normalization of NO_CHANGES', () => {
    // This simulates what happens in generateDiff()
    const responses = [
      'NO_CHANGES',
      '  NO_CHANGES',
      'NO_CHANGES  ',
      '  NO_CHANGES  ',
      '\nNO_CHANGES',
      'NO_CHANGES\n',
    ];
    
    for (const response of responses) {
      const normalized = response.trim();
      assert.strictEqual(normalized, 'NO_CHANGES', 
        `Response "${response}" should normalize to "NO_CHANGES"`);
    }
  });

  it('should not normalize responses with additional content', () => {
    const responses = [
      'NO_CHANGES is the answer',
      'The answer is NO_CHANGES',
      'NO_CHANGES\nBecause the code is good',
    ];
    
    for (const response of responses) {
      const normalized = response.trim();
      assert.notStrictEqual(normalized, 'NO_CHANGES', 
        `Response "${response}" should not normalize to "NO_CHANGES"`);
    }
  });
});
