"use client"

import { useEffect, useState } from "react"
import { fetchJobs, type Task } from "@/lib/api"
import {
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  CreditCard,
  Loader2,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface UsageStats {
  total: number
  completed: number
  failed: number
  running: number
  totalTokens: number
  totalSeconds: number
  filesChanged: number
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof Zap
  color: string
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", color)}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

const PLAN_FEATURES = [
  { label: "AI Jobs per month", free: "50", pro: "Unlimited" },
  { label: "LLM tokens per job", free: "50,000", pro: "500,000" },
  { label: "Concurrent jobs", free: "1", pro: "5" },
  { label: "GitHub PR creation", free: "✓", pro: "✓" },
  { label: "Preflight pipeline", free: "✓", pro: "✓" },
  { label: "Priority queue", free: "—", pro: "✓" },
  { label: "Custom LLM provider", free: "—", pro: "✓" },
  { label: "Team workspaces", free: "—", pro: "✓" },
]

export function BillingDashboard() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchJobs()
      .then((jobs: Task[]) => {
        const s: UsageStats = {
          total: jobs.length,
          completed: jobs.filter((j) => j.execution_state === "completed").length,
          failed: jobs.filter((j) => j.execution_state === "failed").length,
          running: jobs.filter((j) =>
            ["running", "queued"].includes(j.execution_state)
          ).length,
          totalTokens: jobs.reduce((acc, j) => acc + (j.llm_total_tokens ?? 0), 0),
          totalSeconds: jobs.reduce((acc, j) => acc + (j.total_job_seconds ?? 0), 0),
          filesChanged: jobs.reduce((acc, j) => acc + (j.files_changed_count ?? 0), 0),
        }
        setStats(s)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const fmtTokens = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  const fmtSeconds = (n: number) =>
    n >= 60 ? `${Math.floor(n / 60)}m ${n % 60}s` : `${n}s`

  return (
    <div className="flex flex-col gap-8">
      {/* Current Plan */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4F8EFF]/20 to-[#A855F7]/20 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-[#4F8EFF]" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Current Plan</h2>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-bold text-foreground">Free</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Community tier — perfect for personal projects and experimentation
              </p>
            </div>
            <button className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-[#4F8EFF] to-[#A855F7] text-white hover:opacity-90 transition-opacity">
              Upgrade to Pro
            </button>
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-4">Usage Overview</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading usage data...
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Jobs"
              value={stats.total}
              sub={`${stats.completed} completed`}
              icon={BarChart3}
              color="bg-gradient-to-br from-[#4F8EFF] to-[#4F8EFF]/70"
            />
            <StatCard
              label="Tokens Used"
              value={fmtTokens(stats.totalTokens)}
              sub="across all jobs"
              icon={Zap}
              color="bg-gradient-to-br from-[#A855F7] to-[#A855F7]/70"
            />
            <StatCard
              label="Files Changed"
              value={stats.filesChanged}
              sub="total file edits"
              icon={TrendingUp}
              color="bg-gradient-to-br from-[#EC4899] to-[#EC4899]/70"
            />
            <StatCard
              label="Compute Time"
              value={fmtSeconds(stats.totalSeconds)}
              sub="total preflight time"
              icon={Clock}
              color="bg-gradient-to-br from-emerald-500 to-emerald-500/70"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            Failed to load usage data. Is the API running?
          </p>
        )}
      </div>

      {/* Job Breakdown */}
      {stats && stats.total > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Job Breakdown</h3>
          <div className="flex flex-col gap-3">
            {[
              { label: "Completed", count: stats.completed, total: stats.total, icon: CheckCircle2, color: "text-emerald-400", bar: "bg-emerald-500" },
              { label: "Failed", count: stats.failed, total: stats.total, icon: XCircle, color: "text-red-400", bar: "bg-red-500" },
              { label: "Active / Queued", count: stats.running, total: stats.total, icon: Loader2, color: "text-[#4F8EFF]", bar: "bg-[#4F8EFF]" },
            ].map((row) => {
              const pct = stats.total > 0 ? Math.round((row.count / stats.total) * 100) : 0
              return (
                <div key={row.label} className="flex items-center gap-3">
                  <row.icon className={cn("w-4 h-4 flex-shrink-0", row.color)} />
                  <span className="text-sm text-muted-foreground w-28">{row.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", row.bar)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{row.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Plan Comparison */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4F8EFF]/20 to-[#A855F7]/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#4F8EFF]" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Plan Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left px-5 py-3 text-muted-foreground font-medium">Feature</th>
                <th className="text-center px-5 py-3 text-muted-foreground font-medium">
                  <span className="inline-flex items-center gap-1">
                    Free
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                      Current
                    </span>
                  </span>
                </th>
                <th className="text-center px-5 py-3 font-medium">
                  <span className="bg-gradient-to-r from-[#4F8EFF] to-[#A855F7] bg-clip-text text-transparent">
                    Pro
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {PLAN_FEATURES.map((f, i) => (
                <tr
                  key={f.label}
                  className={cn(
                    "border-b border-border/40",
                    i === PLAN_FEATURES.length - 1 && "border-0"
                  )}
                >
                  <td className="px-5 py-3 text-muted-foreground">{f.label}</td>
                  <td className="px-5 py-3 text-center text-foreground">{f.free}</td>
                  <td className="px-5 py-3 text-center font-medium bg-gradient-to-r from-[#4F8EFF]/5 to-[#A855F7]/5">
                    {f.pro}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-border/60 flex justify-end">
          <button className="px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-[#4F8EFF] to-[#A855F7] text-white hover:opacity-90 transition-opacity">
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  )
}
