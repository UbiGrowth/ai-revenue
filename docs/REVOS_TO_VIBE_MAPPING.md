# RevOs → VIBE GTM Dashboard Mapping

**Date:** 2026-03-29
**RevOs Supabase:** `ddwqkkiqgjptguzoeohr`
**VIBE Supabase:** `ptaqytvztkhjpuawdxng`
**Source audit:** `docs/revos_schema_audit.json` (119 tables, 12 views)

---

## VIBE Dashboard Targets

| # | Dashboard | Key Data |
|---|-----------|----------|
| 0 | **Phase 0 Scorecard** | Revenue metrics, deal pipeline, conversion rates, data quality |
| 1 | **Prospect Pipeline Tracker** | Leads, prospects, scoring, stage events, activities |
| 2 | **Competitive Positioning** (static) | ICP segments, brand profiles, market data |
| 3 | **Platform Health Monitor** | SLO metrics, agent runs, job queue, error rates |

---

## Classification Key

| Grade | Meaning |
|-------|---------|
| **A — REUSE AS-IS** | Copy table DDL + RLS policies directly into VIBE. Minor rename at most. |
| **B — ADAPT** | Table structure is useful but needs column changes, RLS rework, or scope adjustment. |
| **C — SKIP** | Not relevant to VIBE's 4 dashboards. Do not migrate. |
| **D — REFERENCE** | Don't copy the table, but reference its design patterns for VIBE equivalents. |

---

## Section 1: Tables to REUSE AS-IS (Grade A) — 28 tables

These tables can be copied directly with minimal changes (rename `tenant_id` → `organization_id` where applicable).

### Core Infrastructure (copy first)
| Table | Columns | VIBE Dashboard | Notes |
|-------|---------|----------------|-------|
| workspaces | id, name, owner_id, data_mode, ... | All | Core multi-tenant root. Map to VIBE `organizations`. |
| workspace_members | workspace_id, user_id, role | All | Team access control. Map to VIBE `team_members`. |
| user_roles | user_id, role (app_role enum) | All | Role-based access. |
| platform_admins | user_id | All | Super-admin gate. |

### CRM & Pipeline (Dashboards 0, 1)
| Table | Columns | VIBE Dashboard | Notes |
|-------|---------|----------------|-------|
| leads | workspace_id, name, email, status, score, source, ... | 0, 1 | Primary lead table. Drop nullable tenant_id. |
| crm_leads | workspace_id, lead data | 0, 1 | Enriched CRM leads. |
| crm_contacts | workspace_id, contact data | 0, 1 | Contact records. |
| deals | workspace_id, title, value, stage, revenue_verified, ... | 0, 1 | Revenue pipeline. Critical for Phase 0 Scorecard. |
| opportunities | workspace_id, deal stages | 0, 1 | Sales opportunities. |
| tasks | workspace_id, deal_id, assignee, due_date | 1 | Follow-up tasks. |
| lead_activities | workspace_id, lead_id, type, timestamp | 1 | Activity stream for timeline. |
| lead_stage_events | workspace_id, lead_id, from_stage, to_stage | 1 | Stage transition tracking. |
| prospects | workspace_id, prospect data, score | 1 | Prospect records. |
| prospect_scores | workspace_id, lead_id, score, factors | 1 | Scoring model output. |
| prospect_signals | workspace_id, signal_type, signal_data | 1 | Buying intent signals. |

### Campaign Analytics (Dashboard 0)
| Table | Columns | VIBE Dashboard | Notes |
|-------|---------|----------------|-------|
| campaigns | workspace_id, name, status, budget, channel | 0 | Campaign records. |
| campaign_metrics | workspace_id, campaign_id, impressions, clicks, conversions | 0 | Performance data. |

### AI Settings (adapt scope only)
| Table | Columns | VIBE Dashboard | Notes |
|-------|---------|----------------|-------|
| ai_settings_crm_webhooks | tenant_id (→workspace_id), config | 3 | CRM webhook config. Rename FK. |
| ai_settings_stripe | tenant_id (→workspace_id), stripe_secret_key_hint | 0 | Stripe config. Hint-only (safe). |

