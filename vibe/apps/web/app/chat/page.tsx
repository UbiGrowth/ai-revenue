"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { PromptCard } from "@/components/dashboard/prompt-card"
import { fetchJobs, fetchProjects, createProject, importGithubProject, type Task, type Project } from "@/lib/api"
import { MessageSquare, Clock, CheckCircle2, XCircle, Loader2, ExternalLink, FolderOpen, Plus, Github } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const STATE_CONFIG: Record<string, { label: string; icon: typeof Loader2; color: string }> = {
  completed: { label: "Completed", icon: CheckCircle2, color: "text-emerald-400" },
  failed: { label: "Failed", icon: XCircle, color: "text-red-400" },
  running: { label: "Running", icon: Loader2, color: "text-[#4F8EFF]" },
  queued: { label: "Queued", icon: Clock, color: "text-amber-400" },
}

function JobRow({ task }: { task: Task }) {
  const cfg = STATE_CONFIG[task.execution_state] ?? STATE_CONFIG["queued"]
  const Icon = cfg.icon
  const isRunning = task.execution_state === "running"
  const date = new Date(task.initiated_at).toLocaleString()

  return (
    <Link
      href={`/task/${task.task_id}`}
      className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-card/80 transition-all duration-200 group"
    >
      <Icon
        className={cn("w-4 h-4 flex-shrink-0", cfg.color, isRunning && "animate-spin")}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{task.user_prompt}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{date}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span
          className={cn(
            "text-[11px] font-medium px-2 py-0.5 rounded-md",
            task.execution_state === "completed" && "bg-emerald-500/10 text-emerald-400",
            task.execution_state === "failed" && "bg-red-500/10 text-red-400",
            task.execution_state === "running" && "bg-[#4F8EFF]/10 text-[#4F8EFF]",
            task.execution_state === "queued" && "bg-amber-500/10 text-amber-400",
          )}
        >
          {cfg.label}
        </span>
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  )
}

export default function ChatPage() {
  const [jobs, setJobs] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")

  // Create project dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Import GitHub dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [repoUrl, setRepoUrl] = useState("")
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const refreshProjects = (selectId?: string) => {
    fetchProjects().then((data) => {
      setProjects(data)
      if (selectId) {
        setSelectedProjectId(selectId)
      } else if (data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id)
      }
    })
  }

  useEffect(() => {
    fetchJobs()
      .then((data) => {
        setJobs(data.slice(0, 20))
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })

    fetchProjects().then((data) => {
      setProjects(data)
      if (data.length > 0) setSelectedProjectId(data[0].id)
    })
  }, [])

  const handleCreate = async () => {
    if (!newProjectName.trim() || creating) return
    setCreating(true)
    setCreateError(null)
    try {
      const result = await createProject(newProjectName.trim())
      if (result.error) {
        setCreateError(result.error)
      } else {
        setCreateDialogOpen(false)
        setNewProjectName("")
        refreshProjects(result.id)
      }
    } catch {
      setCreateError("Failed to create project. Is the API running?")
    } finally {
      setCreating(false)
    }
  }

  const handleImport = async () => {
    if (!repoUrl.trim() || importing) return
    setImporting(true)
    setImportError(null)
    try {
      const result = await importGithubProject(repoUrl.trim())
      if (result.error) {
        setImportError(result.error)
      } else {
        setImportDialogOpen(false)
        setRepoUrl("")
        refreshProjects(result.id)
      }
    } catch {
      setImportError("Failed to import repository. Is the API running?")
    } finally {
      setImporting(false)
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen">
        {/* Page Header */}
        <div className="px-6 pt-8 pb-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4F8EFF] to-[#A855F7] flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Chat</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Submit prompts and track your AI jobs
              </p>
            </div>
          </div>
        </div>

        {/* Project Selector */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0">
              <FolderOpen className="w-4 h-4" />
              <span>Project</span>
            </div>
            {projects.length > 0 ? (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="flex-1 bg-secondary text-foreground text-sm rounded-lg px-3 py-2 border border-border outline-none focus:border-primary/40 transition-colors"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-muted-foreground italic">
                No projects yet.
              </span>
            )}
            <button
              onClick={() => { setCreateError(null); setNewProjectName(""); setCreateDialogOpen(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50 hover:border-border transition-all duration-200 flex-shrink-0"
              title="New Project"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
            <button
              onClick={() => { setImportError(null); setRepoUrl(""); setImportDialogOpen(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50 hover:border-border transition-all duration-200 flex-shrink-0"
              title="Import from GitHub"
            >
              <Github className="w-3.5 h-3.5" />
              Import
            </button>
          </div>
        </div>

        {/* Prompt Card */}
        <PromptCard selectedProjectId={selectedProjectId} />

        {/* Recent Jobs */}
        <div className="px-6 py-8">
          <h2 className="text-base font-semibold text-foreground mb-4">Recent Jobs</h2>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading jobs...
            </div>
          )}

          {!loading && error && (
            <div className="text-sm text-red-400 py-4">
              Failed to load jobs. Is the API running?
            </div>
          )}

          {!loading && !error && jobs.length === 0 && (
            <div className="text-sm text-muted-foreground py-4">
              No jobs yet. Submit a prompt above to get started.
            </div>
          )}

          {!loading && !error && jobs.length > 0 && (
            <div className="flex flex-col gap-2">
              {jobs.map((job) => (
                <JobRow key={job.task_id} task={job} />
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Create Project Dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) { setNewProjectName(""); setCreateError(null) } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }}
              disabled={creating}
              autoFocus
            />
            {createError && <p className="text-xs text-red-400 mt-2">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newProjectName.trim() || creating}
              className="bg-gradient-to-r from-[#4F8EFF] to-[#A855F7] text-white border-0"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import GitHub Dialog */}
      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => { setImportDialogOpen(open); if (!open) { setRepoUrl(""); setImportError(null) } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import from GitHub</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleImport() }}
              disabled={importing}
              autoFocus
            />
            {importError && <p className="text-xs text-red-400 mt-2">{importError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importing}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!repoUrl.trim() || importing}
              className="bg-gradient-to-r from-[#4F8EFF] to-[#A855F7] text-white border-0"
            >
              {importing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
