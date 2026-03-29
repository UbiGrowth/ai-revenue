"use client"

import { use } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { PipelineTracker } from "@/components/task/pipeline-tracker"
import { TerminalConsole } from "@/components/task/terminal-console"

interface TaskPageProps {
  params: Promise<{ id: string }>
}

export default function TaskPage({ params }: TaskPageProps) {
  const { id } = use(params)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Pipeline Tracker */}
        <div className="w-[340px] flex-shrink-0">
          <PipelineTracker taskId={id} />
        </div>

        {/* Right Panel: Terminal Console */}
        <div className="flex-1 min-w-0">
          <TerminalConsole taskId={id} />
        </div>
      </div>
    </div>
  )
}
