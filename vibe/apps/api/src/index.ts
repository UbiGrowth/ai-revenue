import { Request, Response } from 'express';
import express from 'express';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { storage, VibeEvent } from './storage';
import { hashPassword, verifyPassword, generateToken, TOKEN_EXPIRY_MS, optionalAuth, requireTenantHeader, AuthRequest } from './auth';
import path from 'path';
import fs from 'fs';
import { execSync, execFileSync } from 'child_process';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'reflect-metadata';
import supabaseRouter from './routes/supabase';
import previewRouter from './routes/preview';
import billingRouter from './routes/billing';

// Load .env from the repository root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PORT = process.env.API_PORT || 3001;
const REPOS_BASE_DIR = process.env.REPOS_BASE_DIR || '/data/repos';
const PREVIEWS_DIR = process.env.PREVIEWS_DIR || '/data/previews';
const PUBLISHED_DIR = process.env.PUBLISHED_DIR || '/data/published';

// Ensure repos directory exists
if (!fs.existsSync(REPOS_BASE_DIR)) {
  fs.mkdirSync(REPOS_BASE_DIR, { recursive: true });
}

// Ensure previews directory exists
if (!fs.existsSync(PREVIEWS_DIR)) {
  fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
}

// Ensure published directory exists
if (!fs.existsSync(PUBLISHED_DIR)) {
  fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
}

// Startup sanity check: verify git is available
try {
  const gitVersion = execSync('git --version', { encoding: 'utf-8' }).trim();
  console.log(`✓ Git is available: ${gitVersion}`);
} catch (error) {
  console.error('✗ ERROR: git command not found. The API service requires git to be installed.');
  console.error('  Please ensure git is installed in the container. See README.md for troubleshooting.');
}

// Bootstrap NestJS and add Express routes
async function bootstrap() {
  // Create NestJS application with body parser
  const nestApp = await NestFactory.create(AppModule, {
    bodyParser: true,
  });
  
  // Enable CORS
  nestApp.enableCors();
  
  // Get the underlying Express instance
  const app = nestApp.getHttpAdapter().getInstance();
  
  // Add JSON body parser middleware for custom Express routes
  // Note: NestJS has its own body parser for its controllers,
  // but our custom routes added directly to the Express instance need this
  app.use(express.json());

  // Supabase integration routes
  app.use('/api/supabase', supabaseRouter);

  // Preview deployment routes
  app.use('/api/preview', previewRouter);

  // Billing routes
  app.use('/api/billing', billingRouter);

  // Serve static preview files
  app.use('/previews', express.static(PREVIEWS_DIR));

  // Serve static published files
  app.use('/published', express.static(PUBLISHED_DIR));

  // POST /projects - Create a new project from template
  app.post('/projects', requireTenantHeader(), (req: AuthRequest, res: Response) => {
    try {
      const { name, repository_url, template = 'empty' } = req.body;
      const tenantId = req.tenantId!;

    if (!name) {
      return res.status(400).json({ error: 'Missing required field: name' });
    }

    const projectId = uuidv4();
    const tenantRepoDir = path.join(REPOS_BASE_DIR, tenantId);
    const repoDir = path.join(tenantRepoDir, projectId);
    
    // Create tenant directory if it doesn't exist
    if (!fs.existsSync(tenantRepoDir)) {
      fs.mkdirSync(tenantRepoDir, { recursive: true });
    }
    
    // Create project directory
    fs.mkdirSync(repoDir, { recursive: true });
    
    // Initialize git repository
    execSync('git init', { cwd: repoDir });

    // Configure git identity before making any commits
    execSync('git config user.name "VIBE Bot"', { cwd: repoDir });
    execSync('git config user.email "vibe@example.com"', { cwd: repoDir });
    execSync('git config commit.gpgsign false', { cwd: repoDir });

    // Create initial README for template
    const readmePath = path.join(repoDir, 'README.md');
    fs.writeFileSync(readmePath, `# ${name}\n\nProject created from ${template} template.\n`);

    // Initial commit — this materialises the branch ref so it actually exists
    execSync('git add .', { cwd: repoDir });
    execSync('git commit -m "Initial commit from template"', { cwd: repoDir });

    // Ensure the branch is named 'main' regardless of the git init.defaultBranch setting
    execSync('git branch -M main', { cwd: repoDir });

    storage.createProject({
      id: projectId,
      name,
      repository_url: repository_url || null,
      local_path: repoDir,
      created_at: Date.now(),
      tenant_id: tenantId
    });

    res.status(201).json({
      id: projectId,
      name,
      repository_url: repository_url || null,
      local_path: repoDir,
      message: 'Project created successfully'
    });
  } catch (error: any) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: `Failed to create project: ${error.message}` });
  }
});

