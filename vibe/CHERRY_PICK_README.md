# VIBE GTM Dashboard — Cherry-Pick Package from RevOs

## Quick Start

Run these 5 migrations in order against the VIBE Supabase project (`ptaqytvztkhjpuawdxng`):

```bash
# Via Supabase CLI or SQL Editor
psql $VIBE_DATABASE_URL -f vibe/migrations/001_foundation.sql   # Orgs, roles, RLS functions
psql $VIBE_DATABASE_URL -f vibe/migrations/002_scorecard.sql    # Deals, campaigns, CRO, views
psql $VIBE_DATABASE_URL -f vibe/migrations/003_pipeline.sql     # Leads, prospects, voice, outbound, views
psql $VIBE_DATABASE_URL -f vibe/migrations/004_competitive.sql  # Brand profiles, ICP, offers
psql $VIBE_DATABASE_URL -f vibe/migrations/005_health.sql       # Agent runs, SLO, alerts
```

## What's Included

### SQL Migrations (5 files)
| File | Tables | Views | Policies |
|------|--------|-------|----------|
| `001_foundation.sql` | 6 tables + 4 RLS functions | — | 16 policies |
| `002_scorecard.sql` | 9 tables | 4 views | 36 policies |
| `003_pipeline.sql` | 17 tables | 3 views | 72 policies |
| `004_competitive.sql` | 3 tables | — | 12 policies |
| `005_health.sql` | 3 tables | — | 12 policies |
| **Total** | **38 tables** | **7 views** | **148 policies** |

### Key Renames from RevOs
| RevOs | VIBE | Reason |
|-------|------|--------|
| `workspaces` | `organizations` | Clearer multi-tenant naming |
| `workspace_members` | `team_members` | Clearer |
| `workspace_id` (column) | `organization_id` | Consistent with table |
| `tenant_id` | **dropped** | Legacy, not needed |
| `cmo_brand_profiles` | `brand_profiles` | No CMO prefix needed |
| `cmo_icp_segments` | `icp_segments` | No CMO prefix needed |
| `cmo_offers` | `offers` | No CMO prefix needed |

### Key Fixes Applied (from RevOs audit)
- All secrets use hint-only columns (actual keys go to Supabase Vault)
- All tables have `organization_id` FK (no orphaned tenant_id references)
- All tables have RLS enabled with org-scoped policies
- `cro_deal_reviews` and `cro_forecasts` now have UPDATE/DELETE policies (missing in RevOs)
- `outbound_sequence_steps` now has RLS (missing in RevOs)
- Indexes added on all `organization_id` columns

## React Assets to Copy from RevOs

### Hooks (copy → adapt imports)
| RevOs Hook | Copy To | Rename |
|------------|---------|--------|
| `src/hooks/usePipelineMetrics.ts` | `hooks/usePipelineMetrics.ts` | Change view name to `v_pipeline_metrics_by_org` |
| `src/hooks/useCRMSourceOfTruth.ts` | `hooks/useCRMSourceOfTruth.ts` | Change view name to `v_crm_source_of_truth` |
| `src/hooks/useDataQualityStatus.ts` | `hooks/useDataQualityStatus.ts` | Change view name to `v_data_quality_by_org` |
| `src/hooks/useLeads.ts` | `hooks/useLeads.ts` | Change table refs |
| `src/hooks/useVoiceAnalytics.ts` | `hooks/useVoiceAnalytics.ts` | Minimal changes |
| `src/hooks/useVoiceData.ts` | `hooks/useVoiceData.ts` | Minimal changes |
| `src/hooks/useWorkspace.ts` | `hooks/useOrganization.ts` | Full rename workspace→org |
| `src/hooks/useDemoMode.ts` | `hooks/useDemoMode.ts` | Copy as-is |
| `src/hooks/useOptimizations.ts` | `hooks/useOptimizations.ts` | Copy as-is |
| `src/hooks/useDataIntegrity.ts` | `hooks/useDataIntegrity.ts` | Copy as-is |

### Components (copy → adapt)
**Dashboard 0 — Scorecard:**
- `src/components/crm/CRMDashboard.tsx` → Strip non-scorecard tabs
- `src/components/crm/DealsPipeline.tsx` → Copy as-is (Kanban board)
- `src/components/crm/PredictiveAnalytics.tsx` → Copy as-is (Recharts)
- `src/components/crm/CRMReports.tsx` → Copy panels

**Dashboard 1 — Pipeline Tracker:**
- `src/components/crm/LeadPipeline.tsx` → Copy as-is
- `src/components/crm/LeadScoring.tsx` → Copy as-is
- `src/components/crm/LeadTimeline.tsx` → Copy as-is
- `src/components/crm/ConversationIntelligence.tsx` → Copy as-is
- `src/components/crm/TaskManager.tsx` → Copy as-is
- `src/components/crm/UniversalCSVImport.tsx` → Copy as-is
- `src/components/voice/VoiceAnalyticsDashboard.tsx` → Copy as-is
- `src/components/voice/CallAnalyticsCharts.tsx` → Copy as-is
- `src/components/voice/CallHistoryTable.tsx` → Copy as-is

**Dashboard 3 — Health:**
- No direct component match — build from agent_runs + slo_metrics data

### Edge Functions (copy to `supabase/functions/`)
**Directly reusable:**
- `predictive-analytics` — ML deal forecasting
- `analyze-leads` — AI lead analysis
- `auto-score-lead` — Automated scoring
- `qualify-lead` — Lead qualification
- `lead-capture` — Inbound lead ingestion
- `conversation-intelligence` — Call transcript analysis
- `slo-monitor` — SLO health checking
- `voice-health-check` — Voice provider health
- `campaign-calculate-roi` — ROI calculation
- `sync-campaign-metrics` — Pull external metrics

### Type Definitions
- Generate fresh `types.ts` from VIBE Supabase after running migrations:
  ```bash
  npx supabase gen types typescript --project-id ptaqytvztkhjpuawdxng > src/integrations/supabase/types.ts
  ```

## Architecture Patterns Preserved

1. **Revenue verification** — `revenue_verified` flag on deals, Stripe event cross-check
2. **Data mode gating** — `data_mode` enum (`live`/`demo`) on all views
3. **Source-of-truth views** — Analytics computed in SQL, not app layer
4. **RLS helper functions** — Centralized access control, not per-policy inline
5. **Role-based access** — `app_role` enum with `has_role()` helper
6. **Org-scoped everything** — Single `organization_id` FK, no dual-key confusion
