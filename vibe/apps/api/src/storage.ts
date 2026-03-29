import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import dotenv from 'dotenv';
import { runMigrations } from './migrations';

// Load .env from the repository root (go up from apps/api/src to root)
const envPath = path.join(__dirname, '../../../.env');
dotenv.config({ path: envPath });

const storePath = process.env.DATABASE_PATH || path.join(__dirname, '../../../data/vibe.db');
const storeDir = path.dirname(storePath);

if (!fs.existsSync(storeDir)) {
  fs.mkdirSync(storeDir, { recursive: true });
}

const vibeDb = new Database(storePath);

// Run migrations (creates all tables and applies schema changes)
runMigrations(vibeDb);

// Boot-time schema guard: ensure repository_url column exists before preparing statements
const columns = vibeDb.pragma('table_info(vibe_projects)') as { name: string }[];
if (!columns.some(col => col.name === 'repository_url')) {
  vibeDb.exec('ALTER TABLE vibe_projects ADD COLUMN repository_url TEXT');
  console.log('[Migrations] Added missing column vibe_projects.repository_url');
}

// Lifecycle states as defined in requirements
export type ExecutionState = 
  | 'queued'
  | 'cloning'
  | 'building_context'
  | 'calling_llm'
  | 'applying_diff'
  | 'running_preflight'
  | 'creating_pr'
  | 'completed'
  | 'failed';

export type EventSeverity = 'info' | 'error' | 'success' | 'warning';

export interface Project {
  id: string;
  name: string;
  repository_url: string | null;
  local_path: string;
  last_synced?: number;
  created_at: number;
  published_url?: string;
  published_at?: number;
  published_job_id?: string;
  tenant_id?: string;
}

export interface VibeTask {
  task_id: string;
  user_prompt: string;
  project_id?: string;
  repository_url?: string;
  source_branch: string;
  destination_branch: string;
  execution_state: ExecutionState;
  pull_request_link?: string;
  preview_url?: string;
  iteration_count: number;
  initiated_at: number;
  last_modified: number;
  tenant_id?: string;
  llm_model?: string;
}

export interface VibeEvent {
  event_id: number;
  task_id: string;
  event_message: string;
  severity: EventSeverity;
  event_time: number;
}

class VibeStorage {
  // EventEmitters for real-time log streaming
  private logEmitters = new Map<string, EventEmitter>();

