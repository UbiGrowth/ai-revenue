# RevOs Schema Audit Report

**Date:** 2026-03-28
**Project:** ddwqkkiqgjptguzoeohr (UbiGrowth RevOs)
**Scope:** Read-only audit of public schema — tables, RLS policies, security

---

## 1. Schema Overview

| Metric | Count |
|--------|-------|
| Tables (from types.ts) | 119 |
| Tables with RLS enabled | ~71 |
| RLS policies (BACKUP_SCHEMA estimate) | 429 |
| Migration files | 220+ |
| Views | 5+ |

### Multi-Tenancy Architecture
- **`workspace_id`** — primary isolation key (recommended for new features)
- **`tenant_id`** — legacy isolation key (being deprecated per migration `20260107000003`)
- Most tables carry both columns for backward compatibility

---

## 2. Complete Table Inventory (119 tables)

### Core Infrastructure
| Table | Scoping | RLS |
|-------|---------|-----|
| workspaces | owner_id | Yes |
| workspace_members | workspace_id | Yes |
| tenants | — | Yes |
| user_tenants | user_id + tenant_id | Yes |
| user_roles | user_id | Yes |
| platform_admins | user_id | Yes |
| os_tenant_registry | tenant_id | Unverified |

### CRM & Sales
| Table | Scoping | RLS |
|-------|---------|-----|
| leads | workspace_id (tenant_id nullable) | Yes |
| crm_leads | workspace_id | Yes |
| crm_contacts | workspace_id | Yes |
| deals | workspace_id (tenant_id nullable) | Yes |
| opportunities | workspace_id | Yes |
| tasks | workspace_id | Yes |
| accounts | tenant_id | Yes |
| lead_activities | workspace_id | Yes |
| lead_stage_events | workspace_id | Unverified |
| prospect_scores | workspace_id | Unverified |
| prospect_signals | workspace_id | Unverified |
| prospects | workspace_id | Yes |

### AI CMO Module
| Table | Scoping | RLS |
|-------|---------|-----|
| cmo_brand_profiles | workspace_id + tenant_id | Yes |
| cmo_campaigns | workspace_id + tenant_id | Yes |
| cmo_campaign_channels | workspace_id | Yes |
| cmo_content_assets | workspace_id + tenant_id | Yes |
| cmo_content_variants | workspace_id | Yes |
| cmo_calendar_events | workspace_id | Yes |
| cmo_funnels | workspace_id + tenant_id | Yes |
| cmo_funnel_stages | workspace_id | Yes |
| cmo_icp_segments | workspace_id + tenant_id | Yes |
| cmo_marketing_plans | workspace_id + tenant_id | Yes |
| cmo_metrics_snapshots | workspace_id | Yes |
| cmo_offers | workspace_id + tenant_id | Yes |
| cmo_recommendations | workspace_id | Yes |
| cmo_weekly_summaries | workspace_id | Yes |

### CRO Module
| Table | Scoping | RLS |
|-------|---------|-----|
| cro_targets | workspace_id + tenant_id | Yes |
| cro_forecasts | workspace_id + tenant_id | Yes |
| cro_deal_reviews | workspace_id + tenant_id | Yes |
| cro_recommendations | workspace_id + tenant_id | Yes |

### Voice & Outbound
| Table | Scoping | RLS |
|-------|---------|-----|
| voice_agents | workspace_id | Yes |
| voice_phone_numbers | workspace_id | Yes |
| voice_call_records | workspace_id | Yes |
| outbound_campaigns | workspace_id | Unverified |
| outbound_sequences | tenant_id | Yes |
| outbound_sequence_steps | — | Unverified |
| outbound_sequence_runs | tenant_id | Yes |
| outbound_message_events | — | Unverified |

### Email & Sequences
| Table | Scoping | RLS |
|-------|---------|-----|
| email_sequences | workspace_id (added in fix) | Yes |
| email_sequence_steps | workspace_id (added in fix) | Yes |
| email_events | workspace_id | Unverified |
| sequence_enrollments | workspace_id | Yes |

### Content & Assets
| Table | Scoping | RLS |
|-------|---------|-----|
| assets | workspace_id | Yes |
| asset_approvals | workspace_id (added in fix) | Yes |
| content_calendar | workspace_id | Yes |
| content_templates | workspace_id | Yes |
| landing_pages | workspace_id | Unverified |

### Campaigns & Analytics
| Table | Scoping | RLS |
|-------|---------|-----|
| campaigns | workspace_id | Yes |
| campaign_metrics | workspace_id | Yes |
| campaign_runs | workspace_id | Unverified |
| campaign_audit_log | workspace_id | Unverified |
| campaign_channel_stats_daily | workspace_id | Unverified |
| campaign_optimizations | workspace_id | Unverified |
| channel_outbox | workspace_id | Unverified |
| channel_spend_daily | workspace_id | Unverified |
| spine_campaigns | workspace_id | Unverified |
| spine_campaign_channels | workspace_id | Unverified |
| spine_contacts | workspace_id | Unverified |
| spine_crm_activities | workspace_id | Unverified |

