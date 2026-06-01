# Schema Ground Truth & Canonical-Column Verdict

Source: live queries against linked project `ddwqkkiqgjptguzoeohr` ("AI Revenue", per `supabase/config.toml:1`), 2026-05-30. Read-only. **The generated `src/integrations/supabase/types.ts` is STALE** vs the live DB (it lacks `voice_agents.status/agent_id/use_case`, etc.) — trust the live schema below, regenerate types before fixing.

## VERDICT: there is NO single canonical column — it is per-table-family

The `workspace_id → tenant_id` (and in places the reverse) migration was applied **inconsistently at the DB level**, so each table has a definite canonical column and code must match *that table*:

| Group | Canonical col | Tables (key ones) | RLS predicate |
|---|---|---|---|
| **workspace-only** | `workspace_id` | `channel_outbox`, `campaigns`, `campaign_metrics`, `assets`, `business_profiles`, `cro_forecasts`, `cro_targets`, `cro_deal_reviews`, `email_sequences`, `email_sequence_steps`, `sequence_enrollments`, `lead_activities`, `content_calendar`, `tasks`, `notifications`, `ai_settings_voice`, `ai_settings_social`, `automation_jobs`, `cmo_*` content tables | `user_has_workspace_access(workspace_id)` |
| **tenant-only** | `tenant_id` | `kernel_events`, `kernel_actions`, `kernel_decisions`, `outbound_sequence_runs`, `outbound_sequences`, `outbound_sequence_steps`, `outbound_message_events`, `crm_activities`, `crm_leads`, `prospects`, `sequence_runs`, `ai_settings_email/domain/...`, `user_tenants`, `workspaces` | `user_belongs_to_tenant(tenant_id)` |
| **both columns (NOT NULL on both for some)** | depends on RLS (below) | `voice_agents` (both NOT NULL), `job_queue` (both NOT NULL), `deals` (ws NOT NULL-ish, tenant nullable), `leads` (ws NOT NULL, tenant nullable), `agent_runs`, `campaign_runs`, `voice_call_records`, `voice_campaigns`, `cmo_campaigns` | mixed — see notes |

### Notes on the "both" tables (these are where the bugs cluster)
- **`channel_outbox` has NO `tenant_id` column at all** — only `workspace_id NOT NULL`. RLS: `user_has_workspace_access(workspace_id)` (SELECT only; writes are service-role). → **Any code inserting `tenant_id` into `channel_outbox` errors out** (`PGRST204 column does not exist`).
- **`job_queue`**: both `tenant_id` and `workspace_id` are `NOT NULL`. RLS is **tenant-based** (`user_belongs_to_tenant(tenant_id)`), plus a `workspace_access_select`. Canonical for isolation = `tenant_id`; must still populate `workspace_id`.
- **`voice_agents`**: both `NOT NULL`. RLS has BOTH tenant and workspace policies (permissive OR). Must populate both. Live columns include `status text NOT NULL default 'active'`, `agent_id text`, `use_case text NOT NULL default 'sales_outreach'`, `provider`, `name`, `config jsonb`, `is_default`. **No** `is_active`, `provider_assistant_id`, `voice_id`, `system_prompt`, `first_message`, `description`.
- **`deals`**: `workspace_id` drives RLS (`user_has_workspace_access(workspace_id)`), `tenant_id` is nullable/legacy. Inserts via non-service client MUST set `workspace_id` or they fail the RLS WITH CHECK.
- **`kernel_events`**: `tenant_id` only. **No `status` and no `processed_at` column** (columns: id, tenant_id, type, source, entity_type, entity_id, correlation_id, payload_json, occurred_at, created_at, idempotency_key). See schema-mismatch table.

## In-flight row counts (read-only, 2026-05-30)
- `campaigns`: **263 rows in `pending_approval`** — and nothing downstream to advance them.
- `channel_outbox`: **0 rows** (empty)
- `job_queue`: **0 rows** (empty)
- `outbound_sequence_runs`: **0 rows** (empty)
- `sequence_enrollments`: **0 rows** (empty)

> The execution tables being completely empty corroborates that the outbox/enqueue path is non-functional (writes fail), so there is **no in-flight queued work to strand** — a fix can be deployed without draining a backlog. Re-run before any change lands (query in `06-queries.sql`).
