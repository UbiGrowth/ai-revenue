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
const BUILD_COMMAND = process.env.BUILD_COMMAND || 'npm run build';

export interface DebugAgentResult {
  success: boolean;
  buildOutput: string;
}

export async function runDebugAgent(
  taskId: string,
  repoPath: string,
  errorLog: string
): Promise<DebugAgentResult> {
  storage.logEvent(taskId, '[DEBUG] Starting debug agent', 'info');

  // Build context with build/test logs pre-attached
  const contextResult = await buildContext(repoPath, 'Fix build and test errors');
  const context = formatContext(contextResult.files);
  const enrichedContext = `${context}\n\n---\n\nBUILD/TEST ERROR LOG:\n${errorLog.slice(0, 5000)}`;

  const prompt = `The project build or tests failed. Analyze the error log provided in context and generate a unified diff that fixes the failing build or test errors.

Rules:
- Only fix the errors shown in the log
- Do not add unrelated features or refactor code
- Do not change logic unrelated to the failures`;

  storage.logEvent(taskId, '[DEBUG] Calling LLM to generate fix diff...', 'info');

  let fixDiff: string;
  try {
    const result = await generateDiff(prompt, enrichedContext, { model: 'claude', taskId });
    fixDiff = result.diff;
    storage.logEvent(taskId, `[DEBUG] LLM generated fix diff (${fixDiff.length} chars)`, 'info');
  } catch (err: any) {
    storage.logEvent(taskId, `[DEBUG] LLM call failed: ${err.message}`, 'error');
    return { success: false, buildOutput: `LLM error: ${err.message}` };
  }

  if (!fixDiff || fixDiff === 'NO_CHANGES') {
    storage.logEvent(taskId, '[DEBUG] LLM produced no fix diff', 'warning');
    return { success: false, buildOutput: 'LLM indicated no changes needed' };
  }

  // Validate fix diff
  const sanitized = sanitizeUnifiedDiff(fixDiff);
  if (!sanitized) {
    storage.logEvent(taskId, '[DEBUG] Fix diff failed sanitization', 'error');
    return { success: false, buildOutput: 'Fix diff sanitization failed' };
  }

  const diff = extractDiff(sanitized);
  const validation = validateUnifiedDiffEnhanced(diff);
  if (!validation.ok) {
    storage.logEvent(taskId, `[DEBUG] Fix diff validation failed: ${validation.errors.join('; ')}`, 'error');
    return { success: false, buildOutput: `Fix diff validation: ${validation.errors.join('; ')}` };
  }

  const applicability = validateDiffApplicability(diff, repoPath);
  if (!applicability.valid) {
    storage.logEvent(taskId, `[DEBUG] Fix diff not applicable: ${applicability.error}`, 'error');
    return { success: false, buildOutput: `Fix diff not applicable: ${applicability.error}` };
  }

  // Apply fix diff
  const patchPath = path.join(repoPath, '.vibe-debug.patch');
  try {
    fs.writeFileSync(patchPath, diff, 'utf-8');
    await simpleGit(repoPath).raw(['apply', '--verbose', '.vibe-debug.patch']);
    storage.logEvent(taskId, '[DEBUG] Fix diff applied', 'success');
  } catch (err: any) {
    storage.logEvent(taskId, `[DEBUG] Failed to apply fix diff: ${err.message}`, 'error');
    return { success: false, buildOutput: `Failed to apply fix: ${err.message}` };
  } finally {
    try { if (fs.existsSync(patchPath)) fs.unlinkSync(patchPath); } catch { /* ignore cleanup errors */ }
  }

  // Re-run build to verify fix
  storage.logEvent(taskId, `[DEBUG] Re-running build to verify fix: ${BUILD_COMMAND}`, 'info');
  try {
    const { stdout, stderr } = await execAsync(BUILD_COMMAND, {
      cwd: repoPath,
      timeout: 300000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const output = ((stdout || '') + (stderr || '')).slice(0, 2000);
    storage.logEvent(taskId, `[DEBUG] Build succeeded after fix:\n${output}`, 'success');
    return { success: true, buildOutput: output };
  } catch (err: any) {
    const output = ((err.stdout || '') + (err.stderr || '')).slice(0, 2000);
    storage.logEvent(taskId, `[DEBUG] Build still failing after fix:\n${output}`, 'error');
    return { success: false, buildOutput: output };
  }
}
