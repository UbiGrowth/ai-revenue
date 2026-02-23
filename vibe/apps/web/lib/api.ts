// API base URL — must be set via NEXT_PUBLIC_API_URL for browser access
const API_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:3001'

// Tenant ID — identifies the current user/workspace for multi-tenant isolation.
// For local dev this defaults to 'local'. Override via NEXT_PUBLIC_TENANT_ID.
export const TENANT_ID =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_TENANT_ID) ||
  'local'

// ── Types ──────────────────────────────────────────────────────────────────

export interface LogEvent {
  event_id: number
  event_message: string
  severity: 'info' | 'error' | 'success' | 'warning'
  event_time: number
}

export interface Project {
  id: string
  name: string
  repository_url: string
  local_path: string
  last_synced?: number
  created_at: number
}

export interface Task {
  task_id: string
  user_prompt: string
  execution_state: string
  pull_request_link?: string
  preview_url?: string
  initiated_at: number
  completed_at?: number
  iteration_count: number
  project_id?: string
  repo_url?: string
  base_branch?: string
  target_branch?: string
  llm_provider?: string
  llm_prompt_tokens?: number
  llm_completion_tokens?: number
  llm_total_tokens?: number
  preflight_seconds?: number
  total_job_seconds?: number
  files_changed_count?: number
}

export interface HealthStatus {
  status: string
  timestamp: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Base headers required by every API call */
function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Id': TENANT_ID,
    ...extra,
  }
}

/** GET headers (no Content-Type needed) */
function getHeaders(): Record<string, string> {
  return { 'X-Tenant-Id': TENANT_ID }
}

// ── Projects ───────────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  try {
    const response = await fetch(`${API_URL}/projects`, {
      headers: getHeaders(),
    })
    if (!response.ok) return []
    return response.json()
  } catch {
    return []
  }
}

export async function createProject(
  name: string,
): Promise<{ id?: string; error?: string }> {
  const response = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ name }),
  })
  return response.json()
}

export async function importGithubProject(
  repoUrl: string,
): Promise<{ id?: string; error?: string }> {
  const response = await fetch(`${API_URL}/projects/import/github`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ repo_url: repoUrl }),
  })
  return response.json()
}

export async function fetchProject(id: string): Promise<Project | null> {
  try {
    const response = await fetch(`${API_URL}/projects/${id}`, {
      headers: getHeaders(),
    })
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

export async function deleteProject(id: string): Promise<{ error?: string }> {
  const response = await fetch(`${API_URL}/projects/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  return response.json()
}

export async function fetchProjectJobs(projectId: string): Promise<Task[]> {
  try {
    const response = await fetch(`${API_URL}/projects/${projectId}/jobs`, {
      headers: getHeaders(),
    })
    if (!response.ok) return []
    return response.json()
  } catch {
    return []
  }
}

// ── Jobs ───────────────────────────────────────────────────────────────────

export async function fetchJobs(): Promise<Task[]> {
  try {
    const response = await fetch(`${API_URL}/jobs`, {
      headers: getHeaders(),
    })
    if (!response.ok) return []
    return response.json()
  } catch {
    return []
  }
}

export async function createJob(params: {
  prompt: string
  project_id: string
  base_branch: string
  target_branch?: string
  llm_provider?: string
  llm_model?: string
}): Promise<{ task_id?: string; error?: string }> {
  const response = await fetch(`${API_URL}/jobs`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify(params),
  })
  return response.json()
}

export async function fetchJob(taskId: string): Promise<Task | null> {
  try {
    const response = await fetch(`${API_URL}/jobs/${taskId}`, {
      headers: getHeaders(),
    })
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

// ── Logs (SSE) ─────────────────────────────────────────────────────────────

export function getLogsSSEUrl(taskId: string): string {
  // Pass tenant ID as query parameter since EventSource cannot send custom headers
  return `${API_URL}/jobs/${taskId}/logs?tenant_id=${encodeURIComponent(TENANT_ID)}`
}

export function subscribeToLogs(
  taskId: string,
  onLog: (log: LogEvent) => void,
  onComplete: (state: string) => void,
  onError: () => void,
): () => void {
  const eventSource = new EventSource(getLogsSSEUrl(taskId))

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'complete') {
        onComplete(data.state)
        eventSource.close()
        return
      }
      // Unwrap { log: ... } format from NestJS controller if present
      const logEntry = data.log ?? data
      onLog(logEntry)
    } catch {
      // ignore parse errors
    }
  }

  eventSource.onerror = () => {
    eventSource.close()
    onError()
  }

  return () => eventSource.close()
}

// ── Health ─────────────────────────────────────────────────────────────────

export async function fetchHealth(): Promise<HealthStatus | null> {
  try {
    const response = await fetch(`${API_URL}/health`)
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}