### System / Health (Dashboard 3)
| Table | Columns | VIBE Dashboard | Notes |
|-------|---------|----------------|-------|
| agent_runs | workspace_id, agent_type, status, started_at, completed_at | 3 | Agent execution tracking. |
| notifications | workspace_id, user_id, type, message, read | All | User notifications. |
| segments | workspace_id, name, criteria | 1 | Audience segments. |
| industry_verticals | name, description | 2 | Public reference data. |

---

## Section 2: Tables to ADAPT (Grade B) — 23 tables

These need structural changes before use in VIBE.

### CMO Module → VIBE Competitive Positioning (Dashboard 2)
| Table | Change Needed | VIBE Dashboard |
|-------|---------------|----------------|
| cmo_brand_profiles | Drop tenant_id (redundant w/ workspace_id). Simplify to competitive profile. | 2 |
| cmo_icp_segments | Drop tenant_id. Adapt for competitive ICP comparison. | 2 |
| cmo_campaigns | Drop tenant_id. Simplify — VIBE only needs campaign performance summary. | 0 |
| cmo_content_assets | Drop tenant_id. Reference for content performance metrics. | 0 |
| cmo_metrics_snapshots | Keep workspace_id. Adapt metric keys to VIBE KPIs. | 0 |
| cmo_recommendations | Keep workspace_id. Adapt recommendation types. | 0 |
| cmo_weekly_summaries | Keep workspace_id. Adapt summary format. | 0 |
| cmo_funnels | Drop tenant_id. Adapt funnel stages for VIBE pipeline model. | 0, 1 |
| cmo_funnel_stages | Keep workspace_id. Rename to match VIBE stage names. | 0, 1 |
| cmo_offers | Drop tenant_id. Simplify for competitive offer tracking. | 2 |
| cmo_marketing_plans | Drop tenant_id. Reference only — VIBE has simpler planning. | D/reference |

### CRO Module → VIBE Phase 0 Scorecard (Dashboard 0)
| Table | Change Needed | VIBE Dashboard |
|-------|---------------|----------------|
| cro_targets | Drop tenant_id. Adapt target types for VIBE revenue goals. | 0 |
| cro_forecasts | Drop tenant_id. Add UPDATE/DELETE RLS policies (currently missing). | 0 |
| cro_deal_reviews | Drop tenant_id. Add UPDATE/DELETE RLS policies (currently missing). | 0 |
| cro_recommendations | Drop tenant_id. Adapt recommendation categories. | 0 |

### Voice → VIBE Pipeline Tracker (Dashboard 1)
| Table | Change Needed | VIBE Dashboard |
|-------|---------------|----------------|
| voice_agents | Keep workspace_id. Adapt agent config for VIBE voice model. | 1, 3 |
| voice_phone_numbers | Keep workspace_id. Reuse as-is after testing. | 1 |
| voice_call_records | Keep workspace_id. Add non-null constraints on lead_id. | 1 |

### Outbound → VIBE Pipeline (Dashboard 1)
| Table | Change Needed | VIBE Dashboard |
|-------|---------------|----------------|
| outbound_campaigns | Add RLS policies (currently unverified). Add workspace_id if missing. | 1 |
| outbound_sequences | Migrate tenant_id → workspace_id. | 1 |
| outbound_sequence_steps | Add workspace_id scope + RLS policies (currently missing). | 1 |
| outbound_sequence_runs | Migrate tenant_id → workspace_id. | 1 |

### System → VIBE Health (Dashboard 3)
| Table | Change Needed | VIBE Dashboard |
|-------|---------------|----------------|
| slo_metrics | Verify RLS. Add indexes on workspace_id. | 3 |
| slo_alerts | Verify RLS. Add indexes on workspace_id. | 3 |

---

## Section 3: Tables to SKIP (Grade C) — 54 tables

Not relevant to VIBE's 4 dashboards.

### Email Infrastructure (VIBE has no email module)
- `email_sequences`, `email_sequence_steps`, `email_events`, `sequence_enrollments`
- `email_deploy` (edge function only)
- `errors_email_webhook`

### Content & Asset Management (VIBE has no content CMS)
- `assets`, `asset_approvals`, `content_calendar`, `content_templates`, `landing_pages`
- `cmo_content_variants`, `cmo_calendar_events`, `cmo_campaign_channels`

