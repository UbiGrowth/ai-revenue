import dotenv from 'dotenv';
import { storage, VibeTask } from './storage';
import simpleGit, { SimpleGit, RemoteWithRefs } from 'simple-git';
import { buildContext, formatContext } from './context-builder';
import { extractDiff, sanitizeUnifiedDiff, validateUnifiedDiffEnhanced, validateDiffApplicability, performPreApplySanityChecks } from './diff-validator';
import { runPreflightChecks } from './preflight';
import { createGitHubPr } from './github-client';
import { buildCredentialedUrl } from './git-url';
import { generateDiff as routerGenerateDiff } from './llm-router';
import { runQaAgent } from './agents/qa-agent';
import { runDebugAgent } from './agents/debug-agent';
import { runUxAgent } from './agents/ux-agent';
import { runSecurityAgent } from './agents/security-agent';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

dotenv.config();

const MAX_ITERATIONS = parseInt(process.env.MAX_ITERATIONS || '6', 10);
const POLL_INTERVAL = parseInt(process.env.EXECUTOR_POLL_INTERVAL || '5000', 10);
const GIT_TERMINAL_PROMPT_DISABLED = "0";
const REPOS_BASE_DIR = process.env.REPOS_BASE_DIR || '/data/repos';
const WORKTREES_BASE_DIR = process.env.WORKTREES_BASE_DIR || '/data/worktrees';
const PATCHES_DIR = process.env.PATCHES_DIR || '/data/patches';
const JOBS_DIR = process.env.JOBS_DIR || '/data/jobs';
const PREVIEWS_DIR = process.env.PREVIEWS_DIR || '/data/previews';
const BUILD_COMMAND = process.env.BUILD_COMMAND || 'npm run build';

interface GenerateDiffResult {
  diff: string | null;
  error: string | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

class VibeExecutor {
  private processing = false;

  constructor() {
    this.initializeDirectories();
  }

