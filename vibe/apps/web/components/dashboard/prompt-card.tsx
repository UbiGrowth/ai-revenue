"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUp, Paperclip, Globe, Zap, Layers, Image as ImageIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createJob } from "@/lib/api"

const suggestions = [
  { icon: Globe, label: "Build a landing page" },
  { icon: Zap, label: "Create a REST API" },
  { icon: Layers, label: "Design a dashboard" },
  { icon: ImageIcon, label: "Generate a portfolio" },
]

interface PromptCardProps {
  selectedProjectId: string
}

export function PromptCard({ selectedProjectId }: PromptCardProps) {
  const router = useRouter()
  const [prompt, setPrompt] = useState("")
  const [focused, setFocused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!prompt.trim() || submitting) return
    if (!selectedProjectId) {
      setError("Please select or create a project first")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const result = await createJob({
        prompt: prompt.trim(),
        project_id: selectedProjectId,
        base_branch: "main",
      })

      if (result.error) {
        setError(result.error)
        return
      }

      if (result.task_id) {
        router.push(`/task/${result.task_id}`)
      }
    } catch (err) {
      setError("Failed to submit job. Is the API running?")
      console.error(err)
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

  return (
    <div className="px-6 -mt-8 relative z-10">
      <div
        className={cn(
          "bg-card rounded-3xl border border-border shadow-2xl shadow-black/20 transition-all duration-300",
          focused && "border-primary/40 shadow-primary/5"
        )}
      >
        <div className="p-6">
          {/* Text Input */}
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to build..."
              rows={3}
              disabled={submitting}
              className="w-full bg-transparent text-foreground placeholder:text-muted-foreground text-base resize-none outline-none leading-relaxed disabled:opacity-60"
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-xs text-red-400 mt-1 mb-2">{error}</p>
          )}

          {/* Bottom Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-2">
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <Paperclip className="w-3.5 h-3.5" />
                Attach
              </button>
              <div className="w-px h-4 bg-border" />
              <span className="text-[10px] text-muted-foreground font-mono">
                {prompt.length > 0 ? `${prompt.length} chars` : "GPT-4o · ⌘↵ to submit"}
              </span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || submitting || !selectedProjectId}
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200",
                prompt.trim() && selectedProjectId && !submitting
                  ? "bg-gradient-to-r from-[#4F8EFF] to-[#A855F7] text-white shadow-lg shadow-[#A855F7]/20 hover:opacity-90"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => setPrompt(s.label)}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/60 border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-border transition-all duration-200 disabled:opacity-50"
          >
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
