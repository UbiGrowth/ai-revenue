"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import {
  fetchProject,
  fetchProjectJobs,
  createJob,
  type Project,
  type Task,
} from "@/lib/api"
import {
  ArrowLeft,
  ArrowUp,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Hourglass,
  GitPullRequest,
  ExternalLink,
} from "lucide-react"

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

function getStatusIcon(state: string) {
  if (state === "completed") return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
  if (state === "failed") return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
  if (state === "queued") return <Hourglass className="w-4 h-4 text-amber-400 flex-shrink-0" />
  return <Loader2 className="w-4 h-4 text-[#4F8EFF] animate-spin flex-shrink-0" />
}

function getStatusLabel(state: string) {
  if (state === "completed") return "Completed"
  if (state === "failed") return "Failed"
  if (state === "queued") return "Queued"
  return "Running"
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const { id } = use(params)
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [projectLoading, setProjectLoading] = useState(true)
  const [jobs, setJobs] = useState<Task[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)

  const [prompt, setPrompt] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProject(id).then((data) => {
      setProject(data)
      setProjectLoading(false)
    })
    fetchProjectJobs(id).then((data) => {
      setJobs(data)
      setJobsLoading(false)
    })
  }, [id])

  const handleSubmit = async () => {
    if (!prompt.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await createJob({
        prompt: prompt.trim(),
        project_id: id,
        base_branch: "main",
      })
      if (result.error) {
        setError(result.error)
      } else if (result.task_id) {
        router.push(`/task/${result.task_id}`)
      }
    } catch {
      setError("Failed to submit job. Is the API running?")
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (projectLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading project...
          </div>
        </main>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            All Projects
          </Link>
          <p className="text-muted-foreground">Project not found.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-3xl">
          {/* Back link */}
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            All Projects
          </Link>

          {/* Project header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">{project.name}</h1>
            {project.repository_url && (
              <a
                href={project.repository_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mt-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {project.repository_url}
              </a>
            )}
          </div>

          {/* Prompt submission */}
          <div className="bg-card rounded-2xl border border-border p-5 mb-8">
            <h2 className="text-sm font-medium text-foreground mb-3">New Job</h2>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to build or change..."
              rows={4}
              disabled={submitting}
              className="w-full bg-secondary/40 text-foreground placeholder:text-muted-foreground text-sm rounded-lg px-3 py-2 border border-border resize-none outline-none focus:border-primary/40 transition-colors leading-relaxed disabled:opacity-60 mb-3"
            />
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-mono">
                {prompt.length > 0 ? `${prompt.length} chars · ` : ""}⌘↵ to submit
              </span>
              <button
                onClick={handleSubmit}
                disabled={!prompt.trim() || submitting}
                className={[
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  prompt.trim() && !submitting
                    ? "bg-gradient-to-r from-[#4F8EFF] to-[#A855F7] text-white hover:opacity-90"
                    : "bg-secondary text-muted-foreground cursor-not-allowed",
                ].join(" ")}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
                Run Job
              </button>
            </div>
          </div>

          {/* Job history */}
          <div>
            <h2 className="text-sm font-medium text-foreground mb-3">Recent Jobs</h2>
            {jobsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading jobs...
              </div>
            ) : jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No jobs yet. Submit a prompt above to get started.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {jobs.map((job) => (
                  <Link
                    key={job.task_id}
                    href={`/task/${job.task_id}`}
                    className="group bg-card rounded-xl border border-border p-4 hover:border-primary/30 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="mt-0.5">{getStatusIcon(job.execution_state)}</div>
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{job.user_prompt}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {getStatusLabel(job.execution_state)}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {new Date(job.initiated_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      {job.pull_request_link && (
                        <a
                          href={job.pull_request_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-medium hover:bg-emerald-500/20 transition-colors flex-shrink-0"
                        >
                          <GitPullRequest className="w-3 h-3" />
                          View PR
                        </a>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