  private initializeDirectories(): void {
    // Ensure required directories exist
    for (const dir of [REPOS_BASE_DIR, WORKTREES_BASE_DIR, PATCHES_DIR, JOBS_DIR, PREVIEWS_DIR]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  async start(): Promise<void> {
    console.log('VIBE Executor started');
    console.log(`Max iterations: ${MAX_ITERATIONS}`);
    console.log(`Poll interval: ${POLL_INTERVAL}ms`);

    setInterval(async () => {
      if (!this.processing) {
        await this.processNextTask();
      }
    }, POLL_INTERVAL);

    await this.processNextTask();
  }

  private async processNextTask(): Promise<void> {
    try {
      const task = storage.getNextQueuedTask();
      if (!task) return;

      this.processing = true;
      storage.logEvent(task.task_id, `Starting execution for task ${task.task_id}`, 'info');
      await this.executeTask(task);
    } catch (error: any) {
      console.error('Error processing task:', error);
    } finally {
      this.processing = false;
    }
  }

  private async executeTask(task: VibeTask): Promise<void> {
    const jobStartTime = Date.now();
    let repoDir: string = '';
    let repoUrl: string | null = null;
    let isProjectMode = false;
    let baseWorkDir: string = path.join(os.tmpdir(), '.vibe', 'work', task.task_id);
    let worktreeDir: string = '';
    let mainGit: SimpleGit | null = null;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalPreflightSeconds = 0;

    try {
      // ── Mode detection ──────────────────────────────────────────────────────
      // Re-fetch the task from DB to ensure we have the latest project_id and tenant_id
      const freshTask = storage.getTask(task.task_id) ?? task;
      const projectId = freshTask.project_id ?? task.project_id;
      const tenantId = freshTask.tenant_id ?? task.tenant_id;

      if (projectId) {
        // OPTION A: Project-centric mode — use cached repo
        isProjectMode = true;
        // Use project_id from DB and scope by tenant_id when available
        const project = storage.getProject(projectId, tenantId);

        if (!project) {
          throw new Error(`Project not found: ${projectId}`);
        }

        repoDir = project.local_path;
        repoUrl = project.repository_url ?? null;

        storage.logEvent(task.task_id, `Using project: ${project.name} (${projectId})`, 'info');
        storage.logEvent(task.task_id, `Project cache location: ${repoDir}`, 'info');

        // Clone if project cache doesn't exist yet
        if (!fs.existsSync(repoDir)) {
          if (!repoUrl) {
            // No remote URL — initialize empty local repo
            storage.logEvent(task.task_id, 'No repo_source set — initializing local repo', 'info');
            fs.mkdirSync(repoDir, { recursive: true });
            await simpleGit(repoDir).init();
            await simpleGit(repoDir).addConfig('user.name', process.env.GIT_AUTHOR_NAME || 'VIBE Bot');
            await simpleGit(repoDir).addConfig('user.email', process.env.GIT_AUTHOR_EMAIL || 'vibe@example.com');
            await simpleGit(repoDir).commit('Initial empty commit', { '--allow-empty': null });
          } else {
            storage.logEvent(task.task_id, `Project cache not initialized. Cloning ${repoUrl}...`, 'info');
            storage.updateTaskState(task.task_id, 'cloning');

            const reposDir = path.dirname(repoDir);
            if (!fs.existsSync(reposDir)) {
              fs.mkdirSync(reposDir, { recursive: true });
            }

            const cloneUrl = buildCredentialedUrl(repoUrl);
            if (!cloneUrl) throw new Error(`Could not build clone URL from: ${repoUrl}`);

            const originalGitPrompt = process.env.GIT_TERMINAL_PROMPT;
            process.env.GIT_TERMINAL_PROMPT = GIT_TERMINAL_PROMPT_DISABLED;
            try {
              await simpleGit().clone(cloneUrl, repoDir);
            } finally {
              if (originalGitPrompt !== undefined) {
                process.env.GIT_TERMINAL_PROMPT = originalGitPrompt;
              } else {
                delete process.env.GIT_TERMINAL_PROMPT;
              }
            }
            storage.logEvent(task.task_id, 'Repository cloned to project cache', 'success');
          }
        } else {
          // Cache exists — sync with remote if we have one
          if (repoUrl) {
            storage.logEvent(task.task_id, 'Syncing project cache with remote...', 'info');
            const syncGit = simpleGit(repoDir);
            try {
              await syncGit.fetch(['--all', '--prune']);
              storage.logEvent(task.task_id, 'Project cache synced', 'success');
            } catch (error: any) {
              storage.logEvent(task.task_id, `Warning: Failed to sync: ${error.message}`, 'warning');
            }
          } else {
            storage.logEvent(task.task_id, 'Using existing local project (no remote sync)', 'info');
          }
        }

      } else if (task.repository_url) {
        // MODE B: Legacy mode — clone to temp directory
        isProjectMode = false;
        repoUrl = task.repository_url;
        storage.logEvent(task.task_id, '[DEPRECATED] Using legacy Mode B with repo_url', 'warning');

        repoDir = path.join(baseWorkDir, 'repo');

        if (!fs.existsSync(baseWorkDir)) {
          fs.mkdirSync(baseWorkDir, { recursive: true });
        }

        storage.updateTaskState(task.task_id, 'cloning');
        storage.logEvent(task.task_id, `Cloning repository: ${repoUrl}`, 'info');

        const cloneUrl = buildCredentialedUrl(repoUrl);
        if (!cloneUrl) throw new Error(`Could not build clone URL from: ${repoUrl}`);

        const originalGitPrompt = process.env.GIT_TERMINAL_PROMPT;
        process.env.GIT_TERMINAL_PROMPT = GIT_TERMINAL_PROMPT_DISABLED;
        try {
          await simpleGit().clone(cloneUrl, repoDir);
        } finally {
          if (originalGitPrompt !== undefined) {
            process.env.GIT_TERMINAL_PROMPT = originalGitPrompt;
          } else {
            delete process.env.GIT_TERMINAL_PROMPT;
          }
        }
        storage.logEvent(task.task_id, 'Clone completed', 'success');

      } else {
        throw new Error('Task has neither project_id nor repository_url');
      }

      // ── Directory diagnostics ────────────────────────────────────────────
      try {
        const files = fs.readdirSync(repoDir);
        const fileCount = files.length;
        const preview = files.slice(0, 10).join(', ');
        const logMsg = fileCount <= 10
          ? `Directory listing (${fileCount} items): ${preview}`
          : `Directory listing (${fileCount} items, showing first 10): ${preview}...`;
        storage.logEvent(task.task_id, logMsg, 'info');
      } catch (e: any) {
        storage.logEvent(task.task_id, `Could not list repoDir: ${e.message}`, 'warning');
      }

      // ── Git setup ────────────────────────────────────────────────────────
      mainGit = simpleGit(repoDir);
      await mainGit.addConfig('user.name', process.env.GIT_AUTHOR_NAME || 'VIBE Bot');
      await mainGit.addConfig('user.email', process.env.GIT_AUTHOR_EMAIL || 'vibe@example.com');

      await mainGit.checkout(task.source_branch);
      storage.logEvent(task.task_id, `Checked out base branch: ${task.source_branch}`, 'info');

      try {
        await mainGit.checkoutBranch(task.destination_branch, task.source_branch);
        storage.logEvent(task.task_id, `Created target branch: ${task.destination_branch}`, 'info');
      } catch {
        await mainGit.checkout(task.destination_branch);
        storage.logEvent(task.task_id, `Using existing branch: ${task.destination_branch}`, 'info');
      }

      // worktreeDir = repoDir for now (worktree isolation can be added later)
      worktreeDir = repoDir;

      const usageMetrics = {
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalPreflightSeconds: 0,
      };

      await this.iterationLoop(task, baseWorkDir, repoDir, worktreeDir, mainGit, repoUrl, usageMetrics);

      // Calculate final job duration and store usage metrics
      const totalJobSeconds = (Date.now() - jobStartTime) / 1000;
      
      // Count files changed by comparing branches
      let filesChangedCount = 0;
      try {
        const diffSummary = await mainGit.diffSummary([task.source_branch, task.destination_branch]);
        filesChangedCount = diffSummary.files.length;
      } catch (error: any) {
        storage.logEvent(task.task_id, `Could not count changed files: ${error.message}`, 'warning');
      }
      
      storage.updateTaskUsageMetrics(task.task_id, {
        llm_prompt_tokens: usageMetrics.totalPromptTokens,
        llm_completion_tokens: usageMetrics.totalCompletionTokens,
        llm_total_tokens: usageMetrics.totalTokens,
        preflight_seconds: usageMetrics.totalPreflightSeconds,
        total_job_seconds: totalJobSeconds,
        files_changed_count: filesChangedCount,
      });
      
      storage.logEvent(
        task.task_id,
        `Usage: ${usageMetrics.totalTokens} tokens, ${usageMetrics.totalPreflightSeconds.toFixed(1)}s preflight, ${totalJobSeconds.toFixed(1)}s total, ${filesChangedCount} files`,
        'info'
      );

    } catch (error: any) {
      storage.updateTaskState(task.task_id, 'failed');
      storage.logEvent(task.task_id, `Fatal error: ${error.message}`, 'error');
      
      // Still try to record usage metrics even on failure
      const totalJobSeconds = (Date.now() - jobStartTime) / 1000;
      storage.updateTaskUsageMetrics(task.task_id, {
        llm_prompt_tokens: totalPromptTokens,
        llm_completion_tokens: totalCompletionTokens,
        llm_total_tokens: totalTokens,
        preflight_seconds: totalPreflightSeconds,
        total_job_seconds: totalJobSeconds,
      });
    } finally {
      if (!isProjectMode) {
        if (fs.existsSync(baseWorkDir)) {
          fs.rmSync(baseWorkDir, { recursive: true, force: true });
        }
      } else {
        if (fs.existsSync(baseWorkDir)) {
          try {
            const entries = fs.readdirSync(baseWorkDir).filter(n => n.startsWith('attempt-'));
            for (const dir of entries) {
              fs.rmSync(path.join(baseWorkDir, dir), { recursive: true, force: true });
            }
            fs.rmSync(baseWorkDir, { recursive: true, force: true });
          } catch {
            // ignore cleanup errors
          }
        }
      }
    }
  }

  private async iterationLoop(
    task: VibeTask,
    baseWorkDir: string,
    repoDir: string,
    worktreeDir: string,
    mainGit: SimpleGit,
    repoUrl: string | null,
    usageMetrics: {
      totalPromptTokens: number;
      totalCompletionTokens: number;
      totalTokens: number;
      totalPreflightSeconds: number;
    }
  ): Promise<void> {
    let consecutiveApplyFailures = 0;
    let consecutiveDiffFailures = 0;
    let fallbackFiles: Set<string> = new Set();
    let globalFallback = false;
    let failureFeedback: string | null = null;

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      storage.incrementIteration(task.task_id);
      storage.logEvent(task.task_id, `Starting iteration ${iteration}/${MAX_ITERATIONS}`, 'info');

      const worktreeGit = simpleGit(worktreeDir);
      try {
        await worktreeGit.reset(['--hard', 'HEAD']);
        await worktreeGit.raw(['clean', '-fd']);
        storage.logEvent(task.task_id, 'Worktree reset to clean state', 'info');
      } catch (error: any) {
        storage.logEvent(task.task_id, `Warning: Failed to reset worktree: ${error.message}`, 'warning');
      }

      storage.updateTaskState(task.task_id, 'building_context');
      storage.logEvent(task.task_id, 'Building context from repository...', 'info');

      const contextResult = await buildContext(worktreeDir, task.user_prompt);
      storage.logEvent(
        task.task_id,
        `Context built: ${contextResult.files.size} files, ${contextResult.totalSize} chars${contextResult.truncated ? ' (truncated)' : ''}`,
        'info'
      );

      const context = formatContext(contextResult.files);

      storage.updateTaskState(task.task_id, 'calling_llm');
      storage.logEvent(task.task_id, `Calling LLM (iteration ${iteration})...`, 'info');

      const result = await this.generateDiff(
        task.user_prompt, context, task.task_id, worktreeDir,
        globalFallback, fallbackFiles, failureFeedback,
        (task.llm_model as 'claude' | 'gpt') || 'claude'
      );

      // Accumulate LLM token usage
      if (result.usage) {
        usageMetrics.totalPromptTokens += result.usage.input_tokens;
        usageMetrics.totalCompletionTokens += result.usage.output_tokens;
        usageMetrics.totalTokens += result.usage.total_tokens;
      }

      if (!result.diff) {
        consecutiveDiffFailures++;
        storage.logEvent(task.task_id, 'LLM failed to generate valid diff', 'error');
        if (result.error) {
          failureFeedback = `You returned an invalid diff. Validator error: ${result.error}`;
        }
        if (consecutiveDiffFailures >= 3) {
          storage.updateTaskState(task.task_id, 'failed');
          storage.logEvent(task.task_id, 'Failed: 3 consecutive invalid diffs from LLM', 'error');
          return;
        }
        continue;
      }

      consecutiveDiffFailures = 0;
      if (failureFeedback && failureFeedback.includes('Validator error')) {
        failureFeedback = null;
      }

      const diff = result.diff;

      if (diff === 'NO_CHANGES') {
        storage.logEvent(task.task_id, 'No changes needed - skipping git apply', 'info');
        storage.updateTaskState(task.task_id, 'running_preflight');

        const preflightStartTime = Date.now();
        const preflightResult = await runPreflightChecks(worktreeDir, (stage, output) => {
          storage.logEvent(task.task_id, `[${stage}] ${output}`, 'info');
        });
        const preflightDuration = (Date.now() - preflightStartTime) / 1000;
        usageMetrics.totalPreflightSeconds += preflightDuration;

        if (preflightResult.success) {
          storage.logEvent(task.task_id, '✓ All preflight checks passed!', 'success');

          const buildPassed = await this.runBuildWithAgents(task, worktreeDir);
          if (!buildPassed) {
            storage.updateTaskState(task.task_id, 'failed');
            storage.logEvent(task.task_id, 'Build failed after max debug attempts', 'error');
            return;
          }

          // Generate preview after successful build
          await this.generatePreview(task, worktreeDir);

          const log = await worktreeGit.log({ from: task.source_branch, to: task.destination_branch });
          const status = await worktreeGit.status();
          if (log.total === 0 && status.isClean()) {
            await this.createCheckpointTag(mainGit, task.task_id, task.destination_branch);
            storage.updateTaskState(task.task_id, 'completed');
            storage.logEvent(task.task_id, 'No changes; no PR created.', 'success');
            return;
          }
          await this.createPullRequest(task, mainGit, repoUrl);
          return;
        } else {
          storage.updateTaskState(task.task_id, 'failed');
          storage.logEvent(task.task_id, `Preflight failed at stage: ${preflightResult.stage}`, 'error');
          return;
        }
      }

      storage.updateTaskState(task.task_id, 'applying_diff');
      storage.logEvent(task.task_id, 'Applying diff to worktree...', 'info');

      const applyResult = await this.applyDiff(worktreeDir, repoDir, mainGit, diff, task.task_id, iteration);

      if (!applyResult.success) {
        consecutiveApplyFailures++;
        storage.logEvent(task.task_id, 'Failed to apply diff', 'error');
        failureFeedback = `Git apply failed: ${applyResult.error || 'Unknown error'}`;

        if (consecutiveApplyFailures >= 2) {
          const failedFiles = this.extractFailedFiles(applyResult.error || '');
          if (failedFiles.length > 0) {
            failedFiles.forEach(f => fallbackFiles.add(f));
            storage.logEvent(task.task_id, `Fallback mode: full file replacement for ${failedFiles.join(', ')}`, 'warning');
          } else {
            globalFallback = true;
            storage.logEvent(task.task_id, 'Fallback mode: global full file replacement', 'warning');
          }
        }

        if (consecutiveApplyFailures >= 3) {
          storage.updateTaskState(task.task_id, 'failed');
          storage.logEvent(task.task_id, 'Failed: 3 consecutive git apply failures', 'error');
          return;
        }
        continue;
      }

      consecutiveApplyFailures = 0;
      fallbackFiles.clear();
      globalFallback = false;
      failureFeedback = null;

      // Persist the successful diff to database and file system
      await this.persistSuccessfulDiff(diff, task.task_id);

      await worktreeGit.add('.');
      await worktreeGit.commit(`VIBE iteration ${iteration}: ${task.user_prompt.slice(0, 50)}`);
      storage.logEvent(task.task_id, `Changes committed (iteration ${iteration})`, 'success');

      storage.updateTaskState(task.task_id, 'running_preflight');
      storage.logEvent(task.task_id, 'Running preflight checks...', 'info');

      const preflightStartTime = Date.now();
      const preflightResult = await runPreflightChecks(worktreeDir, (stage, output) => {
        storage.logEvent(task.task_id, `[${stage}] ${output}`, 'info');
      });
      const preflightDuration = (Date.now() - preflightStartTime) / 1000;
      usageMetrics.totalPreflightSeconds += preflightDuration;

      if (preflightResult.success) {
        storage.logEvent(task.task_id, '✓ All preflight checks passed!', 'success');

        const buildPassed = await this.runBuildWithAgents(task, worktreeDir);
        if (!buildPassed) {
          storage.updateTaskState(task.task_id, 'failed');
          storage.logEvent(task.task_id, 'Build failed after max debug attempts', 'error');
          return;
        }

        // Generate preview after successful build
        await this.generatePreview(task, worktreeDir);

        await this.createPullRequest(task, mainGit, repoUrl);
        return;
      } else {
        storage.logEvent(task.task_id, `Preflight failed at stage: ${preflightResult.stage}`, 'error');
        if (iteration === MAX_ITERATIONS) {
          storage.updateTaskState(task.task_id, 'failed');
          storage.logEvent(task.task_id, 'Failed: Max iterations reached without passing preflight', 'error');
          return;
        }
        storage.logEvent(task.task_id, `Will retry (${iteration}/${MAX_ITERATIONS})`, 'warning');
      }
    }

    storage.updateTaskState(task.task_id, 'failed');
    storage.logEvent(task.task_id, 'Failed: Max iterations reached', 'error');
  }

  private buildReadmeContext(prompt: string, repoDir: string): string | null {
    if (!prompt.toLowerCase().includes('readme')) return null;

    const readmePaths = ['README.md', 'readme.md', 'README', 'apps/web/README.md'];
    for (const readmePath of readmePaths) {
      const fullPath = path.join(repoDir, readmePath);
      if (fs.existsSync(fullPath)) {
        try {
          const lines = fs.readFileSync(fullPath, 'utf-8').split('\n').slice(0, 60).join('\n');
          return `\n---\nREADME FILE CONTEXT:\n- Existing file: ${readmePath}\n- DO NOT create ${readmePath}. It already exists.\n- Generate a MODIFY diff (not new file diff).\n- Must start with "--- a/${readmePath}"\n\nCurrent content (first 60 lines):\n${lines}\n---`;
        } catch { continue; }
      }
    }
    return null;
  }

  private async generateDiff(
    prompt: string,
    context: string,
    taskId: string,
    repoDir: string,
    globalFallback: boolean = false,
    fallbackFiles: Set<string> = new Set(),
    failureFeedback: string | null = null,
    model: 'claude' | 'gpt' = 'claude'
  ): Promise<GenerateDiffResult> {
    const maxRetries = 2;
    let lastValidationError: string | null = null;
    const readmeContext = this.buildReadmeContext(prompt, repoDir);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        storage.logEvent(taskId, `Retrying LLM call (attempt ${attempt + 1}/${maxRetries + 1})...`, 'warning');
      }

      try {
        // Build enriched context: repo files + readme + fallback instructions
        let enrichedContext = context;
        if (readmeContext) {
          enrichedContext += readmeContext;
          storage.logEvent(taskId, 'Added README-specific context to LLM prompt', 'info');
        }
        if (globalFallback || fallbackFiles.size > 0) {
          const fallbackInstructions = `\n- Delete all lines of the old file and add all lines of the new file`;
          if (fallbackFiles.size > 0) {
            enrichedContext += `\n\n---\n\nFALLBACK MODE for files: ${Array.from(fallbackFiles).join(', ')}\nGenerate diffs that REPLACE THE ENTIRE FILE CONTENT:${fallbackInstructions}`;
          } else {
            enrichedContext += `\n\n---\n\nFALLBACK MODE: Generate diffs that REPLACE THE ENTIRE FILE CONTENT:${fallbackInstructions}`;
          }
        }

        // Combine all error feedback for this attempt
        const errorParts: string[] = [];
        if (failureFeedback) {
          errorParts.push(`PATCH FAILURE FEEDBACK:\n${failureFeedback}`);
        }
        if (attempt > 0 && lastValidationError) {
          errorParts.push(`VALIDATION ERROR: ${lastValidationError}\n\nPlease output a valid unified diff starting with "diff --git", including --- and +++ headers and @@ hunk markers. Or output exactly "NO_CHANGES".\n\nExample:\ndiff --git a/example.js b/example.js\n--- a/example.js\n+++ b/example.js\n@@ -1,3 +1,4 @@\n function example() {\n+  console.log('added line');\n   return true;\n }`);
        }
        const combinedError = errorParts.length > 0 ? errorParts.join('\n\n---\n\n') : undefined;

        const routerResult = await routerGenerateDiff(prompt, enrichedContext, { model, taskId }, combinedError);
        const rawOutput = routerResult.diff;
        storage.logEvent(taskId, `LLM generated ${rawOutput.length} characters`, 'info');

        if (rawOutput === 'NO_CHANGES') {
          storage.logEvent(taskId, 'LLM indicated no changes needed', 'info');
          return { diff: 'NO_CHANGES', error: null, usage: routerResult.usage };
        }

        const sanitized = sanitizeUnifiedDiff(rawOutput);
        if (sanitized === null) {
          lastValidationError = 'LLM output missing diff --git header or contains commentary/markdown';
          storage.logEvent(taskId, lastValidationError, 'error');
          continue;
        }

        const diff = extractDiff(sanitized);
        const enhancedValidation = validateUnifiedDiffEnhanced(diff);
        if (!enhancedValidation.ok) {
          lastValidationError = enhancedValidation.errors.join('; ');
          storage.logEvent(taskId, `Invalid diff: ${lastValidationError}`, 'error');
          continue;
        }

        const sanityCheck = performPreApplySanityChecks(diff, repoDir, prompt);
        if (!sanityCheck.ok) {
          lastValidationError = sanityCheck.errors.join('; ');
          storage.logEvent(taskId, `Pre-apply sanity check failed: ${lastValidationError}`, 'error');
          continue;
        }

        storage.logEvent(taskId, `Valid diff generated (${diff.split('\n').length} lines)`, 'success');
        return { diff, error: null, usage: routerResult.usage };

      } catch (error: any) {
        storage.logEvent(taskId, `LLM error: ${error.message}`, 'error');
        lastValidationError = `LLM API error: ${error.message}`;
        continue;
      }
    }