  // Project statements
  private projectInsert = vibeDb.prepare(`
    INSERT INTO vibe_projects (id, name, repository_url, local_path, created_at, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  private projectSelect = vibeDb.prepare(`SELECT * FROM vibe_projects WHERE id = ?`);
  private projectSelectByName = vibeDb.prepare(`SELECT * FROM vibe_projects WHERE name = ?`);
  private projectsList = vibeDb.prepare(`SELECT * FROM vibe_projects WHERE tenant_id = ? ORDER BY created_at DESC`);
  
  private projectUpdateSync = vibeDb.prepare(`
    UPDATE vibe_projects 
    SET last_synced = ? 
    WHERE id = ?
  `);

  private projectDelete = vibeDb.prepare(`DELETE FROM vibe_projects WHERE id = ?`);

  // Task statements - updated to support project_id
  private taskInsert = vibeDb.prepare(`
    INSERT INTO vibe_tasks (
      task_id, user_prompt, project_id, repository_url, source_branch,
      destination_branch, execution_state, iteration_count,
      initiated_at, last_modified, tenant_id, llm_model
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  private taskSelect = vibeDb.prepare(`SELECT * FROM vibe_tasks WHERE task_id = ?`);
  
  private taskStateUpdate = vibeDb.prepare(`
    UPDATE vibe_tasks 
    SET execution_state = ?, last_modified = ? 
    WHERE task_id = ?
  `);
  
  private taskIterationIncrement = vibeDb.prepare(`
    UPDATE vibe_tasks 
    SET iteration_count = iteration_count + 1, last_modified = ? 
    WHERE task_id = ?
  `);
  
  private taskPrUpdate = vibeDb.prepare(`
    UPDATE vibe_tasks 
    SET pull_request_link = ?, last_modified = ? 
    WHERE task_id = ?
  `);

  private taskPreviewUpdate = vibeDb.prepare(`
    UPDATE vibe_tasks 
    SET preview_url = ?, last_modified = ? 
    WHERE task_id = ?
  `);
  
  private tasksRecent = vibeDb.prepare(`
    SELECT * FROM vibe_tasks 
    WHERE tenant_id = ?
    ORDER BY initiated_at DESC 
    LIMIT 100
  `);

  private tasksQueued = vibeDb.prepare(`
    SELECT * FROM vibe_tasks 
    WHERE execution_state = 'queued' AND tenant_id = ?
    ORDER BY initiated_at ASC
  `);

  private tasksByProject = vibeDb.prepare(`
    SELECT * FROM vibe_tasks 
    WHERE project_id = ? 
    ORDER BY initiated_at DESC 
    LIMIT ?
  `);

  private eventInsert = vibeDb.prepare(`
    INSERT INTO vibe_events (task_id, event_message, severity, event_time)
    VALUES (?, ?, ?, ?)
  `);
  
  private eventsForTask = vibeDb.prepare(`
    SELECT * FROM vibe_events 
    WHERE task_id = ? 
    ORDER BY event_time ASC
  `);
  
  private eventsAfterTime = vibeDb.prepare(`
    SELECT * FROM vibe_events 
    WHERE task_id = ? AND event_time > ? 
    ORDER BY event_time ASC
  `);

  // Task methods
  createTask(task: Omit<VibeTask, 'iteration_count'>): void {
    this.taskInsert.run(
      task.task_id,
      task.user_prompt,
      task.project_id || null,
      task.repository_url || null,
      task.source_branch,
      task.destination_branch,
      task.execution_state,
      0, // iteration_count starts at 0
      task.initiated_at,
      task.last_modified,
      task.tenant_id || null,
      task.llm_model || 'claude'
    );
  }

  getTask(taskId: string): VibeTask | undefined {
    return this.taskSelect.get(taskId) as VibeTask | undefined;
  }

  updateTaskState(taskId: string, newState: ExecutionState): void {
    this.taskStateUpdate.run(newState, Date.now(), taskId);
    
    // Clean up EventEmitter for terminal states if no active listeners
    if (newState === 'completed' || newState === 'failed') {
      const emitter = this.logEmitters.get(taskId);
      if (emitter && emitter.listenerCount('log') === 0) {
        this.removeLogEmitter(taskId);
      }
    }
  }

  incrementIteration(taskId: string): void {
    this.taskIterationIncrement.run(Date.now(), taskId);
  }

  setPrUrl(taskId: string, prUrl: string): void {
    this.taskPrUpdate.run(prUrl, Date.now(), taskId);
  }

  setPreviewUrl(taskId: string, previewUrl: string): void {
    this.taskPreviewUpdate.run(previewUrl, Date.now(), taskId);
  }

  listRecentTasks(tenantId: string): VibeTask[] {
    return this.tasksRecent.all(tenantId) as VibeTask[];
  }

  getQueuedTasks(tenantId: string): VibeTask[] {
    return this.tasksQueued.all(tenantId) as VibeTask[];
  }

  listTasksByProject(projectId: string, limit: number = 20): VibeTask[] {
    return this.tasksByProject.all(projectId, limit) as VibeTask[];
  }

  logEvent(taskId: string, message: string, severity: EventSeverity): void {
    const eventTime = Date.now();
    const event = {
      task_id: taskId,
      event_message: message,
      severity,
      event_time: eventTime
    };
    this.eventInsert.run(taskId, message, severity, eventTime);
    
    // Emit the event in real-time to any listeners
    const emitter = this.logEmitters.get(taskId);
    if (emitter) {
      emitter.emit('log', event);
    }
  }

  getTaskEvents(taskId: string): VibeEvent[] {
    return this.eventsForTask.all(taskId) as VibeEvent[];
  }

  getEventsAfter(taskId: string, afterTime: number): VibeEvent[] {
    return this.eventsAfterTime.all(taskId, afterTime) as VibeEvent[];
  }

  // Get or create an EventEmitter for a task's log stream
  getLogEmitter(taskId: string): EventEmitter {
    let emitter = this.logEmitters.get(taskId);
    if (!emitter) {
      emitter = new EventEmitter();
      this.logEmitters.set(taskId, emitter);
    }
    return emitter;
  }

  // Clean up EventEmitter when no longer needed
  removeLogEmitter(taskId: string): void {
    const emitter = this.logEmitters.get(taskId);
    if (emitter) {
      emitter.removeAllListeners();
      this.logEmitters.delete(taskId);
    }
  }

  // Project management methods
  createProject(project: Omit<Project, 'last_synced'>): void {
    this.projectInsert.run(
      project.id,
      project.name,
      project.repository_url,
      project.local_path,
      project.created_at,
      project.tenant_id || null
    );
  }

  getProject(projectId: string): Project | undefined {
    return this.projectSelect.get(projectId) as Project | undefined;
  }

  getProjectByName(name: string): Project | undefined {
    return this.projectSelectByName.get(name) as Project | undefined;
  }

  listProjects(tenantId: string): Project[] {
    return this.projectsList.all(tenantId) as Project[];
  }

  updateProjectSync(projectId: string): void {
    this.projectUpdateSync.run(Date.now(), projectId);
  }

  deleteProject(projectId: string): void {
    // Cascade manually: events → tasks → supabase_connections → project
    const taskIds = (vibeDb.prepare(`SELECT task_id FROM vibe_tasks WHERE project_id = ?`).all(projectId) as { task_id: string }[])
      .map(r => r.task_id);
    for (const taskId of taskIds) {
      vibeDb.prepare(`DELETE FROM vibe_events WHERE task_id = ?`).run(taskId);
    }
    vibeDb.prepare(`DELETE FROM vibe_tasks WHERE project_id = ?`).run(projectId);
    vibeDb.prepare(`DELETE FROM vibe_supabase_connections WHERE project_id = ?`).run(projectId);
    this.projectDelete.run(projectId);
  }

  publishProject(projectId: string, jobId: string, publishedUrl: string): void {
    vibeDb.prepare(`
      UPDATE vibe_projects 
      SET published_url = ?, published_at = ?, published_job_id = ? 
      WHERE id = ?
    `).run(publishedUrl, Date.now(), jobId, projectId);
  }

  // ── User / Auth methods ──

  createUser(id: string, email: string, passwordHash: string, name: string): void {
    vibeDb.prepare(
      'INSERT INTO vibe_users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, email, passwordHash, name, Date.now());
  }

  getUserByEmail(email: string): { id: string; email: string; password_hash: string; name: string } | undefined {
    return vibeDb.prepare('SELECT id, email, password_hash, name FROM vibe_users WHERE email = ?').get(email) as any;
  }

  getUserById(id: string): { id: string; email: string; name: string } | undefined {
    return vibeDb.prepare('SELECT id, email, name FROM vibe_users WHERE id = ?').get(id) as any;
  }

  createAuthToken(token: string, userId: string, expiresAt: number): void {
    vibeDb.prepare(
      'INSERT INTO vibe_auth_tokens (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run(token, userId, Date.now(), expiresAt);
  }

  lookupAuthToken(token: string): { user_id: string; email: string; expires_at: number } | undefined {
    return vibeDb.prepare(`
      SELECT t.user_id, u.email, t.expires_at
      FROM vibe_auth_tokens t JOIN vibe_users u ON t.user_id = u.id
      WHERE t.token = ?
    `).get(token) as any;
  }

  deleteAuthToken(token: string): void {
    vibeDb.prepare('DELETE FROM vibe_auth_tokens WHERE token = ?').run(token);
  }

  // ── Workspace methods ──

  createWorkspace(id: string, name: string, ownerId: string): void {
    const now = Date.now();
    vibeDb.prepare(
      'INSERT INTO vibe_workspaces (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)'
    ).run(id, name, ownerId, now);
    vibeDb.prepare(
      'INSERT INTO vibe_workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'
    ).run(id, ownerId, 'owner', now);
  }

  getWorkspace(id: string): { id: string; name: string; owner_id: string; created_at: number } | undefined {
    return vibeDb.prepare('SELECT * FROM vibe_workspaces WHERE id = ?').get(id) as any;
  }

  listWorkspacesForUser(userId: string): { id: string; name: string; role: string }[] {
    return vibeDb.prepare(`
      SELECT w.id, w.name, m.role
      FROM vibe_workspaces w JOIN vibe_workspace_members m ON w.id = m.workspace_id
      WHERE m.user_id = ?
      ORDER BY w.created_at DESC
    `).all(userId) as any[];
  }

  addWorkspaceMember(workspaceId: string, userId: string, role: string = 'member'): void {
    vibeDb.prepare(
      'INSERT OR IGNORE INTO vibe_workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'
    ).run(workspaceId, userId, role, Date.now());
  }

  listProjectsByWorkspace(workspaceId: string): Project[] {
    return vibeDb.prepare(
      'SELECT * FROM vibe_projects WHERE workspace_id = ? ORDER BY created_at DESC'
    ).all(workspaceId) as Project[];
  }

  setProjectWorkspace(projectId: string, workspaceId: string): void {
    vibeDb.prepare('UPDATE vibe_projects SET workspace_id = ? WHERE id = ?').run(workspaceId, projectId);
  }

  // ── Diff storage ──

  setTaskDiff(taskId: string, diff: string): void {
    vibeDb.prepare('UPDATE vibe_tasks SET last_diff = ?, last_modified = ? WHERE task_id = ?').run(diff, Date.now(), taskId);
  }

  getTaskDiff(taskId: string): string | undefined {
    const row = vibeDb.prepare('SELECT last_diff FROM vibe_tasks WHERE task_id = ?').get(taskId) as any;
    return row?.last_diff || undefined;
  }

  // ── Analytics ──

  getAnalyticsOverview(): {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalProjects: number;
    avgIterations: number;
  } {
    const total = (vibeDb.prepare('SELECT COUNT(*) as c FROM vibe_tasks').get() as any).c;
    const completed = (vibeDb.prepare("SELECT COUNT(*) as c FROM vibe_tasks WHERE execution_state = 'completed'").get() as any).c;
    const failed = (vibeDb.prepare("SELECT COUNT(*) as c FROM vibe_tasks WHERE execution_state = 'failed'").get() as any).c;
    const projects = (vibeDb.prepare('SELECT COUNT(*) as c FROM vibe_projects').get() as any).c;
    const avgIter = (vibeDb.prepare('SELECT AVG(iteration_count) as a FROM vibe_tasks').get() as any).a || 0;
    return { totalJobs: total, completedJobs: completed, failedJobs: failed, totalProjects: projects, avgIterations: Math.round(avgIter * 10) / 10 };
  }

  // ── Billing ──

  /** Cost per million tokens (USD) keyed by llm_model value. */
  private static readonly MODEL_RATES: Record<string, { input: number; output: number }> = {
    claude: { input: 3.0, output: 15.0 },
    gpt:    { input: 10.0, output: 30.0 },
  };

  private static costUsd(model: string, promptTokens: number, completionTokens: number): number {
    const rates = VibeStorage.MODEL_RATES[model] ?? VibeStorage.MODEL_RATES.claude;
    return (promptTokens / 1_000_000) * rates.input + (completionTokens / 1_000_000) * rates.output;
  }

  /**
   * Aggregate billing usage for a tenant, grouped by date + model.
   * Only returns rows with token data.
   */
  getBillingUsage(tenantId: string): {
    date: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    job_count: number;
  }[] {
    const rows = vibeDb.prepare(`
      SELECT
        date(initiated_at / 1000, 'unixepoch') AS date,
        COALESCE(llm_model, 'claude')           AS model,
        SUM(COALESCE(llm_prompt_tokens, 0))     AS input_tokens,
        SUM(COALESCE(llm_completion_tokens, 0)) AS output_tokens,
        COUNT(*)                                AS job_count
      FROM vibe_tasks
      WHERE tenant_id = ?
        AND (llm_prompt_tokens IS NOT NULL OR llm_completion_tokens IS NOT NULL)
      GROUP BY date, model
      ORDER BY date DESC, model
    `).all(tenantId) as any[];

    return rows.map((r) => ({
      date: r.date,
      model: r.model,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      cost_usd: VibeStorage.costUsd(r.model, r.input_tokens, r.output_tokens),
      job_count: r.job_count,
    }));
  }

  /**
   * Return raw per-task billing rows for CSV export. Never crosses tenant boundary.
   */
  getBillingExport(tenantId: string): {
    task_id: string;
    initiated_at: number;
    llm_model: string;
    llm_prompt_tokens: number;
    llm_completion_tokens: number;
  }[] {
    return vibeDb.prepare(`
      SELECT task_id, initiated_at,
             COALESCE(llm_model, 'claude')           AS llm_model,
             COALESCE(llm_prompt_tokens, 0)          AS llm_prompt_tokens,
             COALESCE(llm_completion_tokens, 0)      AS llm_completion_tokens
      FROM vibe_tasks
      WHERE tenant_id = ?
        AND (llm_prompt_tokens IS NOT NULL OR llm_completion_tokens IS NOT NULL)
      ORDER BY initiated_at DESC
    `).all(tenantId) as any[];
  }

  /** Return total spend (USD) for the tenant across all time. */
  getTenantSpend(tenantId: string): number {
    const rows = vibeDb.prepare(`
      SELECT COALESCE(llm_model, 'claude') AS model,
             SUM(COALESCE(llm_prompt_tokens, 0))     AS pt,
             SUM(COALESCE(llm_completion_tokens, 0)) AS ct
      FROM vibe_tasks
      WHERE tenant_id = ?
      GROUP BY model
    `).all(tenantId) as any[];
    return rows.reduce((acc, r) => acc + VibeStorage.costUsd(r.model, r.pt, r.ct), 0);
  }

  /** Get the budget limit for a tenant, or null if none is set. */
  getTenantBudget(tenantId: string): number | null {
    const row = vibeDb.prepare('SELECT limit_usd FROM vibe_tenant_budgets WHERE tenant_id = ?').get(tenantId) as any;
    return row ? row.limit_usd : null;
  }

  /** Upsert a spend ceiling for a tenant. */
  setTenantBudget(tenantId: string, limitUsd: number): void {
    vibeDb.prepare(`
      INSERT INTO vibe_tenant_budgets (tenant_id, limit_usd, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(tenant_id) DO UPDATE SET limit_usd = excluded.limit_usd, updated_at = excluded.updated_at
    `).run(tenantId, limitUsd, Date.now());
  }

  getNextQueuedTask(): VibeTask | undefined {
    const tasks = vibeDb.prepare("SELECT * FROM vibe_tasks WHERE execution_state = 'queued' ORDER BY initiated_at ASC").all() as VibeTask[];
    return tasks.length > 0 ? tasks[0] : undefined;
  }

  // Usage metrics update methods
  updateTaskUsageMetrics(taskId: string, metrics: {
    llm_prompt_tokens?: number;
    llm_completion_tokens?: number;
    llm_total_tokens?: number;
    preflight_seconds?: number;
    total_job_seconds?: number;
    files_changed_count?: number;
  }): void {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (metrics.llm_prompt_tokens !== undefined) {
      updates.push('llm_prompt_tokens = ?');
      values.push(metrics.llm_prompt_tokens);
    }
    if (metrics.llm_completion_tokens !== undefined) {
      updates.push('llm_completion_tokens = ?');
      values.push(metrics.llm_completion_tokens);
    }
    if (metrics.llm_total_tokens !== undefined) {
      updates.push('llm_total_tokens = ?');
      values.push(metrics.llm_total_tokens);
    }
    if (metrics.preflight_seconds !== undefined) {
      updates.push('preflight_seconds = ?');
      values.push(metrics.preflight_seconds);
    }
    if (metrics.total_job_seconds !== undefined) {
      updates.push('total_job_seconds = ?');
      values.push(metrics.total_job_seconds);
    }
    if (metrics.files_changed_count !== undefined) {
      updates.push('files_changed_count = ?');
      values.push(metrics.files_changed_count);
    }
    
    if (updates.length > 0) {
      updates.push('last_modified = ?');
      values.push(Date.now());
      values.push(taskId);
      
      const sql = `UPDATE vibe_tasks SET ${updates.join(', ')} WHERE task_id = ?`;
      vibeDb.prepare(sql).run(...values);
    }
  }
}

export const storage = new VibeStorage();
export default vibeDb;
