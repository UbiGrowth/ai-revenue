import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import simpleGit from 'simple-git';
import { storage } from '../storage';
import { generateDiff } from '../llm-router';
import { buildContext, formatContext } from '../context-builder';
import {
  sanitizeUnifiedDiff,
  extractDiff,
  validateUnifiedDiffEnhanced,
  validateDiffApplicability,
} from '../diff-validator';

const execAsync = promisify(exec);

export interface QaAgentResult {
  success: boolean;
  testOutput: string;
}

export async function runQaAgent(taskId: string, repoPath: string): Promise<QaAgentResult> {
  storage.logEvent(taskId, '[QA] Starting QA agent', 'info');

  // Discover changed source files from last commit
  const git = simpleGit(repoPath);
  let changedFiles: string[] = [];
  try {
    // git.diff() returns a string with file names (one per line)
    const diffString = await git.diff(['HEAD~1', 'HEAD', '--name-only']);
    changedFiles = diffString
      .split('\n')
      .map((f: string) => f.trim())
      .filter((f: string) => f.length > 0 && !f.match(/\.(test|spec)\.(ts|js)x?$/));
    storage.logEvent(taskId, `[QA] Changed source files: ${changedFiles.join(', ')}`, 'info');
  } catch (err: any) {
    storage.logEvent(taskId, `[QA] Could not get changed files: ${err.message}`, 'warning');
  }

  if (changedFiles.length === 0) {
    storage.logEvent(taskId, '[QA] No changed source files detected, skipping test generation', 'warning');
    return { success: true, testOutput: 'No changed source files' };
  }

  // Build context focused on changed files
  const contextResult = await buildContext(repoPath, `Generate tests for changed files: ${changedFiles.join(', ')}`);
  const context = formatContext(contextResult.files);

  const prompt = `Generate a test file for the following changed source files: ${changedFiles.join(', ')}.

Requirements:
- Use ONLY the Node.js built-in test runner (node:test module)
- Import: import { describe, it, before, after } from 'node:test'
- Import: import assert from 'node:assert'
- Do NOT use Jest, Mocha, or any third-party test framework
- Place the test file alongside the first changed source file with a .test.ts extension
- Output a unified diff that creates or updates the appropriate test file`;

  storage.logEvent(taskId, '[QA] Calling LLM to generate test diff...', 'info');

  let testDiff: string;
  try {
    const result = await generateDiff(prompt, context, { model: 'claude', taskId });
    testDiff = result.diff;
    storage.logEvent(taskId, `[QA] LLM generated test diff (${testDiff.length} chars)`, 'info');
  } catch (err: any) {
    storage.logEvent(taskId, `[QA] LLM call failed: ${err.message}`, 'error');
    return { success: false, testOutput: `LLM error: ${err.message}` };
  }

  if (!testDiff || testDiff === 'NO_CHANGES') {
    storage.logEvent(taskId, '[QA] LLM produced no test diff, skipping', 'warning');
    return { success: true, testOutput: 'LLM indicated no test changes needed' };
  }

  // Validate and apply test diff
  const sanitized = sanitizeUnifiedDiff(testDiff);
  if (!sanitized) {
    storage.logEvent(taskId, '[QA] Test diff failed sanitization, skipping', 'warning');
    return { success: true, testOutput: 'Test diff sanitization failed' };
  }

  const diff = extractDiff(sanitized);
  const validation = validateUnifiedDiffEnhanced(diff);
  if (!validation.ok) {
    storage.logEvent(taskId, `[QA] Test diff validation failed: ${validation.errors.join('; ')}`, 'warning');
    return { success: true, testOutput: `Test diff validation failed: ${validation.errors.join('; ')}` };
  }

  const applicability = validateDiffApplicability(diff, repoPath);
  if (!applicability.valid) {
    storage.logEvent(taskId, `[QA] Test diff not applicable: ${applicability.error}`, 'warning');
    return { success: true, testOutput: `Test diff not applicable: ${applicability.error}` };
  }

  const patchPath = path.join(repoPath, '.vibe-qa.patch');
  try {
    fs.writeFileSync(patchPath, diff, 'utf-8');
    await simpleGit(repoPath).raw(['apply', '--verbose', '.vibe-qa.patch']);
    storage.logEvent(taskId, '[QA] Test diff applied successfully', 'success');
  } catch (err: any) {
    storage.logEvent(taskId, `[QA] Failed to apply test diff: ${err.message}`, 'warning');
    return { success: true, testOutput: `Failed to apply test diff: ${err.message}` };
  } finally {
    try { if (fs.existsSync(patchPath)) fs.unlinkSync(patchPath); } catch { /* ignore cleanup errors */ }
  }

  // Run npm test and capture pass/fail + output
  storage.logEvent(taskId, '[QA] Running npm test...', 'info');
  try {
    const { stdout, stderr } = await execAsync('npm test', {
      cwd: repoPath,
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const output = (stdout + stderr).slice(0, 3000);
    storage.logEvent(taskId, `[QA] Tests passed:\n${output}`, 'success');
    return { success: true, testOutput: output };
  } catch (err: any) {
    const output = ((err.stdout || '') + (err.stderr || '')).slice(0, 3000);
    storage.logEvent(taskId, `[QA] Tests failed:\n${output}`, 'error');
    return { success: false, testOutput: output };
  }
}
