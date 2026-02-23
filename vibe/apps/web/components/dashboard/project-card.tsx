"use client"

import { useState } from "react"
import Link from "next/link"
import { Star, MoreHorizontal, ExternalLink, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Project {
  id: string
  name: string
  description: string
  thumbnail: string
  starred: boolean
  lastEdited: string
  status: "active" | "deployed" | "draft"
}

export function ProjectCard({ project }: { project: Project }) {
  const [starred, setStarred] = useState(project.starred)
  const [hovering, setHovering] = useState(false)

  const statusColors = {
    active: "bg-[#4F8EFF]/20 text-[#4F8EFF]",
    deployed: "bg-emerald-500/20 text-emerald-400",
    draft: "bg-muted text-muted-foreground",
  }

  return (
    <div
      className="group relative bg-card rounded-xl border border-border overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/10] bg-secondary overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#4F8EFF]/20 via-[#A855F7]/20 to-[#EC4899]/20"
          style={{
            backgroundImage: `url(${project.thumbnail})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {/* Grid pattern overlay for visual interest */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Hover overlay */}
        <div
          className={cn(
            "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-200",
            hovering ? "opacity-100" : "opacity-0"
          )}
        >
          <Link
            href={`/projects/${project.id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 text-sm font-medium text-white hover:bg-white/25 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Project
          </Link>
        </div>

        {/* Star Button */}
        <button
          onClick={(e) => {
            e.preventDefault()
            setStarred(!starred)
          }}
          className={cn(
            "absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200",
            starred
              ? "bg-amber-500/20 text-amber-400"
              : "bg-black/30 backdrop-blur-sm text-white/60 hover:text-white opacity-0 group-hover:opacity-100"
          )}
        >
          <Star className={cn("w-4 h-4", starred && "fill-current")} />
        </button>

        {/* Status */}
        <div className="absolute top-3 left-3">
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium",
              statusColors[project.status]
            )}
          >
            {project.status}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-card-foreground truncate mb-1">
          {project.name}
        </h3>
        <p className="text-xs text-muted-foreground truncate mb-3">
          {project.description}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {project.lastEdited}
          </div>
          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