### AI Settings (per workspace)
| Table | Scoping | RLS |
|-------|---------|-----|
| ai_settings_calendar | tenant_id → workspaces(id) | Yes |
| ai_settings_crm_webhooks | tenant_id → workspaces(id) | Yes |
| ai_settings_domain | tenant_id → workspaces(id) | Yes |
| ai_settings_email | tenant_id → workspaces(id) | Yes |
| ai_settings_linkedin | tenant_id → workspaces(id) | Yes |
| ai_settings_social | tenant_id → workspaces(id) | Yes |
| ai_settings_stripe | tenant_id → workspaces(id) | Yes |
| ai_settings_voice | tenant_id → workspaces(id) | Yes |

### System / Platform
| Table | Scoping | RLS |
|-------|---------|-----|
| agent_runs | workspace_id + tenant_id | Yes |
| automation_jobs | workspace_id | Unverified |
| automation_steps | workspace_id | Unverified |
| business_profiles | user_id (no workspace!) | Unverified |
| channel_preferences | user_id | Yes |
| customer_integrations | workspace_id | Unverified |
| errors_email_webhook | — | Unverified |
| events_raw | tenant_id | Unverified |
| integration_audit_log | workspace_id | Unverified |
| job_queue | — | Unverified |
| kernel_actions | workspace_id | Unverified |
| kernel_cycle_slo | workspace_id | Unverified |
| kernel_decisions | workspace_id | Unverified |
| kernel_events | workspace_id | Unverified |
| linkedin_tasks | workspace_id | Unverified |
| metric_snapshots_daily | workspace_id | Unverified |
| notifications | workspace_id | Yes |
| optimization_actions | workspace_id | Unverified |
| optimization_action_results | workspace_id | Unverified |
| optimization_cycles | workspace_id | Unverified |
| optimizer_configs | workspace_id | Unverified |
| rate_limit_counters | — (no scope!) | No policies |
| rate_limit_events | — | Unverified |
| release_notes | — | Unverified |
| revenue_events | tenant_id | Unverified |
| rollout_gate_checks | — | Unverified |
| rollout_phases | — | Unverified |
| rollout_tenant_assignments | — | Unverified |
| segments | workspace_id | Yes |
| slo_alerts | workspace_id | Unverified |
| slo_config | workspace_id | Unverified |
| slo_metrics | workspace_id | Unverified |
| social_integrations | workspace_id | Unverified |
| stripe_events | workspace_id | Unverified |
| team_invitations | workspace_id | Unverified |
| tenant_module_access | tenant_id | Unverified |
| tenant_rate_limits | tenant_id | Yes |
| tenant_segments | tenant_id | Yes |
| tenant_targets | tenant_id | Unverified |
| user_gmail_tokens | user_id | Unverified |
| user_password_resets | user_id | Unverified |
| worker_tick_metrics | — | Unverified |
| industry_verticals | — (public read) | Yes |

---

## 3. Findings

### CRITICAL — Plaintext Secrets in Database

**Tables affected:** `ai_settings_email`, `ai_settings_voice`, `ai_settings_social`, `ai_settings_linkedin`

| Table | Column | Risk |
|-------|--------|------|
| ai_settings_email | smtp_password | Plaintext SMTP password |
| ai_settings_voice | vapi_private_key | Plaintext API private key |
| ai_settings_voice | elevenlabs_api_key | Plaintext API key |
| ai_settings_social | (API tokens) | Likely plaintext |
| ai_settings_linkedin | (API tokens) | Likely plaintext |

**Note:** `ai_settings_stripe` correctly uses `stripe_secret_key_hint` (hint-only approach).

**Recommendation:** Move all secrets to Supabase Vault (`vault.secrets`) or encrypt at the application layer. Store only hints/masked values in the table columns.

---

### CRITICAL — Foreign Key Semantic Mismatch in ai_settings_* Tables

All `ai_settings_*` tables have:
```sql
tenant_id uuid NOT NULL PRIMARY KEY REFERENCES public.workspaces(id)
```

The column is named `tenant_id` but references `workspaces(id)`, not `tenants(id)`. This creates confusion about which ID is actually stored.

**Recommendation:** Rename `tenant_id` → `workspace_id` in all 8 `ai_settings_*` tables.

---

### HIGH — Dual tenant_id / workspace_id Inconsistency

Three patterns exist across the schema:

| Pattern | Tables | Risk |
|---------|--------|------|
| workspace_id only | leads, deals, assets, content_* | Clean — preferred |
| Both required (NOT NULL) | cmo_*, cro_*, agent_runs | Redundant — which does RLS check? |
| tenant_id only | accounts, events_raw, revenue_events | Legacy — not migrated |

