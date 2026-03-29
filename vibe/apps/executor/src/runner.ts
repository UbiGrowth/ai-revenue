import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { gatherContext } from './context';
import { generateDiff } from './llm';
import { pushBranchAndOpenPR } from './github';
import { LogEmitter } from './logs';

const execAsync = promisify(exec);

export interface Job {
  id: string;
  prompt: string;
  project: {
    id: string;
    local_path: string | null;
    repository_url: string | null;
    github_repo?: string; // e.g. "owner/repo"
    base_branch?: string; // e.g. "main" or "master"
  };
}

export const MAX_ITERATIONS = 6;
const PREFLIGHT_TIMEOUT = parseInt(process.env.PREFLIGHT_TIMEOUT || '300000', 10); // 5 minutes

/**
 * Helper function to reset working tree to clean state
 */
async function resetWorkingTree(sandboxDir: string): Promise<void> {
  await execAsync(`git -C "${sandboxDir}" reset HEAD~1`);
  await execAsync(`git -C "${sandboxDir}" checkout -- .`);
}

export async function runJob(job: Job, log: LogEmitter): Promise<void> {
  const { prompt, project } = job;

  // ── 1. Resolve working directory ──────────────────────────────────────────
  const sandboxDir = await fs.mkdtemp(path.join(os.tmpdir(), `vibe-${job.id}-`));

  try {
    if (project.repository_url) {
      log.emit(`Cloning ${project.repository_url}...`);
      await execAsync(`git clone "${project.repository_url}" "${sandboxDir}"`);
    } else if (project.local_path) {
      log.emit(`Copying local project from ${project.local_path}...`);
      await fs.cp(project.local_path, sandboxDir, { recursive: true });
    } else {
      throw new Error('Project has no repository_url or local_path');
    }

    // ── 2. Create feature branch ───────────────────────────────────────────
    const branchName = `vibe/${job.id}`;
    await execAsync(`git -C "${sandboxDir}" checkout -b "${branchName}"`);
    log.emit(`Created branch: ${branchName}`);

    // ── 3. Gather context ─────────────────────────────────────────────────
    log.emit('Gathering code context...');
    const context = await gatherContext(sandboxDir, prompt);
    log.emit(`Context: ${Object.keys(context.files).length} files`);

    // ── 4. Iteration loop ─────────────────────────────────────────────────
    let previousError: string | undefined;

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      log.emit(`\n── Iteration ${iteration}/${MAX_ITERATIONS} ──`);

      // 4a. Generate diff
      log.emit('Calling LLM...');
      const result = await generateDiff(prompt, context, previousError);

      if (result.diff === 'NO_CHANGES') {
        log.emit('LLM determined no changes needed.');
        return;
      }

      // 4b. Write diff to temp file and apply
      const diffPath = path.join(sandboxDir, '.vibe.patch');
      const diffContent = typeof result.diff === 'string' ? result.diff : (result.diff as any).content || '';
      await fs.writeFile(diffPath, diffContent, 'utf8');

      log.emit('Applying diff...');
      try {
        await execAsync(`git -C "${sandboxDir}" apply --index "${diffPath}"`);
      } catch (applyErr: any) {
        log.emit(`git apply failed:\n${applyErr.stderr}`);
        previousError = `git apply failed: ${applyErr.stderr}`;
        // reset working tree before next iteration
        await execAsync(`git -C "${sandboxDir}" checkout -- .`);
        continue;
      }

      // 4c. Commit
      await execAsync(
        `git -C "${sandboxDir}" commit -m "vibe: ${prompt.slice(0, 72)}"`
      );

      // 4d. Preflight (CI-parity checks)
      log.emit('Running preflight checks...');
      const preflightError = await runPreflight(sandboxDir, log);

      if (!preflightError) {
        log.emit('✅ Preflight passed!');
        break; // success — exit loop
      }

      log.emit(`❌ Preflight failed:\n${preflightError}`);
      previousError = preflightError;

      // Undo commit + reset for next iteration
      await resetWorkingTree(sandboxDir);

      if (iteration === MAX_ITERATIONS) {
        throw new Error(`Preflight still failing after ${MAX_ITERATIONS} iterations:\n${preflightError}`);
      }
    }

    // ── 5. Push branch + open PR ──────────────────────────────────────────
    if (project.github_repo) {
      log.emit('Pushing branch and opening PR...');
      const baseBranch = project.base_branch || 'main';
      const prUrl = await pushBranchAndOpenPR(sandboxDir, branchName, prompt, project.github_repo, baseBranch, log);
      log.emit(`🎉 PR opened: ${prUrl}`);
    } else {
      // Local-only: copy results back
      log.emit('No GitHub repo configured — writing changes to local_path only.');
      await fs.cp(sandboxDir, project.local_path!, { recursive: true });
    }

  } finally {
    // Cleanup sandbox
    await fs.rm(sandboxDir, { recursive: true, force: true });
  }
}

async function runPreflight(repoDir: string, log: LogEmitter): Promise<string | null> {
  const checks: Array<{ name: string; cmd: string }> = [
    { name: 'install',    cmd: 'npm ci --prefer-offline' },
    { name: 'typecheck',  cmd: 'npx tsc --noEmit' },
    { name: 'lint',       cmd: 'npx eslint . --max-warnings=0' },
    { name: 'test',       cmd: 'npm test -- --passWithNoTests' },
  ];

  for (const check of checks) {
    log.emit(`  Running ${check.name}...`);
    try {
      // Use longer timeout for install, shorter for other checks
      const timeout = check.name === 'install' ? PREFLIGHT_TIMEOUT : 120_000;
      await execAsync(check.cmd, { cwd: repoDir, timeout });
    } catch (err: any) {
      return `${check.name} failed:\n${err.stdout ?? ''}\n${err.stderr ?? ''}`;
    }
  }

  return null; // all passed
}
