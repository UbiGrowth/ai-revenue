"use client"

import { useEffect, useState } from "react"
import { fetchHealth, TENANT_ID, type HealthStatus } from "@/lib/api"
import { CheckCircle2, XCircle, Loader2, Server, Key, Cpu, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

interface SettingsSection {
  title: string
  icon: typeof Server
  children: React.ReactNode
}

function Section({ title, icon: Icon, children }: SettingsSection) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4F8EFF]/20 to-[#A855F7]/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#4F8EFF]" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-5 flex flex-col gap-4">{children}</div>
    </div>
  )
}

interface FieldRowProps {
  label: string
  value: string
  description?: string
  badge?: { text: string; variant: "success" | "error" | "neutral" }
}

function FieldRow({ label, value, description, badge }: FieldRowProps) {
  const badgeColors = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    error: "bg-red-500/10 text-red-400 border-red-500/20",
    neutral: "bg-secondary text-muted-foreground border-border",
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm text-muted-foreground font-mono truncate max-w-[240px]">
          {value}
        </span>
        {badge && (
          <span
            className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-md border",
              badgeColors[badge.variant]
            )}
          >
            {badge.text}
          </span>
        )}
      </div>
    </div>
  )
}

export function SettingsPanel() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [healthError, setHealthError] = useState(false)

  const apiUrl =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
    "http://localhost:3001"

  useEffect(() => {
    fetchHealth()
      .then((data) => {
        setHealth(data)
        setHealthLoading(false)
      })
      .catch(() => {
        setHealthError(true)
        setHealthLoading(false)
      })
  }, [])

  const apiStatus = healthLoading
    ? { text: "Checking...", variant: "neutral" as const }
    : health
    ? { text: "Connected", variant: "success" as const }
    : { text: "Unreachable", variant: "error" as const }

  return (
    <div className="flex flex-col gap-6">
      {/* API Connection */}
      <Section title="API Connection" icon={Server}>
        <FieldRow
          label="API URL"
          value={apiUrl}
          description="Backend REST API endpoint"
          badge={apiStatus}
        />
        <FieldRow
          label="Tenant ID"
          value={TENANT_ID}
          description="Multi-tenant workspace identifier (X-Tenant-Id header)"
        />
        {health && (
          <FieldRow
            label="API Status"
            value={`Online · ${new Date(health.timestamp * 1000).toLocaleTimeString()}`}
            description="Last health check timestamp"
            badge={{ text: health.status, variant: "success" }}
          />
        )}
        {!healthLoading && healthError && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            Cannot reach the API. Make sure the backend is running on {apiUrl}.
          </div>
        )}
        {healthLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking API health...
          </div>
        )}
      </Section>

      {/* LLM Configuration */}
      <Section title="LLM Configuration" icon={Cpu}>
        <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2 border border-border/50">
          LLM settings are configured server-side via environment variables. Contact your
          administrator to change the model or API keys.
        </div>
        <FieldRow
          label="Primary Provider"
          value="OpenAI"
          description="LLM provider used for code generation"
        />
        <FieldRow
          label="Model"
          value="GPT-4 (temperature=0)"
          description="Deterministic output for reliable diff generation"
        />
        <FieldRow
          label="Max Iterations"
          value="6"
          description="Maximum LLM retry iterations per task (MAX_ITERATIONS)"
        />
        <FieldRow
          label="Max Context Size"
          value="50,000 chars"
          description="Maximum repository context sent to LLM (MAX_CONTEXT_SIZE)"
        />
        <FieldRow
          label="Max Diff Size"
          value="5,000 chars"
          description="Maximum generated diff size (MAX_DIFF_SIZE)"
        />
      </Section>

      {/* Preflight Pipeline */}
      <Section title="Preflight Pipeline" icon={Shield}>
        <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2 border border-border/50">
          Preflight stages run after applying a diff to validate changes. Unconfigured
          stages are skipped. Set the corresponding env var on the server to enable each
          stage.
        </div>
        {[
          { label: "Lint", env: "LINT_COMMAND", description: "Code linting stage" },
          {
            label: "Typecheck",
            env: "TYPECHECK_COMMAND",
            description: "TypeScript type checking stage",
          },
          { label: "Test", env: "TEST_COMMAND", description: "Automated test suite stage" },
          { label: "Smoke", env: "SMOKE_COMMAND", description: "Smoke test stage" },
        ].map((stage) => (
          <FieldRow
            key={stage.env}
            label={stage.label}
            value={stage.env}
            description={stage.description}
            badge={{ text: "Env-controlled", variant: "neutral" }}
          />
        ))}
        <FieldRow
          label="Timeout"
          value="300,000 ms (5 min)"
          description="Shared timeout for all preflight stages (PREFLIGHT_TIMEOUT)"
        />
      </Section>

      {/* Authentication */}
      <Section title="Integrations" icon={Key}>
        <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2 border border-border/50">
          API keys and tokens are managed server-side. They are never exposed to the
          browser.
        </div>
        <FieldRow
          label="OpenAI API Key"
          value="••••••••••••••••"
          description="Required for LLM code generation (OPENAI_API_KEY)"
          badge={{ text: "Server-side", variant: "neutral" }}
        />
        <FieldRow
          label="GitHub Token"
          value="••••••••••••••••"
          description="Required for PR creation (GITHUB_TOKEN)"
          badge={{ text: "Server-side", variant: "neutral" }}
        />
      </Section>
    </div>
  )
}