    storage.logEvent(taskId, `Failed to generate valid diff after ${maxRetries + 1} attempts`, 'error');
    return { diff: null, error: lastValidationError };
  }

  private extractFailedFiles(errorMessage: string): string[] {
    const files: string[] = [];
    const patterns = [
      /error: patch failed: ([^:]+):/g,
      /error: ([^:]+): patch does not apply/g
    ];
    for (const pattern of patterns) {
      for (const match of errorMessage.matchAll(pattern)) {
        const file = match[1].trim();
        if (file && !files.includes(file)) files.push(file);
      }
    }
    return files;
  }

  private async applyDiff(
    worktreeDir: string,
    repoDir: string,
    mainGit: SimpleGit,
    diff: string,
    taskId: string,
    iteration: number
  ): Promise<{ success: boolean; error?: string }> {
    let patch = diff.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    patch = patch.trimEnd() + '\n';

    try {
      const checkResult = validateDiffApplicability(patch, worktreeDir);
      if (!checkResult.valid) {
        storage.logEvent(taskId, `git apply --check failed: ${checkResult.error}`, 'error');
        await this.persistFailedPatch(patch, taskId, iteration);
        return { success: false, error: checkResult.error };
      }

      const worktreeGit = simpleGit(worktreeDir);
      const patchFilePath = path.join(worktreeDir, '.vibe-diff.patch');
      fs.writeFileSync(patchFilePath, patch, { encoding: 'utf-8' });

      try {
        await worktreeGit.raw(['apply', '--verbose', '.vibe-diff.patch']);
        storage.logEvent(taskId, 'Diff applied successfully', 'success');
      } catch (applyError: any) {
        const errorOutput = [applyError.message, applyError.stderr, applyError.stdout].filter(Boolean).join('\n');
        if (applyError.stderr) storage.logEvent(taskId, `git apply stderr: ${applyError.stderr}`, 'error');
        if (applyError.stdout) storage.logEvent(taskId, `git apply stdout: ${applyError.stdout}`, 'error');
        await this.persistFailedPatch(patch, taskId, iteration);
        return { success: false, error: errorOutput };
      } finally {
        if (fs.existsSync(patchFilePath)) fs.unlinkSync(patchFilePath);
      }

      return { success: true };

    } catch (error: any) {
      storage.logEvent(taskId, `Git apply failed: ${error.message}`, 'error');
      await this.persistFailedPatch(patch, taskId, iteration);
      return { success: false, error: error.message };
    }
  }

