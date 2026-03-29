import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeLLMOutput } from './diff-validator';

/**
 * Test suite for LLM output normalization.
 * Validates that normalization enforces:
 * 1. Trim whitespace
 * 2. Remove markdown code fences
 * 3. Detect NO_CHANGES token
 * 4. Require diff --git as first non-whitespace
 */

describe('normalizeLLMOutput', () => {
  describe('NO_CHANGES detection', () => {
    it('should normalize exact NO_CHANGES token', () => {
      const result = normalizeLLMOutput('NO_CHANGES');
      assert.strictEqual(result, 'NO_CHANGES');
    });

    it('should normalize NO_CHANGES with whitespace', () => {
      const result = normalizeLLMOutput('  NO_CHANGES  \n');
      assert.strictEqual(result, 'NO_CHANGES');
    });

    it('should normalize NO_CHANGES anywhere in output', () => {
      const result = normalizeLLMOutput('The result is NO_CHANGES for this request.');
      assert.strictEqual(result, 'NO_CHANGES');
    });

    it('should normalize NO_CHANGES in code fence', () => {
      const result = normalizeLLMOutput('```\nNO_CHANGES\n```');
      assert.strictEqual(result, 'NO_CHANGES');
    });

    it('should be case-sensitive (no_changes should not match)', () => {
      const result = normalizeLLMOutput('no_changes');
      assert.strictEqual(result, null);
    });
  });

  describe('Whitespace trimming', () => {
    it('should trim leading and trailing whitespace', () => {
      const input = '  \n  diff --git a/test.js b/test.js\n--- a/test.js\n+++ b/test.js\n  \n  ';
      const result = normalizeLLMOutput(input);
      assert.ok(result !== null);
      assert.ok(result.startsWith('diff --git'));
      assert.ok(!result.startsWith(' '));
    });

    it('should handle multiple newlines', () => {
      const input = '\n\n\ndiff --git a/test.js b/test.js\n--- a/test.js\n+++ b/test.js\n\n\n';
      const result = normalizeLLMOutput(input);
      assert.ok(result !== null);
      assert.ok(result.startsWith('diff --git'));
    });
  });

  describe('Markdown code fence removal', () => {
    it('should remove code fence at start', () => {
      const input = '```diff\ndiff --git a/test.js b/test.js\n--- a/test.js\n+++ b/test.js';
      const result = normalizeLLMOutput(input);
      assert.ok(result !== null);
      assert.ok(!result.includes('```'));
      assert.ok(result.startsWith('diff --git'));
    });

    it('should remove code fence at end', () => {
      const input = 'diff --git a/test.js b/test.js\n--- a/test.js\n+++ b/test.js\n```';
      const result = normalizeLLMOutput(input);
      assert.ok(result !== null);
      assert.ok(!result.includes('```'));
      assert.ok(result.startsWith('diff --git'));
    });

    it('should remove code fences at both start and end', () => {
      const input = '```diff\ndiff --git a/test.js b/test.js\n--- a/test.js\n+++ b/test.js\n```';
      const result = normalizeLLMOutput(input);
      assert.ok(result !== null);
      assert.ok(!result.includes('```'));
      assert.ok(result.startsWith('diff --git'));
    });

    it('should handle plain ``` without language specifier', () => {
      const input = '```\ndiff --git a/test.js b/test.js\n--- a/test.js\n+++ b/test.js\n```';
      const result = normalizeLLMOutput(input);
      assert.ok(result !== null);
      assert.ok(!result.includes('```'));
      assert.ok(result.startsWith('diff --git'));
    });
  });

  describe('diff --git requirement', () => {
    it('should accept valid diff starting with diff --git', () => {
      const input = 'diff --git a/test.js b/test.js\n--- a/test.js\n+++ b/test.js';
      const result = normalizeLLMOutput(input);
      assert.ok(result !== null);
      assert.ok(result.startsWith('diff --git'));
    });

    it('should reject output without diff --git', () => {
      const input = 'function hello() {\n  console.log("world");\n}';
      const result = normalizeLLMOutput(input);
      assert.strictEqual(result, null);
    });

    it('should reject output with prose before diff', () => {
      const input = 'Here is the diff:\ndiff --git a/test.js b/test.js\n--- a/test.js\n+++ b/test.js';
      const result = normalizeLLMOutput(input);
      assert.strictEqual(result, null);
    });

    it('should reject empty output', () => {
      const result = normalizeLLMOutput('');
      assert.strictEqual(result, null);
    });

    it('should reject whitespace-only output', () => {
      const result = normalizeLLMOutput('   \n   \n   ');
      assert.strictEqual(result, null);
    });
  });

  describe('Combined scenarios', () => {
    it('should handle typical LLM response with code fence', () => {
      const input = '```diff\ndiff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1,3 +1,4 @@\n function main() {\n+  console.log("start");\n   return true;\n }\n```';
      const result = normalizeLLMOutput(input);
      assert.ok(result !== null);
      assert.ok(result.startsWith('diff --git'));
      assert.ok(!result.includes('```'));
      assert.ok(result.includes('@@ -1,3 +1,4 @@'));
    });

    it('should handle diff with extra whitespace and fences', () => {
      const input = '  \n  ```\n  diff --git a/test.js b/test.js\n--- a/test.js\n+++ b/test.js\n  ```  \n  ';
      const result = normalizeLLMOutput(input);
      assert.ok(result !== null);
      assert.ok(result.startsWith('diff --git'));
    });

    it('should prioritize NO_CHANGES over diff detection', () => {
      // If output contains NO_CHANGES, it should return that even if diff --git is also present
      const input = 'NO_CHANGES: diff --git a/test.js b/test.js';
      const result = normalizeLLMOutput(input);
      assert.strictEqual(result, 'NO_CHANGES');
    });
  });
});