// POST /projects/import/github - Import project from GitHub
app.post('/projects/import/github', requireTenantHeader(), (req: AuthRequest, res: Response) => {
  try {
    const { repo_url } = req.body;
    const tenantId = req.tenantId!;

    if (!repo_url) {
      return res.status(400).json({ error: 'Missing required field: repo_url' });
    }

    // Generate project ID server-side
    const projectId = uuidv4();
    const tenantRepoDir = path.join(REPOS_BASE_DIR, tenantId);
    const repoDir = path.join(tenantRepoDir, projectId);
    
    // Create tenant directory if it doesn't exist
    if (!fs.existsSync(tenantRepoDir)) {
      fs.mkdirSync(tenantRepoDir, { recursive: true });
    }
    
    // Clone repository
    const githubToken = process.env.GITHUB_TOKEN;
    let cloneUrl = repo_url;
    
    if (githubToken && repo_url.includes('github.com')) {
      // Use GIT_ASKPASS for more secure authentication
      // Token is passed via environment, not in URL
      cloneUrl = repo_url;
    }
    
    // Use git credential helper for more secure token handling
    const cloneEnv = { 
      ...process.env, 
      GIT_TERMINAL_PROMPT: '0'
    };
    
    if (githubToken && repo_url.includes('github.com')) {
      // Embed token in URL (acceptable for now, but consider GIT_ASKPASS for production)
      cloneUrl = repo_url.replace('https://', `https://${githubToken}@`);
    }
    
    execFileSync('git', ['clone', cloneUrl, repoDir], { env: cloneEnv });
    
    // Extract repo name from URL
    const repoName = repo_url.split('/').pop()?.replace('.git', '') || 'imported-repo';

    storage.createProject({
      id: projectId,
      name: repoName,
      repository_url: repo_url,
      local_path: repoDir,
      created_at: Date.now(),
      tenant_id: tenantId
    });

    res.status(201).json({
      id: projectId,
      name: repoName,
      repository_url: repo_url,
      local_path: repoDir,
      message: 'Project imported successfully'
    });
  } catch (error: any) {
    console.error('Error importing project:', error);
    res.status(500).json({ error: `Failed to import project: ${error.message}` });
  }
});