  private async persistFailedPatch(diff: string, taskId: string, iteration: number): Promise<void> {
    try {
      const patchFilePath = path.join(PATCHES_DIR, `${taskId}-iter${iteration}.diff`);
      fs.writeFileSync(patchFilePath, diff, { encoding: 'utf-8' });

      const lines = diff.split('\n');
      storage.logEvent(taskId, `[Patch] Saved to: ${patchFilePath} (${lines.length} lines, ${diff.length} chars)`, 'info');

      const preview = lines.slice(0, 80).map((l, i) => `${String(i + 1).padStart(4, ' ')}. ${l}`).join('\n');
      storage.logEvent(taskId, `[Patch] First 80 lines:\n${preview}`, 'info');
      if (lines.length > 80) storage.logEvent(taskId, `[Patch] ... (${lines.length - 80} more lines)`, 'info');

    } catch (error: any) {
      storage.logEvent(taskId, `[Patch] WARNING: Could not save failed patch: ${error.message}`, 'warning');
    }
  }

  private async persistSuccessfulDiff(diff: string, taskId: string): Promise<void> {
    try {
      // Store in SQLite database
      storage.setTaskDiff(taskId, diff);
      storage.logEvent(taskId, '✓ Diff persisted to database', 'info');

      // Also store as a file in /data/jobs/
      const diffFilePath = path.join(JOBS_DIR, `${taskId}.diff`);
      fs.writeFileSync(diffFilePath, diff, { encoding: 'utf-8' });

      const lines = diff.split('\n');
      storage.logEvent(taskId, `✓ Diff saved to: ${diffFilePath} (${lines.length} lines, ${diff.length} chars)`, 'info');

    } catch (error: any) {
      storage.logEvent(taskId, `WARNING: Could not persist diff: ${error.message}`, 'warning');
    }
  }

