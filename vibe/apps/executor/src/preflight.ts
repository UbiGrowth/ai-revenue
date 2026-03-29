import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const PREFLIGHT_TIMEOUT = parseInt(process.env.PREFLIGHT_TIMEOUT || '300000', 10);

export interface PreflightStage {
  name: string;
  command: string;
  timeout: number;
}

export interface PreflightResult {
  success: boolean;
  stage: string;
  output: string;
  error?: string;
}

// Define the 4-stage preflight pipeline (only stages with configured commands)
export function getPreflightStages(): PreflightStage[] {
  const stages: PreflightStage[] = [];

  if (process.env.LINT_COMMAND && process.env.LINT_COMMAND.trim()) {
    stages.push({
      name: 'lint',
      command: process.env.LINT_COMMAND,
      timeout: PREFLIGHT_TIMEOUT
    });
  }

  if (process.env.TYPECHECK_COMMAND && process.env.TYPECHECK_COMMAND.trim()) {
    stages.push({
      name: 'typecheck',
      command: process.env.TYPECHECK_COMMAND,
      timeout: PREFLIGHT_TIMEOUT
    });
  }

  if (process.env.TEST_COMMAND && process.env.TEST_COMMAND.trim()) {
    stages.push({
      name: 'test',
      command: process.env.TEST_COMMAND,
      timeout: PREFLIGHT_TIMEOUT
    });
  }

  if (process.env.SMOKE_COMMAND && process.env.SMOKE_COMMAND.trim()) {
    stages.push({
      name: 'smoke',
      command: process.env.SMOKE_COMMAND,
      timeout: PREFLIGHT_TIMEOUT
    });
  }

  return stages;
}

// Run preflight checks (fail-fast)
export async function runPreflightChecks(
  repoPath: string,
  onProgress: (stage: string, output: string) => void
): Promise<PreflightResult> {
  const stages = getPreflightStages();

  // If no stages configured, skip preflight entirely
  if (stages.length === 0) {
    onProgress('preflight', 'No preflight checks configured - skipping');
    return {
      success: true,
      stage: 'skipped',
      output: 'No preflight checks configured'
    };
  }

  for (const stage of stages) {
    onProgress(stage.name, `Starting ${stage.name} check...`);

    try {
      const { stdout, stderr } = await execAsync(stage.command, {
        cwd: repoPath,
        timeout: stage.timeout,
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });

      const output = stdout + stderr;
      onProgress(stage.name, output);
      onProgress(stage.name, `✓ ${stage.name} passed`);

    } catch (error: any) {
      // Command failed or timed out
      const output = (error.stdout || '') + (error.stderr || '');
      const errorMsg = error.killed
        ? `Timeout after ${stage.timeout}ms`
        : `Exit code ${error.code ?? 'unknown'}`;

      onProgress(stage.name, output);
      onProgress(stage.name, `✗ ${stage.name} failed: ${errorMsg}`);

      return {
        success: false,
        stage: stage.name,
        output,
        error: errorMsg
      };
    }
  }

  // All stages passed
  return {
    success: true,
    stage: 'all',
    output: 'All preflight checks passed'
  };
}

// Docker-based preflight (future enhancement - for now, run commands directly)
export async function runDockerPreflight(
  repoPath: string,
  onProgress: (stage: string, output: string) => void
): Promise<PreflightResult> {
  // For now, just run commands directly
  // In production, would run each stage in a Docker container
  return runPreflightChecks(repoPath, onProgress);
}