"use client"

import { AppShell } from "@/components/app-shell"
import { ProjectsGrid } from "@/components/dashboard/projects-grid"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Github, Loader2, FolderKanban } from "lucide-react"
import { createProject, importGithubProject, fetchProjects, type Project } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function ProjectsPage() {
  const router = useRouter()
  const [projectCount, setProjectCount] = useState<number | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [repoUrl, setRepoUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects().then((data: Project[]) => setProjectCount(data.length))
  }, [])

  const resetCreate = () => {
    setNewProjectName("")
    setError(null)
  }

  const resetImport = () => {
    setRepoUrl("")
    setError(null)
  }

  const handleCreate = async () => {
    if (!newProjectName.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await createProject(newProjectName.trim())
      if (result.error) {
        setError(result.error)
      } else {
        setCreateDialogOpen(false)
        resetCreate()
        router.refresh()
        fetchProjects().then((data: Project[]) => setProjectCount(data.length))
      }
    } catch {
      setError("Failed to create project. Is the API running?")
    } finally {
      setSubmitting(false)
    }
  }

  const handleImport = async () => {
    if (!repoUrl.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await importGithubProject(repoUrl.trim())
      if (result.error) {
        setError(result.error)
      } else {
        setImportDialogOpen(false)
        resetImport()
        router.refresh()
        fetchProjects().then((data: Project[]) => setProjectCount(data.length))
      }
    } catch {
      setError("Failed to import repository. Is the API running?")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen">
        {/* Page Header */}
        <div className="px-6 pt-8 pb-6 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4F8EFF] to-[#A855F7] flex items-center justify-center">
                <FolderKanban className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Projects</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {projectCount === null
                    ? "Loading..."
                    : `${projectCount} project${projectCount !== 1 ? "s" : ""} total`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { resetImport(); setImportDialogOpen(true) }}
                className="gap-2"
              >
                <Github className="w-4 h-4" />
                Import from GitHub
              </Button>
              <Button
                size="sm"
                onClick={() => { resetCreate(); setCreateDialogOpen(true) }}
                className="gap-2 bg-gradient-to-r from-[#4F8EFF] to-[#A855F7] text-white border-0 hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                New Project
              </Button>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        <ProjectsGrid />
      </div>

      {/* Create Project Dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) resetCreate() }}
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
              disabled={submitting}
              autoFocus
            />
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newProjectName.trim() || submitting}
              className="bg-gradient-to-r from-[#4F8EFF] to-[#A855F7] text-white border-0"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import GitHub Dialog */}
      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => { setImportDialogOpen(open); if (!open) resetImport() }}
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
              disabled={submitting}
              autoFocus
            />
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!repoUrl.trim() || submitting}
              className="bg-gradient-to-r from-[#4F8EFF] to-[#A855F7] text-white border-0"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