### Legacy / Deprecated
- `tenants`, `user_tenants` — Legacy tenant system being deprecated
- `os_tenant_registry` — Legacy registry
- `tenant_module_access`, `tenant_segments`, `tenant_targets` — Tenant-scoped, being replaced
- `accounts` — Scoped by tenant_id only

### Operational / Internal
- `automation_jobs`, `automation_steps` — Internal automation engine
- `job_queue`, `run_job_queue` — Background job processing
- `worker_tick_metrics` — Internal worker health
- `rate_limit_counters`, `rate_limit_events`, `tenant_rate_limits` — Rate limiting infra
- `events_raw`, `revenue_events` — Raw event ingestion
- `rollout_gate_checks`, `rollout_phases`, `rollout_tenant_assignments` — Feature rollout
- `release_notes` — Internal release tracking

### Spine Tables (RevOs-specific campaign backbone)
- `spine_campaigns`, `spine_campaign_channels`, `spine_contacts`, `spine_crm_activities`

### Integration-Specific
- `ai_settings_email`, `ai_settings_voice`, `ai_settings_social`, `ai_settings_linkedin`
- `ai_settings_calendar`, `ai_settings_domain`
- `social_integrations`, `customer_integrations`, `integration_audit_log`
- `user_gmail_tokens`, `user_password_resets`
- `stripe_events`, `linkedin_tasks`
- `channel_preferences`, `channel_outbox`, `channel_spend_daily`
- `campaign_channel_stats_daily`, `campaign_optimizations`, `campaign_runs`, `campaign_audit_log`

### Kernel / Optimizer (RevOs-specific AI orchestration)
- `kernel_actions`, `kernel_cycle_slo`, `kernel_decisions`, `kernel_events`
- `optimization_actions`, `optimization_action_results`, `optimization_cycles`, `optimizer_configs`
- `metric_snapshots_daily`

### Other
- `business_profiles` — User-scoped, no workspace isolation
- `outbound_message_events` — No RLS, no scope
- `team_invitations` — RevOs-specific onboarding flow

---

## Section 4: Reference-Only (Grade D) — 14 tables

Don't copy, but study the patterns.

| Table | What to Reference |
|-------|-------------------|
| kernel_decisions | Decision-audit pattern: store AI reasoning + confidence scores |
| kernel_events | Event-sourcing pattern for agent lifecycle |
| optimization_cycles | Cycle-based optimization loop design |
| optimizer_configs | Per-workspace AI config pattern |
| campaign_audit_log | Audit trail pattern for campaigns |
| events_raw | Raw event ingestion schema (for VIBE analytics later) |
| revenue_events | Revenue event stream design |
| metric_snapshots_daily | Daily snapshot aggregation pattern |
| rate_limit_counters | Rate limiting schema (for VIBE API protection) |
| tenant_module_access | Feature-flag / module gating pattern |
| rollout_phases | Gradual rollout pattern |
| business_profiles | User profile schema (adapt for VIBE user profiles) |
| slo_config | SLO definition schema (for Dashboard 3) |
| worker_tick_metrics | Worker health monitoring pattern |

---

## Section 5: Multi-Tenant Mapping

### RevOs → VIBE Identity Model

| RevOs Concept | RevOs Table | VIBE Equivalent | Notes |
|---------------|-------------|-----------------|-------|
| Workspace | `workspaces` | `organizations` | Top-level tenant container |
| Workspace Member | `workspace_members` | `team_members` | User ↔ Org access |
| Tenant (legacy) | `tenants` | — | **Skip.** VIBE uses `organization_id` only. |
| User Tenant | `user_tenants` | — | **Skip.** Replaced by `team_members`. |
| User Role | `user_roles` | `user_roles` | Keep `app_role` enum: admin, sales, manager |
| Platform Admin | `platform_admins` | `platform_admins` | Super-admin gate |
| Data Mode | `data_mode` enum | `data_mode` enum | Keep `live`/`demo` gating |

### RLS Function Mapping

