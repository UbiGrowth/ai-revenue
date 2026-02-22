# UbiGrowth Revenue OS

An enterprise-grade, AI-powered Revenue Operating System that orchestrates autonomous AI executives (CMO, CRO, CFO, COO) across the full revenue stack.

**Lovable project:** https://lovable.dev/projects/da868078-55b7-4a90-9185-8ef20b5a276e

---

## Overall Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend (Vite + TypeScript)    │
│  src/pages/  src/components/  src/hooks/  src/lib/      │
└────────────────────────┬────────────────────────────────┘
                         │ Supabase JS client + Edge Functions
┌────────────────────────▼────────────────────────────────┐
│               Supabase Backend                          │
│  PostgreSQL (RLS)  │  Edge Functions  │  Auth  │ Realtime│
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                 OS Kernel  (kernel/)                     │
│  Module registry → Policy decisions → Action dispatcher  │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn-ui |
| Backend | Supabase (PostgreSQL, Edge Functions, Auth, Realtime) |
| AI | OpenAI GPT-4o, Google Gemini |
| Voice | ElevenLabs, VAPI |
| Email | Resend API |

---

## Kernel (`/kernel`)

The kernel is the control plane for all AI module orchestration. It enforces a strict event-driven model:

```
Module emits KernelEvent
  → Decision Engine evaluates policy
  → KernelDecision persisted
  → Dispatcher executes actions
  → KernelAction persisted
  → Event marked 'completed'
```

Key files:

| File | Purpose |
|------|---------|
| [`kernel/index.ts`](kernel/index.ts) | Public API — exports all kernel functions; deprecated `runAgent`/`runKernel` are blocked in production |
| [`kernel/core/index.ts`](kernel/core/index.ts) | Module registry: `registerModule`, `getModule`, `getAgentForMode` |
| [`kernel/types.ts`](kernel/types.ts) | Shared types: `ExecModule`, `KernelRequest/Response`, `ModuleManifest` |
| [`kernel/modules/index.ts`](kernel/modules/index.ts) | Registers all four exec-module manifests on startup |
| [`kernel/health/`](kernel/health/) | Module health checks |
| [`kernel/launch/`](kernel/launch/) | Per-tenant module toggle system |

Registered exec modules (from [`registry/modules/`](registry/modules/)):

| Module ID | Name | Status |
|-----------|------|--------|
| `ai_cmo` | AI Chief Marketing Officer | Active |
| `ai_cro` | AI Chief Revenue Officer | Active |
| `ai_cfo` | AI Chief Financial Officer | Planned |
| `ai_coo` | AI Chief Operations Officer | Planned |

See [`docs/REVENUE_OS_KERNEL_CONTRACTS.md`](docs/REVENUE_OS_KERNEL_CONTRACTS.md) for the full kernel contract spec.

---

## Database Schema (`/supabase/migrations`)

The platform uses **multi-tenant PostgreSQL** via Supabase with Row Level Security (RLS) on every table.

Tenancy model:
- `workspace_id` — user-facing workspace isolation (preferred for new features)
- `tenant_id` — legacy internal identifier (kept for backward compatibility)

Core table groups (see [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) for full reference):

| Group | Tables |
|-------|--------|
| Identity & Access | `workspaces`, `workspace_members`, `user_roles`, `business_profiles` |
| Kernel Runtime | `kernel_events`, `kernel_decisions`, `kernel_actions` |
| AI CMO | `cmo_campaigns`, `cmo_brand_profiles`, `cmo_icp_segments`, `cmo_funnels`, `cmo_content_assets` |
| AI CRO | `cro_pipelines`, `cro_deals`, `cro_forecasts` |
| CRM | `crm_contacts`, `leads`, `lead_activities` |
| Voice | `voice_agents`, `voice_calls`, `voice_campaigns` |

Migrations are applied in timestamp order from [`supabase/migrations/`](supabase/migrations/). The foundational schema starts at [`20251202210353_remix_migration_from_pg_dump.sql`](supabase/migrations/20251202210353_remix_migration_from_pg_dump.sql) and the kernel runtime tables are introduced in [`20251229190000_revenue_os_kernel_runtime.sql`](supabase/migrations/20251229190000_revenue_os_kernel_runtime.sql).

---

## API Call Patterns (`/src`)

All data access follows one of two patterns:

### 1. Supabase Database Query (direct table access)

```ts
// src/lib/cmo/apiClient.ts
const { data, error } = await supabase
  .from("cmo_campaigns")
  .select("*")
  .eq("tenant_id", tenantId)
  .order("created_at", { ascending: false });

if (error) throw new Error(error.message);
return data || [];
```

### 2. Supabase Edge Function Invocation (AI / business logic)

```ts
// src/lib/cmo/apiClient.ts
const { data, error } = await supabase.functions.invoke("cmo-optimizer", {
  body: {
    tenant_id: tenantId,
    campaign_id: campaignId,
    goal,
    metrics,
  },
});

if (error) throw new Error(error.message);
return data;
```

The Supabase client is initialized once in [`src/integrations/supabase/client.ts`](src/integrations/supabase/client.ts) and imported across the app as:

```ts
import { supabase } from "@/integrations/supabase/client";
```

Hooks (e.g. [`src/hooks/useLeads.ts`](src/hooks/useLeads.ts)) wrap the API client functions with React state and tenant-context resolution. See [`src/lib/cmo/apiClient.ts`](src/lib/cmo/apiClient.ts) for the full pattern reference.

---

## Local Development

```sh
# Install dependencies
npm install

# Start dev server
npm run dev

# Run unit tests
npm run test

# Run type check
npm run typecheck
```

---

## Further Reading

- [`docs/PRODUCT_DOCUMENTATION.md`](docs/PRODUCT_DOCUMENTATION.md) — Full platform feature documentation
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — Complete table reference
- [`docs/REVENUE_OS_KERNEL_CONTRACTS.md`](docs/REVENUE_OS_KERNEL_CONTRACTS.md) — Kernel event/decision/action contracts
- [`docs/SECURITY_ARCHITECTURE.md`](docs/SECURITY_ARCHITECTURE.md) — RLS policies and security model
- [`GETTING_STARTED.md`](GETTING_STARTED.md) — Environment setup and API key configuration

<!-- ci check -->
