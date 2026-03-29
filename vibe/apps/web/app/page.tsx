"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { HeroSection } from "@/components/dashboard/hero-section"
import { PromptCard } from "@/components/dashboard/prompt-card"
import { ProjectsGrid } from "@/components/dashboard/projects-grid"
import { fetchProjects } from "@/lib/api"

export default function HomePage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")

  useEffect(() => {
    fetchProjects().then((data) => {
      if (data.length > 0) setSelectedProjectId(data[0].id)
    })
  }, [])

  return (
    <AppShell>
      <div className="min-h-screen">
        <HeroSection />
        <PromptCard selectedProjectId={selectedProjectId} />
        <ProjectsGrid />
      </div>
    </AppShell>
  )
}