| RevOs Function | VIBE Equivalent |
|----------------|-----------------|
| `user_has_workspace_access(workspace_id)` | `user_has_org_access(organization_id)` |
| `user_belongs_to_tenant(tenant_id)` | **Remove.** Not needed in VIBE. |
| `is_platform_admin()` | `is_platform_admin()` — Keep as-is |
| `has_role(user_id, role)` | `has_role(user_id, role)` — Keep as-is |
| `get_user_tenant_ids(user_id)` | **Remove.** Use `get_user_org_ids(user_id)` |

### Column Rename Rules

| RevOs Column | VIBE Column | Apply To |
|--------------|-------------|----------|
| `workspace_id` | `organization_id` | All tables |
| `tenant_id` | — (drop) | All tables with dual IDs |
| `tenant_id` (in ai_settings_*) | `organization_id` | ai_settings_* tables that reference workspaces(id) |

---

## Section 6: Recommended Migration Sequence

### Phase 1 — Foundation (Week 1)

```
1. Create VIBE `organizations` table (from workspaces DDL)
2. Create `team_members` table (from workspace_members DDL)
3. Create `user_roles` + `platform_admins` (copy as-is)
4. Port RLS helper functions:
   - user_has_org_access() ← user_has_workspace_access()
   - is_platform_admin() ← copy
   - has_role() ← copy
5. Create data_mode enum + app_role enum
6. Create industry_verticals (public reference data)
```

### Phase 2 — Dashboard 0: Phase 0 Scorecard (Week 2)

```
1. Create deals table (copy DDL, rename workspace_id → organization_id, drop tenant_id)
2. Create campaigns + campaign_metrics tables
3. Port CRO tables: cro_targets, cro_forecasts, cro_deal_reviews, cro_recommendations
   - Add missing UPDATE/DELETE policies on cro_deal_reviews and cro_forecasts
4. Create views:
   - v_pipeline_metrics_by_workspace → v_pipeline_metrics_by_org
   - v_revenue_by_workspace → v_revenue_by_org
   - v_crm_pipeline_truth → v_crm_pipeline_truth (rename scope)
   - v_data_quality_by_workspace → v_data_quality_by_org
5. Port hooks: usePipelineMetrics, useCRMSourceOfTruth, useDataQualityStatus
6. Port components: CRMDashboard (scorecard panels), PredictiveAnalytics
```

### Phase 3 — Dashboard 1: Prospect Pipeline Tracker (Week 3)

```
1. Create leads, crm_leads, crm_contacts tables
2. Create prospects, prospect_scores, prospect_signals tables
3. Create lead_activities, lead_stage_events, tasks, opportunities
4. Port voice tables: voice_agents, voice_phone_numbers, voice_call_records
5. Port outbound tables (with fixes): outbound_campaigns, outbound_sequences,
   outbound_sequence_steps (add RLS!), outbound_sequence_runs
6. Create views:
   - v_crm_source_of_truth → v_crm_source_of_truth
   - v_crm_lead_pipeline → v_crm_lead_pipeline
   - v_crm_conversion_funnel → v_crm_conversion_funnel
7. Port hooks: useLeads, useVoiceAnalytics, useVoiceData
8. Port components: LeadPipeline, DealsPipeline, LeadScoring, LeadTimeline,
   ConversationIntelligence, CallAnalyticsCharts
```

### Phase 4 — Dashboard 2: Competitive Positioning (Week 4)

```
1. Adapt cmo_brand_profiles, cmo_icp_segments, cmo_offers
2. Create competitive_profiles table (new, derived from brand_profiles pattern)
3. Static data — no real-time feeds needed
4. Port segments table for audience segmentation
```

### Phase 5 — Dashboard 3: Platform Health Monitor (Week 4-5)

```
1. Create agent_runs table (copy as-is)
2. Port slo_metrics, slo_alerts, slo_config tables (verify + fix RLS)
3. Create notifications table
4. Port hooks: useOptimizations, useDataIntegrity
5. Port edge functions (health/monitoring):
   - slo-monitor
   - voice-health-check
   - infrastructure-test-runner
   - qa-execution-cert
```

---

## Section 7: Reusable Codebase Assets Beyond Schema

### Database Views (14 total, 11 VIBE-relevant)

