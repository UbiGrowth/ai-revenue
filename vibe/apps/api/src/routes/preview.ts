import { Router, Response } from 'express';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import net from 'net';
import { requireTenantHeader, AuthRequest } from '../auth';
import { storage } from '../storage';

const router = Router();

const PREVIEWS_BASE_DIR = process.env.PREVIEWS_DIR || '/data/previews';

// ── In-memory registry of live preview processes ────────────────────────────

interface PreviewEntry {
  port: number;
  url: string;
  status: 'building' | 'ready' | 'error';
  error?: string;
  process: ChildProcess | null;
}

const previews = new Map<string, PreviewEntry>();

// ── Helpers ─────────────────────────────────────────────────────────────────

function findFreePort(min = 4000, max = 4999): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      if (port > max) {
        return reject(new Error('No free port available in range 4000–4999'));
      }
      const server = net.createServer();
      server.once('error', () => tryPort(port + 1));
      server.once('listening', () => {
        server.close(() => resolve(port));
      });
      server.listen(port);
    };
    tryPort(min);
  });
}

function killPreview(projectId: string): void {
  const entry = previews.get(projectId);
  if (!entry) return;
  if (entry.process && !entry.process.killed) {
    entry.process.kill('SIGTERM');
  }
  previews.delete(projectId);
}

// ── POST /api/preview/:projectId ─────────────────────────────────────────────

router.post('/:projectId', requireTenantHeader(), async (req: AuthRequest, res: Response) => {
  const { projectId } = req.params;
  const tenantId = req.tenantId!;

  const project = storage.getProject(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.tenant_id !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Kill any existing preview for this project
  killPreview(projectId);

  let port: number;
  try {
    port = await findFreePort();
  } catch (err: any) {
    return res.status(503).json({ error: err.message });
  }

  const distDir = path.join(PREVIEWS_BASE_DIR, projectId);
  const url = `http://localhost:${port}`;

  const entry: PreviewEntry = {
    port,
    url,
    status: 'building',
    process: null,
  };
  previews.set(projectId, entry);

  // Build then serve
  const buildProc = spawn('npm', ['run', 'build'], {
    cwd: project.local_path,
    shell: true,
    stdio: 'pipe',
  });

  buildProc.once('exit', (code) => {
    const current = previews.get(projectId);
    if (!current) return; // already killed

    if (code !== 0) {
      current.status = 'error';
      current.error = `Build exited with code ${code}`;
      current.process = null;
      return;
    }

    // Serve dist/ via npx serve
    const serveProc = spawn(
      'npx',
      ['serve', distDir, '--listen', String(port), '--no-clipboard', '--single'],
      { shell: true, stdio: 'pipe' },
    );

    current.status = 'ready';
    current.process = serveProc;

    serveProc.once('exit', () => {
      const e = previews.get(projectId);
      if (e && e.process === serveProc) {
        previews.delete(projectId);
      }
    });
  });

  buildProc.once('error', (err) => {
    const current = previews.get(projectId);
    if (current) {
      current.status = 'error';
      current.error = err.message;
      current.process = null;
    }
  });

  entry.process = buildProc;

  res.status(202).json({ projectId, status: 'building', url });
});

// ── GET /api/preview/:projectId/status ───────────────────────────────────────

router.get('/:projectId/status', requireTenantHeader(), (req: AuthRequest, res: Response) => {
  const { projectId } = req.params;
  const tenantId = req.tenantId!;

  const project = storage.getProject(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.tenant_id !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const entry = previews.get(projectId);
  if (!entry) {
    return res.json({ projectId, status: 'none' });
  }

  res.json({
    projectId,
    status: entry.status,
    url: entry.url,
    ...(entry.error ? { error: entry.error } : {}),
  });
});

// ── DELETE /api/preview/:projectId ───────────────────────────────────────────

router.delete('/:projectId', requireTenantHeader(), (req: AuthRequest, res: Response) => {
  const { projectId } = req.params;
  const tenantId = req.tenantId!;

  const project = storage.getProject(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.tenant_id !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  killPreview(projectId);
  res.json({ projectId, message: 'Preview stopped' });
});

export { killPreview };
export default router;