  private async createCheckpointTag(mainGit: SimpleGit, taskId: string, branch: string): Promise<void> {
    try {
      const tagName = `vibe/job-${taskId}`;
      await mainGit.tag([tagName, branch]);
      storage.logEvent(taskId, `✓ Created checkpoint tag: ${tagName}`, 'success');
    } catch (error: any) {
      storage.logEvent(taskId, `Warning: Failed to create checkpoint tag: ${error.message}`, 'warning');
    }
  }

  private async createPullRequest(task: VibeTask, mainGit: SimpleGit, repoUrl: string | null): Promise<void> {
    try {
      storage.updateTaskState(task.task_id, 'creating_pr');
      
      // For local-only projects (no remote), skip push and PR creation
      if (!repoUrl) {
        storage.logEvent(task.task_id, 'Local-only project - no remote push or PR creation', 'info');
        await this.createCheckpointTag(mainGit, task.task_id, task.destination_branch);
        storage.updateTaskState(task.task_id, 'completed');
        storage.logEvent(task.task_id, '✓ Task completed successfully (local changes only)', 'success');
        return;
      }
      
      storage.logEvent(task.task_id, 'Pushing branch to remote...', 'info');

      await mainGit.push('origin', task.destination_branch, ['--force']);
      storage.logEvent(task.task_id, `Branch pushed: ${task.destination_branch}`, 'success');

      // Resolve repoUrl if not passed in
      let effectiveRepoUrl = repoUrl;
      if (!effectiveRepoUrl) {
        try {
          const remotes = await mainGit.getRemotes(true);
          const origin = remotes.find(r => r.name === 'origin');
          if (origin?.refs?.fetch) {
            effectiveRepoUrl = origin.refs.fetch;
          } else {
            storage.logEvent(task.task_id, 'No remote repository configured (local-only project). Changes committed locally, PR creation skipped.', 'info');
            await this.createCheckpointTag(mainGit, task.task_id, task.destination_branch);
            storage.updateTaskState(task.task_id, 'completed');
            return;
          }
        } catch (error: any) {
          storage.logEvent(task.task_id, `Could not get remote URL: ${error.message}. Changes committed locally, PR creation skipped.`, 'warning');
          await this.createCheckpointTag(mainGit, task.task_id, task.destination_branch);
          storage.updateTaskState(task.task_id, 'completed');
          return;
        }
      }

      const prResult = await createGitHubPr({
        repoUrl: effectiveRepoUrl,
        sourceBranch: task.source_branch,
        targetBranch: task.destination_branch,
        prompt: task.user_prompt,
        taskId: task.task_id,
        iterationCount: task.iteration_count
      });

      if (prResult.success && prResult.prUrl) {
        storage.setPrUrl(task.task_id, prResult.prUrl);
        await this.createCheckpointTag(mainGit, task.task_id, task.destination_branch);
        storage.updateTaskState(task.task_id, 'completed');
        storage.logEvent(task.task_id, `✓ Pull request created: ${prResult.prUrl}`, 'success');
      } else {
        storage.updateTaskState(task.task_id, 'failed');
        storage.logEvent(task.task_id, `Failed to create PR: ${prResult.error}`, 'error');
      }

    } catch (error: any) {
      storage.updateTaskState(task.task_id, 'failed');
      storage.logEvent(task.task_id, `Error creating PR: ${error.message}`, 'error');
    }
  }

