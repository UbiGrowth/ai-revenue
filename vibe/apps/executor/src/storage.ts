import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const storePath = process.env.DATABASE_PATH || path.join(__dirname, '../../../data/vibe.db');
const storeDir = path.dirname(storePath);

if (!fs.existsSync(storeDir)) {
  fs.mkdirSync(storeDir, { recursive: true });
}

const vibeDb = new Database(storePath);

// Initialize VIBE storage schema with defined lifecycle states
vibeDb.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    repository_url TEXT NOT NULL,
    local_path TEXT NOT NULL,
    last_synced INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vibe_tasks (
    task_id TEXT PRIMARY KEY,
    user_prompt TEXT NOT NULL,
    project_id TEXT,
    repository_url TEXT,
    source_branch TEXT NOT NULL,
    destination_branch TEXT NOT NULL,
    execution_state TEXT NOT NULL,
    pull_request_link TEXT,
    iteration_count INTEGER DEFAULT 0,
    initiated_at INTEGER NOT NULL,
    last_modified INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS vibe_events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    event_message TEXT NOT NULL,
    severity TEXT NOT NULL,
    event_time INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES vibe_tasks(task_id)
  );

  CREATE INDEX IF NOT EXISTS idx_events_by_task ON vibe_events(task_id, event_time);
  CREATE INDEX IF NOT EXISTS idx_tasks_by_project ON vibe_tasks(project_id);
`);

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
  repository_url: string;
  local_path: string;
  last_synced?: number;
  created_at: number;
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
  llm_prompt_tokens?: number;
  llm_completion_tokens?: number;
  llm_total_tokens?: number;
  preflight_seconds?: number;
  total_job_seconds?: number;
  files_changed_count?: number;
}

export interface VibeEvent {
  event_id: number;
  task_id: string;
  event_message: string;
  severity: EventSeverity;
  event_time: number;
}

class ExecutorStorage {
  private taskInsert = vibeDb.prepare(`
    INSERT INTO vibe_tasks (task_id, user_prompt, project_id, repository_url, source_branch, destination_branch, execution_state, iteration_count, initiated_at, last_modified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  private projectSelect = vibeDb.prepare(`SELECT * FROM vibe_projects WHERE id = ?`);
  private projectSelectByTenant = vibeDb.prepare(`SELECT * FROM vibe_projects WHERE id = ? AND tenant_id = ?`);
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

  private taskDiffUpdate = vibeDb.prepare(`
    UPDATE vibe_tasks 
    SET last_diff = ?, last_modified = ? 
    WHERE task_id = ?
  `);

  private tasksRecent = vibeDb.prepare(`
    SELECT * FROM vibe_tasks 
    ORDER BY initiated_at DESC 
    LIMIT 100
  `);

  private tasksQueued = vibeDb.prepare(`
    SELECT * FROM vibe_tasks 
    WHERE execution_state = 'queued' 
    ORDER BY initiated_at ASC
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
      task.last_modified
    );
  }

  getTask(taskId: string): VibeTask | undefined {
    return this.taskSelect.get(taskId) as VibeTask | undefined;
  }

  updateTaskState(taskId: string, state: ExecutionState): void {
    this.taskStateUpdate.run(state, Date.now(), taskId);
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

  setTaskDiff(taskId: string, diff: string): void {
    this.taskDiffUpdate.run(diff, Date.now(), taskId);
  }

  getRecentTasks(): VibeTask[] {
    return this.tasksRecent.all() as VibeTask[];
  }

  getNextQueuedTask(): VibeTask | undefined {
    const tasks = this.tasksQueued.all() as VibeTask[];
    return tasks.length > 0 ? tasks[0] : undefined;
  }

  getProject(projectId: string, tenantId?: string): Project | undefined {
    if (tenantId) {
      return this.projectSelectByTenant.get(projectId, tenantId) as Project | undefined;
    }
    return this.projectSelect.get(projectId) as Project | undefined;
  }

  // Event methods
  logEvent(taskId: string, message: string, severity: EventSeverity): void {
    this.eventInsert.run(taskId, message, severity, Date.now());
    console.log(`[${severity.toUpperCase()}] ${taskId}: ${message}`);
  }

  getEventsForTask(taskId: string): VibeEvent[] {
    return this.eventsForTask.all(taskId) as VibeEvent[];
  }

  getEventsAfterTime(taskId: string, afterTime: number): VibeEvent[] {
    return this.eventsAfterTime.all(taskId, afterTime) as VibeEvent[];
  }

  // Usage metrics update method
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

export const storage = new ExecutorStorage();