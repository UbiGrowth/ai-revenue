import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Validates that LLM output is a proper unified diff
export interface DiffValidationResult {
  valid: boolean;
  error?: string;
  lineCount?: number;
}

// New validation result format
export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const MAX_DIFF_SIZE = parseInt(process.env.MAX_DIFF_SIZE || '5000', 10);

/**
 * Normalizes LLM output before validation.
 * 
 * Rules:
 * 1. Trim whitespace
 * 2. Remove surrounding markdown code fences if present
 * 3. If output contains "NO_CHANGES" (case-sensitive) anywhere, normalize to exactly "NO_CHANGES"
 * 4. Otherwise require first non-whitespace chars to be "diff --git" (fail if not)
 * 
 * @param rawOutput - Raw LLM output
 * @returns Normalized output or null if invalid
 */
export function normalizeLLMOutput(rawOutput: string): string | null {
  // Step 1: Trim whitespace
  let normalized = rawOutput.trim();
  
  // Step 2: Check for NO_CHANGES token (case-sensitive)
  if (normalized.includes('NO_CHANGES')) {
    return 'NO_CHANGES';
  }
  
  // Step 3: Remove surrounding markdown code fences if present
  // Handle both ```diff and ``` at the start
  if (normalized.startsWith('```')) {
    const lines = normalized.split('\n');
    // Remove first line if it's a code fence
    if (lines[0].trim().startsWith('```')) {
      lines.shift();
    }
    normalized = lines.join('\n').trim();
  }
  
  // Remove trailing ``` if present
  if (normalized.endsWith('```')) {
    const lines = normalized.split('\n');
    if (lines[lines.length - 1].trim() === '```') {
      lines.pop();
    }
    normalized = lines.join('\n').trim();
  }
  
  // Step 4: Require first non-whitespace chars to be "diff --git"
  if (!normalized.startsWith('diff --git ')) {
    return null;
  }
  
  return normalized;
}

/**
 * Sanitizes raw LLM output to extract the unified diff.
 * Finds the first occurrence of "diff --git " and returns content from there.
 * Removes markdown code fences if present.
 * Rejects output with commentary or explanatory text.
 * 
 * @param raw - Raw LLM output that may contain explanations, markdown, etc.
 * @returns Sanitized diff string or null if no valid diff header found or commentary detected
 */
export function sanitizeUnifiedDiff(raw: string): string | null {
  // Check for commentary patterns in the raw output before processing
  const lines = raw.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (trimmedLine.length === 0) continue;
    
    // If we've reached the diff, stop checking
    if (trimmedLine.startsWith('diff --git ')) break;
    
    // Check for common commentary patterns before the diff
    const commentaryPatterns = [
      /^Here's/i,
      /^Sure/i,
      /^I'll/i,
      /^Let me/i,
      /^I've/i,
      /^I have/i,
      /^This (diff|patch|change)/i,
      /^The (diff|patch|change)/i,
      /^Below is/i,
      /^Above is/i,
    ];
    
    for (const pattern of commentaryPatterns) {
      if (pattern.test(trimmedLine)) {
        return null;
      }
    }
  }

  // Find the first occurrence of "diff --git "
  const index = raw.indexOf('diff --git ');
  if (index === -1) {
    return null;
  }

  // Extract from that point to the end
  let result = raw.substring(index);

  // Trim leading/trailing whitespace
  result = result.trim();

  // Check if there are any ``` markers in the result (these shouldn't be in valid diffs)
  if (result.includes('```')) {
    // Only remove trailing ``` if it's at the very end (common LLM pattern)
    const lines = result.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    if (lastLine === '```') {
      // Remove the last line
      lines.pop();
      result = lines.join('\n').trim();
    } else {
      // ``` appears somewhere else - this is invalid
      return null;
    }
  }

  // Final guard: Check for commentary still present in the diff
  const resultLines = result.split('\n');
  for (const line of resultLines) {
    const trimmedLine = line.trim();
    
    // Check for markdown code fences (these should not be in a valid diff)
    if (trimmedLine.startsWith('```')) {
      return null;
    }
    
    // Check for commentary patterns in the diff body
    // Skip lines that are valid diff elements
    if (trimmedLine.startsWith('diff --git ') || 
        trimmedLine.startsWith('---') || 
        trimmedLine.startsWith('+++') || 
        trimmedLine.startsWith('@@') ||
        trimmedLine.startsWith('+') ||
        trimmedLine.startsWith('-') ||
        trimmedLine.startsWith(' ') ||
        trimmedLine.length === 0) {
      continue;
    }
    
    // Any other non-empty line that doesn't match diff format is suspicious
    const commentaryPatterns = [
      /^Here's/i,
      /^Sure/i,
      /^I'll/i,
      /^Let me/i,
      /^I've/i,
      /^I have/i,
      /^This (diff|patch|change)/i,
      /^The (diff|patch|change)/i,
    ];
    
    for (const pattern of commentaryPatterns) {
      if (pattern.test(trimmedLine)) {
        return null;
      }
    }
  }

  return result;
}