| View | SQL Source Migration | VIBE Dashboard |
|------|---------------------|----------------|
| `v_crm_pipeline_truth` | `20251223012437_*.sql` | 0, 1 |
| `v_crm_conversion_funnel` | `20251223012437_*.sql` | 0, 1 |
| `v_crm_source_of_truth` | `20251223013128_*.sql` | 0, 1 |
| `v_crm_lead_pipeline` | `20251223013128_*.sql` | 1 |
| `v_data_quality_by_workspace` | `20251223013906_*.sql` | 0, 3 |
| `v_pipeline_metrics_by_workspace` | `20251223020944_*.sql` | 0 |
| `v_revenue_by_workspace` | migrations | 0 |
| `v_cmo_metrics_by_workspace` | migrations | 0 |
| `v_cmo_campaign_performance` | migrations | 0 |
| `v_cmo_funnel_performance` | migrations | 0, 1 |
| `v_cmo_content_performance` | migrations | 0 |

### React Hooks (24 total, ~15 VIBE-relevant)

| Hook | File | VIBE Use |
|------|------|----------|
| `usePipelineMetrics` | `src/hooks/usePipelineMetrics.ts` | Dashboard 0 — fetches v_pipeline_metrics |
| `useCRMSourceOfTruth` | `src/hooks/useCRMSourceOfTruth.ts` | Dashboard 0, 1 — master CRM data |
| `useDataQualityStatus` | `src/hooks/useDataQualityStatus.ts` | Dashboard 0, 3 — data quality scoring |
| `useLeads` | `src/hooks/useLeads.ts` | Dashboard 1 — lead CRUD |
| `useVoiceAnalytics` | `src/hooks/useVoiceAnalytics.ts` | Dashboard 1 — call analytics |
| `useVoiceData` | `src/hooks/useVoiceData.ts` | Dashboard 1 — voice agent data |
| `useOptimizations` | `src/hooks/useOptimizations.ts` | Dashboard 3 — optimization tracking |
| `useDataIntegrity` | `src/hooks/useDataIntegrity.ts` | Dashboard 3 — health checks |
| `useWorkspace` | `src/hooks/useWorkspace.ts` | All — workspace context (rename to useOrganization) |
| `useDemoMode` | `src/hooks/useDemoMode.ts` | All — data_mode gating |
| `useModuleEnabled` | `src/hooks/useModuleEnabled.ts` | All — feature gating |
| `useCMO` | `src/hooks/useCMO.ts` | Dashboard 2 — CMO data (adapt for competitive) |
| `useVoiceSetup` | `src/hooks/useVoiceSetup.ts` | Dashboard 1 — voice onboarding |
| `useVoiceCampaigns` | `src/hooks/useVoiceCampaigns.ts` | Dashboard 1 — voice campaign data |
| `useTenantSegments` | `src/hooks/useTenantSegments.ts` | Dashboard 1 — segment data (rename tenant→org) |

### React Components (49 total, ~30 VIBE-relevant)

**CRM Components (21)** — `src/components/crm/`
| Component | VIBE Dashboard |
|-----------|----------------|
| `CRMDashboard.tsx` | 0, 1 — Main CRM layout |
| `DealsPipeline.tsx` | 0 — Kanban deal board |
| `LeadPipeline.tsx` | 1 — Lead stage visualization |
| `PredictiveAnalytics.tsx` | 0 — ML forecasting charts |
| `LeadScoring.tsx` | 1 — Score breakdown |
| `LeadTimeline.tsx` | 1 — Activity timeline |
| `ConversationIntelligence.tsx` | 1 — Call/email analysis |
| `CRMReports.tsx` | 0 — Report panels |
| `EmailAnalyticsDashboard.tsx` | Reference only |
| `TaskManager.tsx` | 1 — Task management |
| `SegmentSelector.tsx` | 1 — Segment picker |
| `UniversalCSVImport.tsx` | 1 — Data import |

**Voice Components (7)** — `src/components/voice/`
| Component | VIBE Dashboard |
|-----------|----------------|
| `VoiceAnalyticsDashboard.tsx` | 1, 3 — Voice metrics |
| `CallAnalyticsCharts.tsx` | 1 — Call charts (Recharts) |
| `CallHistoryTable.tsx` | 1 — Call log table |
| `CampaignCard.tsx` | 1 — Campaign summary card |
| `AssistantBuilder.tsx` | Reference — voice agent config |
| `VoiceSetupWizard.tsx` | Reference — onboarding flow |
| `BulkCallPanel.tsx` | Reference — bulk operations |

