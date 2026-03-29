import { ChildProcess, spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

const BUILD_COMMAND = process.env.BUILD_COMMAND || 'npm run build';
const BUILD_TIMEOUT = 300_000; // 5 minutes

// ── Types ────────────────────────────────────────────────────────────────────

export interface PreviewResult {
  url: string;
  port: number;
}

// ── Port allocation ──────────────────────────────────────────────────────────

function findFreePort(min = 4000, max = 4999): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      if (port > max) {
        return reject(new Error('No free port available in range 4000–4999'));
      }
      const server = net.createServer();
      server.once('error', () => tryPort(port + 1));
      server.once('listening', () => server.close(() => resolve(port)));
      server.listen(port);
    };
    tryPort(min);
  });
}

// ── Process registry ─────────────────────────────────────────────────────────

const activeServers = new Map<string, ChildProcess>();

// ── Locate the build output directory ────────────────────────────────────────

function findBuildOutputDir(worktreeDir: string): string | null {
  for (const dir of ['dist', 'build', 'out', '.next', 'public']) {
    const candidate = path.join(worktreeDir, dir);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  return null;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the project in `worktreeDir` then serve the output on an ephemeral
 * port in the range 4000–4999.  The caller MUST invoke `stopPreview(taskId)`
 * in a finally block to guarantee the port is released.
 */
export async function buildAndServePreview(
  worktreeDir: string,
  taskId: string,
): Promise<PreviewResult> {
  // Run the build
  await execAsync(BUILD_COMMAND, {
    cwd: worktreeDir,
    timeout: BUILD_TIMEOUT,
    maxBuffer: 10 * 1024 * 1024,
  });

  const distDir = findBuildOutputDir(worktreeDir);
  if (!distDir) {
    throw new Error(
      'Build succeeded but no output directory found (checked: dist, build, out, .next, public)',
    );
  }

  const port = await findFreePort();

  // Start `npx serve` on the chosen port
  const serveProc = spawn(
    'npx',
    ['serve', distDir, '--listen', String(port), '--no-clipboard', '--single'],
    { shell: true, stdio: 'pipe' },
  );

  activeServers.set(taskId, serveProc);

  serveProc.once('exit', () => {
    if (activeServers.get(taskId) === serveProc) {
      activeServers.delete(taskId);
    }
  });

  // Prevent unhandled 'error' events from crashing the process if npx/serve
  // is unavailable or the process fails to spawn.
  serveProc.once('error', (err) => {
    console.error(`[preview-builder] serve process error for task ${taskId}:`, err.message);
    activeServers.delete(taskId);
  });

  // Give the server a moment to bind before returning
  await new Promise<void>((resolve) => setTimeout(resolve, 300));

  return { url: `http://localhost:${port}`, port };
}

/**
 * Kill the serve process for `taskId`.  Safe to call even when no preview is
 * running — always call this in a finally block to prevent port leaks.
 */
export function stopPreview(taskId: string): void {
  const proc = activeServers.get(taskId);
  if (proc && !proc.killed) {
    proc.kill('SIGTERM');
  }
  activeServers.delete(taskId);
}