  private async runBuild(taskId: string, worktreeDir: string): Promise<{ success: boolean; output: string }> {
    storage.logEvent(taskId, `Running build: ${BUILD_COMMAND}`, 'info');
    try {
      const { stdout, stderr } = await execAsync(BUILD_COMMAND, {
        cwd: worktreeDir,
        timeout: 300000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const output = ((stdout || '') + (stderr || '')).slice(0, 2000);
      storage.logEvent(taskId, '✓ Build succeeded', 'success');
      return { success: true, output };
    } catch (err: any) {
      const output = ((err.stdout || '') + (err.stderr || '')).slice(0, 2000);
      storage.logEvent(taskId, `Build failed: ${output.slice(0, 200)}`, 'error');
      return { success: false, output };
    }
  }

  private async runBuildWithAgents(task: VibeTask, worktreeDir: string): Promise<boolean> {
    const MAX_DEBUG_ATTEMPTS = 2;

    let buildResult = await this.runBuild(task.task_id, worktreeDir);

    if (!buildResult.success) {
      for (let attempt = 1; attempt <= MAX_DEBUG_ATTEMPTS; attempt++) {
        storage.logEvent(task.task_id, `[DEBUG] Debug attempt ${attempt}/${MAX_DEBUG_ATTEMPTS}`, 'warning');
        const debugResult = await runDebugAgent(task.task_id, worktreeDir, buildResult.output);
        if (debugResult.success) {
          storage.logEvent(task.task_id, `[DEBUG] Build fixed on attempt ${attempt}`, 'success');
          buildResult = { success: true, output: debugResult.buildOutput };
          break;
        }
        buildResult = { success: false, output: debugResult.buildOutput };
      }
    }

    if (!buildResult.success) {
      return false;
    }

    await runQaAgent(task.task_id, worktreeDir);

    await runUxAgent(task.task_id, worktreeDir);

    const securityResult = await runSecurityAgent(task.task_id, worktreeDir);
    if (securityResult.blocked) {
      storage.logEvent(task.task_id, '[SECURITY] Job blocked: critical security findings must be resolved', 'error');
      return false;
    }

    return true;
  }

  private async generatePreview(task: VibeTask, worktreeDir: string): Promise<void> {
    try {
      storage.logEvent(task.task_id, 'Generating static preview...', 'info');

      // Run build command in worktree
      storage.logEvent(task.task_id, `Running build command: ${BUILD_COMMAND}`, 'info');
      
      try {
        const { stdout, stderr } = await execAsync(BUILD_COMMAND, {
          cwd: worktreeDir,
          timeout: 300000, // 5 minutes timeout
          maxBuffer: 10 * 1024 * 1024 // 10MB
        });

        if (stdout) storage.logEvent(task.task_id, `Build stdout: ${stdout.slice(0, 500)}`, 'info');
        if (stderr) storage.logEvent(task.task_id, `Build stderr: ${stderr.slice(0, 500)}`, 'info');
        
        storage.logEvent(task.task_id, '✓ Build completed successfully', 'success');
      } catch (buildError: any) {
        const errorOutput = (buildError.stdout || '') + (buildError.stderr || '');
        storage.logEvent(task.task_id, `Build failed: ${errorOutput.slice(0, 1000)}`, 'error');
        storage.logEvent(task.task_id, 'Preview generation skipped due to build failure', 'warning');
        return;
      }

      // Determine build output directory (common patterns)
      const buildDirs = ['dist', 'build', 'out', '.next', 'public'];
      let buildOutputDir: string | null = null;

      for (const dir of buildDirs) {
        const candidatePath = path.join(worktreeDir, dir);
        if (fs.existsSync(candidatePath)) {
          const stat = fs.statSync(candidatePath);
          if (stat.isDirectory()) {
            buildOutputDir = candidatePath;
            storage.logEvent(task.task_id, `Found build output directory: ${dir}`, 'info');
            break;
          }
        }
      }

      if (!buildOutputDir) {
        storage.logEvent(task.task_id, 'No build output directory found (checked: dist, build, out, .next, public)', 'warning');
        storage.logEvent(task.task_id, 'Preview generation skipped', 'warning');
        return;
      }

      // Create preview directory
      const previewDir = path.join(PREVIEWS_DIR, task.task_id);
      if (!fs.existsSync(PREVIEWS_DIR)) {
        fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
      }

      // Copy build output to preview directory
      storage.logEvent(task.task_id, `Copying build output to: ${previewDir}`, 'info');
      
      if (fs.existsSync(previewDir)) {
        fs.rmSync(previewDir, { recursive: true, force: true });
      }

      // Recursive copy
      const copyRecursive = (src: string, dest: string) => {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };

      copyRecursive(buildOutputDir, previewDir);

      // Store preview URL
      const previewUrl = `/previews/${task.task_id}/index.html`;
      storage.setPreviewUrl(task.task_id, previewUrl);
      storage.logEvent(task.task_id, `✓ Preview available at: ${previewUrl}`, 'success');

    } catch (error: any) {
      storage.logEvent(task.task_id, `Preview generation error: ${error.message}`, 'warning');
    }
  }
}

// Start the executor
const executor = new VibeExecutor();
executor.start().catch(console.error);