### Edge Functions (~40 VIBE-relevant out of 134 total)

**Directly Reusable:**
| Function | VIBE Use |
|----------|----------|
| `predictive-analytics` | Dashboard 0 — ML predictions |
| `analyze-leads` | Dashboard 1 — Lead analysis |
| `auto-score-lead` | Dashboard 1 — Lead scoring |
| `qualify-lead` | Dashboard 1 — Lead qualification |
| `lead-capture` | Dashboard 1 — Inbound leads |
| `conversation-intelligence` | Dashboard 1 — Call analysis |
| `slo-monitor` | Dashboard 3 — SLO monitoring |
| `voice-health-check` | Dashboard 3 — Health checks |
| `infrastructure-test-runner` | Dashboard 3 — Infra tests |
| `qa-execution-cert` | Dashboard 3 — QA certification |
| `vapi-analytics` | Dashboard 1 — Voice analytics |
| `vapi-list-calls` | Dashboard 1 — Call history |
| `campaign-calculate-roi` | Dashboard 0 — ROI calculation |
| `sync-campaign-metrics` | Dashboard 0 — Metrics sync |

**Adapt for VIBE:**
| Function | Change Needed |
|----------|---------------|
| `ai-analyze-workspace` | Rename workspace → organization |
| `crm-leads-list` | Adapt filters for VIBE pipeline |
| `revenue-os-guard-deal-update` | Adapt for VIBE deal model |
| `revenue-os-guard-send-invoice` | Adapt for VIBE invoicing |
| `campaign-optimizer` | Simplify for VIBE scope |
| `outbound-prospect-intel` | Adapt for VIBE prospect model |

### Type Definitions

| File | VIBE Use |
|------|----------|
| `src/integrations/supabase/types.ts` | Generate VIBE equivalent from new schema |
| `src/lib/cmo/types.ts` | Reference for CMO/competitive types |
| `src/lib/voice/types.ts` | Reference for voice types |
| `src/lib/cmo/apiClient.ts` | Pattern for VIBE API client |
| `src/lib/voice/apiClient.ts` | Pattern for VIBE voice client |

---

## Section 8: Known Issues to Fix During Migration

| Issue | Severity | Fix |
|-------|----------|-----|
| Plaintext secrets in ai_settings_email, ai_settings_voice | CRITICAL | Use Supabase Vault in VIBE |
| ai_settings_* FK mismatch (tenant_id → workspaces) | CRITICAL | Rename to organization_id → organizations |
| rate_limit_counters has no RLS | HIGH | Add organization-scoped RLS in VIBE |
| outbound_sequence_steps has no RLS | HIGH | Add RLS before porting |
| cro_deal_reviews missing UPDATE/DELETE policies | HIGH | Add policies during Phase 2 |
| cro_forecasts missing UPDATE/DELETE policies | HIGH | Add policies during Phase 2 |
| ~48 tables with unverified RLS | HIGH | Verify against live DB before porting |
| Missing indexes on workspace_id (cmo_*, cro_*, voice_*) | MEDIUM | Add indexes in VIBE from day 1 |
| business_profiles has no workspace scope | MEDIUM | Scope to organization_id in VIBE |
| Nullable FKs on leads.tenant_id, deals.tenant_id | LOW | Drop nullable tenant_id columns |

---

## Summary

| Classification | Count | % |
|---------------|-------|---|
| A — Reuse As-Is | 28 | 24% |
| B — Adapt | 23 | 19% |
| C — Skip | 54 | 45% |
| D — Reference | 14 | 12% |
| **Total** | **119** | **100%** |

**Bottom line:** VIBE can leverage ~43% of the RevOs schema (51 tables) plus 11 views, ~15 hooks, ~30 components, and ~20 edge functions. The biggest wins are the CRM pipeline tables + views (Dashboard 0 & 1) and the RLS infrastructure. The main work is renaming `workspace_id` → `organization_id` and dropping the legacy `tenant_id` column.