/**
 * DiffValidator: Enforces unified diff format and rejects non-diff output
 * 
 * Responsibilities:
 * 1. Validates unified diff format (reject code blocks, explanations, etc.)
 * 2. Enforces size limits (hard cap at MAX_DIFF_SIZE lines)
 * 3. Performs git apply --check before allowing apply
 * 4. Fails fast with explicit error messages
 */

/**
 * Enhanced validation function that returns detailed error information.
 * For each diff block, ensures proper --- and +++ headers are present.
 * 
 * @param content - The diff content to validate
 * @returns ValidationResult with ok status and any errors found
 */
export function validateUnifiedDiffEnhanced(content: string): ValidationResult {
  const lines = content.split('\n');
  const errors: string[] = [];

  // Check hard cap on diff size
  if (lines.length > MAX_DIFF_SIZE) {
    return {
      ok: false,
      errors: [`Diff exceeds maximum size: ${lines.length} lines > ${MAX_DIFF_SIZE} lines`]
    };
  }

  // Must have at least some content
  if (lines.length < 3) {
    return {
      ok: false,
      errors: ['Diff is too short to be valid']
    };
  }

  // Check for any content before first "diff --git"
  const firstDiffIndex = lines.findIndex(line => line.startsWith('diff --git '));
  if (firstDiffIndex === -1) {
    return {
      ok: false,
      errors: ['Missing unified diff header (diff --git)']
    };
  }

  // Check if there's any non-empty content before the first diff
  for (let i = 0; i < firstDiffIndex; i++) {
    if (lines[i].trim().length > 0) {
      return {
        ok: false,
        errors: ['Diff contains content before the first diff --git header']
      };
    }
  }

  // Parse diff blocks and validate each one has proper headers
  const diffBlocks: { file: string; hasMinusHeader: boolean; hasPlusHeader: boolean; lineNumber: number }[] = [];
  let currentBlock: { file: string; hasMinusHeader: boolean; hasPlusHeader: boolean; lineNumber: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('diff --git ')) {
      // Save previous block if exists
      if (currentBlock) {
        diffBlocks.push(currentBlock);
      }

      // Start new block
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      const fileName = match ? match[1] : 'unknown';
      currentBlock = {
        file: fileName,
        hasMinusHeader: false,
        hasPlusHeader: false,
        lineNumber: i + 1
      };
    } else if (currentBlock) {
      if (line.startsWith('---')) {
        currentBlock.hasMinusHeader = true;
      } else if (line.startsWith('+++')) {
        currentBlock.hasPlusHeader = true;
      }
    }
  }

  // Save last block
  if (currentBlock) {
    diffBlocks.push(currentBlock);
  }

  // Check if we have any file blocks
  if (diffBlocks.length === 0) {
    return {
      ok: false,
      errors: ['Diff contains no file blocks']
    };
  }

  // Validate each block has required headers
  for (const block of diffBlocks) {
    if (!block.hasMinusHeader) {
      errors.push(`File block '${block.file}' (line ${block.lineNumber}) is missing --- header`);
    }
    if (!block.hasPlusHeader) {
      errors.push(`File block '${block.file}' (line ${block.lineNumber}) is missing +++ header`);
    }
  }

  // Check for code blocks or other non-diff content
  if (content.includes('```')) {
    errors.push('Diff contains code blocks or markdown formatting');
  }

  // Check for hunk markers
  const hasHunkMarkers = lines.some(line => line.startsWith('@@'));
  if (!hasHunkMarkers) {
    errors.push('Missing hunk markers (@@)');
  }

  // Check that diff ends with newline (after extractDiff normalization)
  if (!content.endsWith('\n')) {
    errors.push('Diff must end with newline');
  }

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

    if (line.startsWith('diff --git ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
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

  return {
    ok: errors.length === 0,
    errors
  };
}

export function validateUnifiedDiff(content: string): DiffValidationResult {
  const lineCount = content.split('\n').length;
  
  // Use the enhanced validation
  const enhanced = validateUnifiedDiffEnhanced(content);
  
  return {
    valid: enhanced.ok,
    error: enhanced.errors.length > 0 ? enhanced.errors[0] : undefined,
    lineCount
  };
}

/**
 * Validates that a diff can be applied to a repository using git apply --check
 * This is a critical safety check before actually applying changes
 * 
 * @param diffContent - The unified diff content to validate
 * @param repoPath - Path to the git repository
 * @returns DiffValidationResult with validation status
 */
export function validateDiffApplicability(diffContent: string, repoPath: string): DiffValidationResult {
  let tempFile: string | null = null;
  
  try {
    // Create temporary file for diff
    tempFile = path.join(os.tmpdir(), `vibe-check-${Date.now()}.patch`);
    // Normalize line endings to LF (git patches require Unix-style line endings)
    // This prevents "corrupt patch" errors on Windows where CRLF might be used
    const normalizedDiff = diffContent.replace(/\r\n/g, '\n');
    // Explicitly use UTF-8 encoding to ensure consistent behavior across platforms
    fs.writeFileSync(tempFile, normalizedDiff, { encoding: 'utf-8' });

    // Run git apply --check (doesn't modify files, just validates)
    execSync(`git apply --check "${tempFile}"`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    return {
      valid: true
    };

  } catch (error: any) {
    // git apply --check failed
    const errorOutput = error.stderr || error.stdout || error.message;
    return {
      valid: false,
      error: `Diff cannot be applied: ${errorOutput.trim()}`
    };

  } finally {
    // Clean up temp file
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

/**
 * Normalizes content by removing leading whitespace and ensuring exactly one trailing newline.
 * Git patches require a trailing newline, so this function ensures consistent formatting.
 * 
 * @param content - The content to normalize
 * @returns The normalized content with leading whitespace removed and exactly one trailing newline
 */
function normalizeContent(content: string): string {
  // Remove leading whitespace but preserve trailing
  let normalized = content.trimStart();
  // Ensure exactly one trailing newline (git patches require this)
  normalized = normalized.replace(/\n*$/, '\n');
  return normalized;
}

// Extract clean diff from LLM response (remove markdown, explanations, etc.)
export function extractDiff(llmResponse: string): string {
  // If response contains code blocks, try to extract diff from them
  const codeBlockRegex = /```(?:diff)?\n([\s\S]*?)```/g;
  const matches = Array.from(llmResponse.matchAll(codeBlockRegex));
  
  if (matches.length > 0) {
    // Return first code block content, normalized
    return normalizeContent(matches[0][1]);
  }

  // Otherwise return as-is (will be validated), normalized
  return normalizeContent(llmResponse);
}

/**
 * Represents a file block in a unified diff
 */
export interface DiffFileBlock {
  filePath: string;
  isNewFile: boolean;
  isDeletedFile: boolean;
  hasDevNullSource: boolean; // --- /dev/null (creating file)
  hasDevNullTarget: boolean; // +++ /dev/null (deleting file)
  lineNumber: number;
}

/**
 * Parses a unified diff and extracts file blocks with their metadata.
 * 
 * @param diffContent - The unified diff content to parse
 * @returns Array of file blocks found in the diff
 */
export function parseDiffFileBlocks(diffContent: string): DiffFileBlock[] {
  const lines = diffContent.split('\n');
  const fileBlocks: DiffFileBlock[] = [];
  
  let currentBlock: DiffFileBlock | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // New file block starts with "diff --git"
    if (line.startsWith('diff --git ')) {
      // Save previous block if exists
      if (currentBlock) {
        fileBlocks.push(currentBlock);
      }
      
      // Extract file path from "diff --git a/path b/path"
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      const filePath = match ? match[2] : 'unknown';
      
      currentBlock = {
        filePath,
        isNewFile: false,
        isDeletedFile: false,
        hasDevNullSource: false,
        hasDevNullTarget: false,
        lineNumber: i + 1
      };
    } else if (currentBlock) {
      // Check for "new file mode" indicator
      if (line.startsWith('new file mode ')) {
        currentBlock.isNewFile = true;
      }
      // Check for "deleted file mode" indicator
      else if (line.startsWith('deleted file mode ')) {
        currentBlock.isDeletedFile = true;
      }
      // Check for "--- /dev/null" which indicates new file (even without explicit "new file mode")
      else if (line.startsWith('--- /dev/null')) {
        currentBlock.isNewFile = true;
      }
      // Check for "+++ /dev/null" which indicates deleted file
      else if (line.startsWith('+++ /dev/null')) {
        currentBlock.isDeletedFile = true;
      }
    }
  }
  
  // Save last block
  if (currentBlock) {
    fileBlocks.push(currentBlock);
  }
  
  return fileBlocks;
}

/**
 * Performs pre-apply sanity checks on a diff before running git apply.
 * 
 * Checks:
 * 1. If "new file mode" is declared for a file that already exists, reject it
 * 2. If "deleted file mode" is declared but deletion wasn't requested, reject it
 * 3. If "--- /dev/null" (create-file patch) is used when file already exists, reject it
 * 4. If "+++ /dev/null" (delete-file patch) is used when file does not exist, reject it
 * 
 * @param diffContent - The unified diff content to check
 * @param repoPath - Path to the git repository
 * @param userPrompt - The original user prompt (to check if deletion was requested)
 * @returns ValidationResult with ok status and any errors found
 */
export function performPreApplySanityChecks(
  diffContent: string,
  repoPath: string,
  userPrompt: string
): ValidationResult {
  const errors: string[] = [];
  
  // Parse file blocks from the diff
  const fileBlocks = parseDiffFileBlocks(diffContent);
  
  // Check each file block
  for (const block of fileBlocks) {
    // Check 1: "new file mode" for existing files
    if (block.isNewFile) {
      const fullPath = path.join(repoPath, block.filePath);
      if (fs.existsSync(fullPath)) {
        errors.push(
          `Rejecting diff: attempted to create existing file '${block.filePath}' ` +
          `(line ${block.lineNumber}). File already exists in the worktree. ` +
          `Generate a diff that modifies the existing file instead of creating it.`
        );
      }
    }
    
    // Check 2: "deleted file mode" without user requesting deletion
    if (block.isDeletedFile) {
      // Check if user prompt contains deletion-related keywords
      const deletionKeywords = [
        'delete',
        'remove',
        'drop',
        'eliminate',
        'get rid of',
        'take out',
        'rm ',
        'unlink'
      ];
      
      const promptLower = userPrompt.toLowerCase();
      const hasDeletionIntent = deletionKeywords.some(keyword => 
        promptLower.includes(keyword.toLowerCase())
      );
      
      if (!hasDeletionIntent) {
        errors.push(
          `Rejecting diff: attempted to delete file '${block.filePath}' ` +
          `(line ${block.lineNumber}), but the user prompt did not request file deletion. ` +
          `Do not delete files unless explicitly requested.`
        );
      }
    }
    
    // Check 3: --- /dev/null (creating file) when file already exists
    if (block.hasDevNullSource) {
      const fullPath = path.join(repoPath, block.filePath);
      if (fs.existsSync(fullPath)) {
        errors.push(
          `Rejecting diff: patch uses '--- /dev/null' for file '${block.filePath}' ` +
          `(line ${block.lineNumber}), but the file already exists in the worktree. ` +
          `Generate a diff that modifies the existing file instead of creating it.`
        );
      }
    }
    
    // Check 4: +++ /dev/null (deleting file) when file does not exist
    if (block.hasDevNullTarget) {
      const fullPath = path.join(repoPath, block.filePath);
      if (!fs.existsSync(fullPath)) {
        errors.push(
          `Rejecting diff: patch uses '+++ /dev/null' for file '${block.filePath}' ` +
          `(line ${block.lineNumber}), but the file does not exist in the worktree. ` +
          `Cannot delete a non-existent file.`
        );
      }
    }
  }
  
  return {
    ok: errors.length === 0,
    errors
  };
}