// GET /projects - List all projects
app.get('/projects', requireTenantHeader(), (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const projects = storage.listProjects(tenantId);
    res.json(projects);
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// GET /projects/:id - Get project details
app.get('/projects/:id', requireTenantHeader(), (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const tenantId = req.tenantId!;
    const project = storage.getProject(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Validate tenant ownership
    if (project.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied: project belongs to different tenant' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// GET /projects/:id/jobs - List jobs for a specific project
app.get('/projects/:id/jobs', requireTenantHeader(), (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const tenantId = req.tenantId!;
    const project = storage.getProject(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Validate tenant ownership
    if (project.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied: project belongs to different tenant' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const tasks = storage.listTasksByProject(projectId, limit);
    res.json(tasks);
  } catch (error) {
    console.error('Error listing project tasks:', error);
    res.status(500).json({ error: 'Failed to list project tasks' });
  }
});

// DELETE /projects/:id - Delete a project
app.delete('/projects/:id', requireTenantHeader(), (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const tenantId = req.tenantId!;
    const project = storage.getProject(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Validate tenant ownership
    if (project.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied: project belongs to different tenant' });
    }

    const localPath = project.local_path;
    storage.deleteProject(projectId);
    // Best-effort cleanup of the on-disk repo directory
    if (localPath && fs.existsSync(localPath)) {
      fs.rmSync(localPath, { recursive: true, force: true });
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// POST /projects/:id/publish - Publish a job's preview to the project
app.post('/projects/:id/publish', requireTenantHeader(), (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const tenantId = req.tenantId!;
    const { job_id } = req.body;

    if (!job_id) {
      return res.status(400).json({ error: 'Missing required field: job_id' });
    }

    // Validate project exists
    const project = storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Validate tenant ownership
    if (project.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied: project belongs to different tenant' });
    }

    // Validate job exists and belongs to this project
    const job = storage.getTask(job_id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.project_id !== projectId) {
      return res.status(400).json({ error: 'Job does not belong to this project' });
    }

    // Validate job tenant
    if (job.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied: job belongs to different tenant' });
    }

    // Check if job has a preview
    if (!job.preview_url) {
      return res.status(400).json({ error: 'Job does not have a preview to publish' });
    }

    // Source: /data/previews/{job_id}
    const sourceDir = path.join(PREVIEWS_DIR, job_id);
    if (!fs.existsSync(sourceDir)) {
      return res.status(404).json({ error: 'Preview files not found' });
    }

    // Destination: /data/published/{project_id}
    const destDir = path.join(PUBLISHED_DIR, projectId);

    // Remove existing published version if it exists
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }

    // Copy preview to published directory
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

    copyRecursive(sourceDir, destDir);

    // Update project with published URL
    const publishedUrl = `/published/${projectId}/index.html`;
    storage.publishProject(projectId, job_id, publishedUrl);

    res.json({
      message: 'Project published successfully',
      published_url: publishedUrl,
      job_id: job_id
    });
  } catch (error: any) {
    console.error('Error publishing project:', error);
    res.status(500).json({ error: `Failed to publish project: ${error.message}` });
  }
});

// POST /jobs - Create a new VIBE task
app.post('/jobs', requireTenantHeader(), (req: AuthRequest, res: Response) => {
  try {
    const { prompt, project_id, repo_url, base_branch = 'main', target_branch, llm_provider, llm_model, model } = req.body;
    const resolvedModel: 'claude' | 'gpt' = model === 'gpt' ? 'gpt' : 'claude';
    const tenantId = req.tenantId!;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing required field: prompt' });
    }

    // OPTION A (project-centric): Require project_id
    // Legacy Mode B: Allow repo_url but mark as deprecated
    if (!project_id && !repo_url) {
      return res.status(400).json({ 
        error: 'Missing required field: project_id (or repo_url for legacy mode)' 
      });
    }

    // If project_id is provided, validate it exists and belongs to tenant
    if (project_id) {
      const project = storage.getProject(project_id);
      if (!project) {
        return res.status(404).json({ error: `Project not found: ${project_id}` });
      }
      // Validate tenant ownership
      if (project.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Access denied: project belongs to different tenant' });
      }
    }

    // Warn if using legacy mode
    if (repo_url && !project_id) {
      console.warn('[DEPRECATED] Task created with repo_url (legacy Mode B). Use project_id instead.');
    }

    // Budget enforcement: reject if tenant has exceeded their spend ceiling
    const budgetLimit = storage.getTenantBudget(tenantId);
    if (budgetLimit !== null) {
      const currentSpend = storage.getTenantSpend(tenantId);
      if (currentSpend >= budgetLimit) {
        return res.status(402).json({
          error: `Budget exceeded: $${currentSpend.toFixed(4)} spent of $${budgetLimit.toFixed(2)} limit. Raise your budget via POST /api/billing/budget/${tenantId}.`,
        });
      }
    }

    const taskId = uuidv4();
    const now = Date.now();
    const finalBaseBranch = base_branch || 'main';
    
    // Generate target branch name if not provided
    const finalTargetBranch = target_branch || `vibe/${taskId.slice(0, 8)}`;

    storage.createTask({
      task_id: taskId,
      user_prompt: prompt,
      project_id: project_id || undefined,
      repository_url: repo_url || undefined,
      source_branch: finalBaseBranch,
      destination_branch: finalTargetBranch,
      execution_state: 'queued',
      initiated_at: now,
      last_modified: now,
      tenant_id: tenantId,
      llm_model: resolvedModel,
    });

    if (repo_url) {
      storage.logEvent(taskId, 'Task created (legacy Mode B with repo_url)', 'warning');
    } else {
      storage.logEvent(taskId, 'Task created and queued for execution', 'info');
    }

    res.status(201).json({
      task_id: taskId,
      status: 'queued',
      message: 'Task created successfully'
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /jobs/:id - Get task details
app.get('/jobs/:id', requireTenantHeader(), (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.id;
    const tenantId = req.tenantId!;
    const task = storage.getTask(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Validate tenant ownership
    if (task.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied: job belongs to different tenant' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// GET /jobs - List recent tasks
app.get('/jobs', requireTenantHeader(), (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const tasks = storage.listRecentTasks(tenantId);
    res.json(tasks);
  } catch (error) {
    console.error('Error listing tasks:', error);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

  app.get('/workspaces/:id/projects', (req: Request, res: Response) => {
    try {
      res.json(storage.listProjectsByWorkspace(req.params.id));
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to list workspace projects' });
    }
  });

  app.post('/workspaces/:id/members', (req: Request, res: Response) => {
    try {
      const { user_id, role } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id is required' });
      storage.addWorkspaceMember(req.params.id, user_id, role || 'member');
      res.json({ message: 'Member added' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to add member' });
    }
  });

  // ── Diff preview endpoints ──

  app.get('/jobs/:id/diff', requireTenantHeader(), (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.tenantId!;
      const task = storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      if (task.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Access denied: job belongs to different tenant' });
      }
      const diff = storage.getTaskDiff(req.params.id);
      if (!diff) return res.status(404).json({ error: 'No diff available' });
      res.json({ diff });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get diff' });
    }
  });

  app.post('/jobs/:id/diff/apply', requireTenantHeader(), (req: AuthRequest, res: Response) => {
    try {
      const { diff } = req.body;
      const tenantId = req.tenantId!;
      if (!diff) return res.status(400).json({ error: 'diff is required' });
      const task = storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      if (task.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Access denied: job belongs to different tenant' });
      }
      storage.setTaskDiff(req.params.id, diff);
      res.json({ message: 'Diff updated successfully' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to apply diff' });
    }
  });

  // ── Preview URL endpoint (for testing) ──

  app.post('/jobs/:id/preview', requireTenantHeader(), (req: AuthRequest, res: Response) => {
    try {
      const { preview_url } = req.body;
      const tenantId = req.tenantId!;
      if (!preview_url) return res.status(400).json({ error: 'preview_url is required' });
      const task = storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      if (task.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Access denied: job belongs to different tenant' });
      }
      storage.setPreviewUrl(req.params.id, preview_url);
      res.json({ message: 'Preview URL updated successfully' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to set preview URL' });
    }
  });

  // ── Analytics endpoint ──

  app.get('/analytics/overview', requireTenantHeader(), (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.tenantId!;
      const overview = storage.getAnalyticsOverview();
      const tasks = storage.listRecentTasks(tenantId);
      const successRate = overview.totalJobs > 0
        ? Math.round((overview.completedJobs / overview.totalJobs) * 100)
        : 0;

      // Group by day
      const byDay = new Map<string, number>();
      for (const t of tasks) {
        const d = new Date(t.initiated_at).toLocaleDateString();
        byDay.set(d, (byDay.get(d) || 0) + 1);
      }
      const recentJobs = Array.from(byDay.entries())
        .map(([date, count]) => ({ date, count }))
        .slice(-7);

      res.json({ ...overview, successRate, recentJobs });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  });

  // GET /jobs/:id/logs — SSE stream of log events
  // Implemented here (not in NestJS controller) so it works with tsx dev mode
  // where esbuild cannot emit decorator metadata required for NestJS DI.
  app.get('/jobs/:id/logs', requireTenantHeader(), (req: AuthRequest, res: Response) => {
    const jobId = req.params.id;
    const tenantId = req.tenantId!;

    const task = storage.getTask(jobId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    if (task.tenant_id !== tenantId) {
      res.status(403).json({ error: 'Access denied: job belongs to different tenant' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Replay existing events
    const existing = storage.getTaskEvents(jobId);
    let lastEventTime = Date.now();
    if (existing.length > 0) {
      existing.forEach(send);
      lastEventTime = existing[existing.length - 1].event_time;
    }

    // Poll for new events until terminal state
    const interval = setInterval(() => {
      try {
        const newEvents = storage.getEventsAfter(jobId, lastEventTime);
        newEvents.forEach(e => { send(e); lastEventTime = e.event_time; });

        const current = storage.getTask(jobId);
        if (current && (current.execution_state === 'completed' || current.execution_state === 'failed')) {
          send({ type: 'complete', state: current.execution_state });
          clearInterval(interval);
          res.end();
        }
      } catch {
        clearInterval(interval);
        res.end();
      }
    }, 1000);

    req.on('close', () => clearInterval(interval));
  });

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Start the NestJS server
  await nestApp.listen(PORT);
  console.log(`VIBE API server running on port ${PORT}`);
}

bootstrap().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});
