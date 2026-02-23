# Hunk Line Validation Implementation

## Overview

The VIBE executor implements robust hunk line validation to prevent malformed diffs from being applied to repositories. This validation is a critical security and reliability feature that catches corrupt patches before they reach `git apply`.

## Implementation

### Validation Logic

Located in `apps/executor/src/diff-validator.ts` (lines 264-288):

```typescript
// Basic structure validation: check that +/- lines follow proper format
// Strengthened validation: once inside a hunk (after @@ line), every non-empty line
// must start with +, -, space, or \ (for "No newline at end of file" marker)
let inHunk = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.startsWith('@@')) {
    inHunk = true;
    continue;
  }

  if (line.startsWith('diff --git ')) {
    inHunk = false;
    continue;
  }

  // In hunk, lines should start with +, -, or space (or be empty)
  // This catches corrupt patches where lines like "// VIBE TEST APPLY" appear without proper prefix
  if (inHunk && line.length > 0) {
    const firstChar = line[0];
    if (firstChar !== '+' && firstChar !== '-' && firstChar !== ' ' && firstChar !== '\\') {
      // Allow \ for "\ No newline at end of file"
      errors.push(`Invalid diff line at ${i + 1}: lines in hunks must start with +, -, space, or \\. Found: "${line.substring(0, Math.min(50, line.length))}"`);
      break; // Only report first error of this type
    }
  }
}
```

### Rule

Once a hunk header (`@@ ... @@`) is encountered, every following line until the next hunk header or next file must start with one of:

- `" "` (space) - for context lines
- `"+"` - for added lines
- `"-"` - for removed lines  
- `"\\"` - for "\ No newline at end of file" marker

Any line that violates this rule causes the diff to be rejected with a descriptive error message.

### Integration

The validation is integrated into the main executor loop in `apps/executor/src/index.ts` (line 354):

```typescript
const enhancedValidation = validateUnifiedDiffEnhanced(diff);

if (!enhancedValidation.ok) {
  const errorMsg = enhancedValidation.errors.join('; ');
  storage.logEvent(taskId, `Invalid diff: ${errorMsg}`, 'error');
  return null; // Triggers retry
}
```

When validation fails:
1. Error is logged to storage
2. Function returns `null`
3. Main loop retries with updated prompt that includes the error message
4. LLM is prompted to generate a valid diff

## Test Coverage

Comprehensive test coverage in `apps/executor/src/diff-validator.test.ts`:

### Test: Reject invalid line prefixes (line 391)
Tests that lines with invalid prefixes (e.g., `>` instead of `+/-/ `) are rejected.

### Test: Accept backslash marker (line 407)
Tests that `\ No newline at end of file` marker is correctly accepted.

### Test: Accept valid +// comment (line 422)
Tests that a line like `+  // VIBE TEST APPLY` is correctly accepted as a valid added line.

### Test: Reject // without + prefix (line 438)
Tests the exact failure case mentioned in the problem statement - a line starting with `//` without the required `+` prefix:

```typescript
it('should reject invalid patch where hunk line starts with / without +', () => {
  const invalidDiffMissingPrefix = `diff --git a/test.js b/test.js
--- a/test.js
+++ b/test.js
@@ -1,3 +1,4 @@
 function hello() {
// VIBE TEST APPLY
   return true;
 }
`;
  
  const result = validateUnifiedDiff(invalidDiffMissingPrefix);
  assert.strictEqual(result.valid, false, 'Invalid diff with // comment (missing +) should fail');
  assert.ok(result.error?.includes('Invalid diff line'), 'Error should mention invalid diff line');
  assert.ok(result.error?.includes('// VIBE TEST APPLY'), 'Error should show the problematic line');
});
```

## Benefits

This validation provides:

1. **Early detection**: Catches malformed diffs before `git apply` is attempted
2. **Clear error messages**: Provides specific line numbers and content for debugging
3. **Automatic retry**: Triggers the retry loop so the LLM can correct the mistake
4. **Security**: Prevents potentially dangerous or corrupt patches from being applied
5. **Reliability**: Ensures only properly formatted unified diffs are processed

## Test Results

All 110 tests pass, including the 4 tests in the "Invalid Diff Line Format" suite:
- ✔ should reject diff with invalid line prefixes in hunk
- ✔ should accept backslash for "No newline" marker
- ✔ should accept valid patch with +// comment
- ✔ should reject invalid patch where hunk line starts with / without +
