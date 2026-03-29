import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
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

export interface UxAgentResult {
  passed: string[];
  failed: string[];
  fixed: string[];
}

const UX_CHECK_SYSTEM = `You are a UX code reviewer. Analyze the provided codebase context and evaluate these four areas:

1. Responsive breakpoints — Are mobile/tablet/desktop breakpoints properly implemented using media queries or responsive utility classes?
2. Empty states — Are empty states handled with appropriate UI (messages, placeholders, or illustrations) for lists and async data?
3. Loading states — Are loading/skeleton/spinner states implemented for async operations and data fetches?
4. Consistent spacing — Is spacing consistent, using a design system, CSS variables, or utility classes (e.g., Tailwind)?

Respond ONLY with a JSON object — no markdown, no prose, no code fences:
{"passed": ["description of each passing check"], "failed": ["description of each failing check"]}`;

export async function runUxAgent(taskId: string, repoPath: string): Promise<UxAgentResult> {
  storage.logEvent(taskId, '[UX] Starting UX agent', 'info');

  const contextResult = await buildContext(repoPath, 'UX review: responsive breakpoints, empty states, loading states, consistent spacing');
  const context = formatContext(contextResult.files);

  // Structured JSON check via direct Anthropic call (not diff-only llm-router)
  let report: { passed: string[]; failed: string[] };
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: UX_CHECK_SYSTEM,
      messages: [{ role: 'user', content: context }],
    });
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');
    report = JSON.parse(text);
    if (!Array.isArray(report.passed) || !Array.isArray(report.failed)) {
      throw new Error('Unexpected JSON shape from LLM');
    }
  } catch (err: any) {
    storage.logEvent(taskId, `[UX] LLM check failed: ${err.message}`, 'error');
    return { passed: [], failed: [], fixed: [] };
  }

  storage.logEvent(taskId, `[UX] Report: ${report.passed.length} passed, ${report.failed.length} failed`, 'info');
  for (const p of report.passed) {
    storage.logEvent(taskId, `[UX] PASS: ${p}`, 'success');
  }
  for (const f of report.failed) {
    storage.logEvent(taskId, `[UX] FAIL: ${f}`, 'warning');
  }

  if (report.failed.length === 0) {
    storage.logEvent(taskId, '[UX] All UX checks passed', 'success');
    return { passed: report.passed, failed: [], fixed: [] };
  }

  // Auto-fix failed items via llm-router (unified diff only)
  const fixPrompt = `Fix the following UX issues found in the codebase:\n${report.failed.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nGenerate a unified diff that addresses each issue.`;

  const fixed: string[] = [];
  try {
    const result = await generateDiff(fixPrompt, context, { model: 'claude', taskId });
    const fixDiff = result.diff;

    if (!fixDiff || fixDiff === 'NO_CHANGES') {
      storage.logEvent(taskId, '[UX] LLM produced no fix diff', 'warning');
      return { passed: report.passed, failed: report.failed, fixed: [] };
    }

    const sanitized = sanitizeUnifiedDiff(fixDiff);
    if (!sanitized) {
      storage.logEvent(taskId, '[UX] Fix diff failed sanitization, skipping', 'warning');
      return { passed: report.passed, failed: report.failed, fixed: [] };
    }

    const diff = extractDiff(sanitized);
    const validation = validateUnifiedDiffEnhanced(diff);
    if (!validation.ok) {
      storage.logEvent(taskId, `[UX] Fix diff validation failed: ${validation.errors.join('; ')}`, 'warning');
      return { passed: report.passed, failed: report.failed, fixed: [] };
    }

    const applicability = validateDiffApplicability(diff, repoPath);
    if (!applicability.valid) {
      storage.logEvent(taskId, `[UX] Fix diff not applicable: ${applicability.error}`, 'warning');
      return { passed: report.passed, failed: report.failed, fixed: [] };
    }

    const patchPath = path.join(repoPath, '.vibe-ux.patch');
    try {
      fs.writeFileSync(patchPath, diff, 'utf-8');
      await simpleGit(repoPath).raw(['apply', '--verbose', '.vibe-ux.patch']);
      storage.logEvent(taskId, '[UX] Fix diff applied successfully', 'success');
      fixed.push(...report.failed);
    } catch (err: any) {
      storage.logEvent(taskId, `[UX] Failed to apply fix diff: ${err.message}`, 'warning');
    } finally {
      try { if (fs.existsSync(patchPath)) fs.unlinkSync(patchPath); } catch { /* ignore cleanup errors */ }
    }
  } catch (err: any) {
    storage.logEvent(taskId, `[UX] Fix LLM call failed: ${err.message}`, 'error');
  }

  const stillFailed = report.failed.filter((f) => !fixed.includes(f));
  return { passed: report.passed, failed: stillFailed, fixed };
}