**Specific risks:**
- If RLS checks only `workspace_id` but `tenant_id` is also present, a user with workspace access could see records from another tenant
- If RLS checks only `tenant_id`, workspace-scoped access won't apply
- Nullable `tenant_id` on leads/deals means these records may not be filtered by tenant policies

**Recommendation:** Complete the tenant_id deprecation (migration `20260107000003`). Ensure all RLS policies consistently use `workspace_id` via `user_has_workspace_access()`.

---

### HIGH — Tables with Incomplete RLS Policy Coverage

| Table | Issue |
|-------|-------|
| rate_limit_counters | No workspace/tenant scope, no RLS policies |
| outbound_sequence_steps | No explicit policies defined |
| cro_deal_reviews | Missing UPDATE/DELETE policies |
| cro_forecasts | Missing UPDATE/DELETE policies |
| outbound_message_events | No explicit policies defined |

---

### HIGH — ~48 Tables with "Unverified" RLS Status

The BACKUP_SCHEMA.sql covers ~70% of tables. The remaining ~30% are undocumented. Of the 119 tables, approximately 48 have unverified RLS status (see table above). These need to be checked against the live database.

---

### MEDIUM — Overly Permissive Policy

```sql
CREATE POLICY "Anyone can read verticals" ON public.industry_verticals
  FOR SELECT USING (true);
```

This allows any authenticated user to read all rows. Likely intentional for reference data but should be documented.

---

### MEDIUM — Missing Indexes on RLS-Filtered Columns

**Confirmed indexes exist for:** leads, deals, assets, campaigns (workspace_id)

**Missing or unverified indexes for:** All cmo_*, cro_*, voice_*, outbound_*, kernel_*, spine_*, slo_* tables.

RLS policies that filter on `workspace_id` without a supporting index cause full table scans on every query.

---

### MEDIUM — business_profiles Has No Workspace Scope

```sql
CREATE TABLE public.business_profiles (
  user_id uuid,        -- present
  workspace_id uuid,   -- FK exists but unclear RLS
  ...
);
```

If RLS checks `user_id` instead of `workspace_id`, team members won't see their workspace's business profile. If it checks nothing, it's wide open.

---

### LOW — Nullable Foreign Keys May Cause Orphans

| Table | Column | Issue |
|-------|--------|-------|
| leads | tenant_id | Nullable FK to tenants |
| deals | tenant_id | Nullable FK to tenants |
| deals | lead_id | Nullable FK to leads |
| tasks | deal_id | Nullable FK to deals |
| cro_deal_reviews | deal_id | Nullable FK to deals |
| voice_call_records | lead_id, voice_agent_id, phone_number_id | All nullable |

---

## 4. Views

| View | Purpose |
|------|---------|
| v_cmo_metrics_by_workspace | CMO analytics rollup |
| v_crm_pipeline_truth | CRM pipeline status |
| v_crm_conversion_funnel | Funnel conversion rates |
| v_revenue_by_workspace | Revenue analytics |
| v_data_quality_by_workspace | Data quality scoring |

---

## 5. Priority Action Items

### Immediate (P0)
1. **Encrypt secrets** — Move plaintext API keys/passwords out of ai_settings_* tables into Supabase Vault
2. **Verify live RLS** — Run `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'` against prod to confirm the 48 "unverified" tables
3. **Add missing policies** — rate_limit_counters, outbound_sequence_steps, outbound_message_events

### This Sprint (P1)
4. **Rename ai_settings tenant_id → workspace_id** — Fix the FK semantic mismatch
5. **Complete tenant_id deprecation** — Ensure all RLS policies use workspace_id consistently
6. **Add UPDATE/DELETE policies** — cro_deal_reviews, cro_forecasts

### Next Release (P2)
7. **Add indexes** — workspace_id indexes on all cmo_*, cro_*, voice_*, outbound_* tables
8. **Audit business_profiles RLS** — Ensure proper workspace scoping
9. **Document nullable FK intent** — Confirm which nullable FKs are intentional

---

## 6. Files Reviewed

| File | Lines | Content |
|------|-------|---------|
| `src/integrations/supabase/types.ts` | 10,765 | Auto-generated DB types (119 tables) |
| `docs/BACKUP_SCHEMA.sql` | ~1,460 | Schema backup (~70% coverage) |
| `docs/DATABASE_SCHEMA.md` | ~200 | Schema documentation |
| `supabase/config.toml` | 326 | Supabase project config |
| `supabase/migrations/20260107000001_critical_security_fixes.sql` | — | Security fix migration |
| `supabase/migrations/20260107000003_deprecate_tenant_id.sql` | — | Tenant deprecation |
| `supabase/migrations/20260108000020-25_lovable_schema_*.sql` | — | Schema part 1-6 |
