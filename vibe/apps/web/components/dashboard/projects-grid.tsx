"use client"
import { useEffect, useState } from "react"
import { ProjectCard, type Project } from "./project-card"
import { fetchProjects as apiFetchProjects } from "@/lib/api"

export function ProjectsGrid() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetchProjects()
      .then(data => {
        const mapped = data.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.repository_url || "Local project",
          thumbnail: "",
          starred: false,
          lastEdited: new Date(p.created_at ?? 0).toLocaleDateString(),
          status: "active" as const,
        }))
        setProjects(mapped)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load projects:', err)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="px-6 py-8">Loading projects...</div>

  return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Your Projects
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projects.length} projects total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
            All
          </button>
          <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            Starred
          </button>
          <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            Recent
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  )
}
