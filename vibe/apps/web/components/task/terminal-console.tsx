"use client"

import { useState, useRef, useEffect } from "react"
import {
  Terminal,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useJobLogs } from "@/hooks/use-job-logs"
import type { LogEvent } from "@/lib/api"

const severityLabel: Record<LogEvent["severity"], string> = {
  info:    "INFO",
  success: "DONE",
  warning: "WARN",
  error:   "ERR!",
}

const severityColor: Record<LogEvent["severity"], string> = {
  info:    "text-[#4F8EFF]",
  success: "text-emerald-400",
  warning: "text-amber-400",
  error:   "text-red-400",
}

interface TerminalConsoleProps {
  taskId: string
}

export function TerminalConsole({ taskId }: TerminalConsoleProps) {
  const { logs, isComplete, taskStatus, error } = useJobLogs(taskId)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleCopy = () => {
    const text = logs
      .map((l) => {
        const ts = new Date(l.event_time).toLocaleTimeString()
        return `[${ts}] ${l.event_message}`
      })
      .join("\n")
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusIndicator = isComplete
    ? taskStatus === "completed"
      ? { color: "bg-emerald-400", label: "DONE", textColor: "text-emerald-400" }
      : { color: "bg-red-400", label: "FAIL", textColor: "text-red-400" }
    : { color: "bg-[#4F8EFF] animate-pulse", label: "LIVE", textColor: "text-[#4F8EFF]" }

  return (
    <div className="flex flex-col h-full bg-[oklch(0.12_0.005_285)]">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Build Output
          </span>
          <div className="flex items-center gap-1 ml-2">
            <div className={cn("w-2 h-2 rounded-full", statusIndicator.color)} />
            <span className={cn("text-[10px] font-mono", statusIndicator.textColor)}>
              {statusIndicator.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Copy logs"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title={expanded ? "Minimize" : "Maximize"}
          >
            {expanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Log Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-6"
      >
        {error && (
          <div className="flex gap-3 text-red-400">
            <span className="text-muted-foreground/40 select-none flex-shrink-0 w-16 text-right">--:--:--</span>
            <span className="font-bold flex-shrink-0 w-10">ERR!</span>
            <span className="break-all min-w-0">{error}</span>
          </div>
        )}

        {logs.length === 0 && !error && (
          <div className="flex gap-3 text-muted-foreground/60">
            <span className="text-muted-foreground/40 select-none flex-shrink-0 w-16 text-right">--:--:--</span>
            <span className="font-bold flex-shrink-0 w-10 text-[#4F8EFF]">INFO</span>
            <span>Connecting to log stream…</span>
          </div>
        )}

        {logs.map((log) => {
          const ts = new Date(log.event_time).toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
          return (
            <div key={log.event_id} className="flex gap-3 hover:bg-white/[0.02]">
              <span className="text-muted-foreground/40 select-none flex-shrink-0 w-16 text-right">
                {ts}
              </span>
              <span className={cn("font-bold flex-shrink-0 w-10", severityColor[log.severity])}>
                {severityLabel[log.severity]}
              </span>
              <span className={cn("break-all min-w-0", severityColor[log.severity])}>
                {log.event_message}
              </span>
            </div>
          )
        })}

        {/* Cursor / completion marker */}
        {isComplete ? (
          <div className="flex gap-3 mt-2">
            <span className="text-muted-foreground/40 select-none flex-shrink-0 w-16 text-right">
              ——————
            </span>
            <span className={cn("font-bold flex-shrink-0 w-10", taskStatus === "completed" ? "text-emerald-400" : "text-red-400")}>
              {taskStatus === "completed" ? "DONE" : "FAIL"}
            </span>
            <span className={taskStatus === "completed" ? "text-emerald-400" : "text-red-400"}>
              Job {taskStatus}
            </span>
          </div>
        ) : (
          <div className="flex gap-3 mt-1">
            <span className="text-muted-foreground/40 select-none flex-shrink-0 w-16 text-right" />
            <span className="font-bold flex-shrink-0 w-10 text-[#A855F7]">RUN </span>
            <span className="text-foreground">
              $ <span className="animate-pulse">|</span>
            </span>
          </div>
        )}
      </div>

      {/* Terminal Footer */}
      <div className="flex items-center justify-between px-4 h-9 border-t border-border text-[10px] font-mono text-muted-foreground flex-shrink-0">
        <div className="flex items-center gap-3">
          <span>{logs.length} lines</span>
          <span>|</span>
          <span>UTF-8</span>
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={cn(
            "flex items-center gap-1 hover:text-foreground transition-colors",
            autoScroll && "text-[#4F8EFF]"
          )}
        >
          <ChevronDown className="w-3 h-3" />
          Auto-scroll {autoScroll ? "on" : "off"}
        </button>
      </div>
    </div>
  )
}
