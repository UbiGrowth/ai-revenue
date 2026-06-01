# Schema ↔ Code Mismatch Table

Code reads/writes columns that do not exist in the **live** DB (`ddwqkkiqgjptguzoeohr`). Each row currently fails at runtime (PostgREST `PGRST204`/`42703`) or silently no-ops. Verified against live `information_schema.columns`.

| # | Table | Column code uses | Exists live? | Code site(s) | Effect | Fix |
|---|---|---|---|---|---|---|
| 1 | `channel_outbox` | `tenant_id` | **NO** (only `workspace_id NOT NULL`) | execute-voice-campaign 145/212/239; email-deploy 280; test-email 365; vapi-outbound-call 90; campaign-schedule-outbox 226; channel-outbox-webhook 112 | **All outbox inserts fail** → `channel_outbox` empty in prod; voice/email never queued or tracked | use `workspace_id` |
| 2 | `kernel_events` | `status`, `processed_at` | **NO** (no status/processed_at cols) | `revenue_os_kernel/runtime.ts:52` `updateEventStatus` updates `{status, processed_at}` (`as never` hides it) | Event terminal-status write **always errors** → events never marked done (compounds H-O1) | add `status`+`processed_at` columns OR track state elsewhere (decide) |
| 3 | `voice_agents` | `is_active` | **NO** (has `status` default `'active'`) | elevenlabs-auto-provision:80-81 `.eq('is_active',true)` | Existence check errors → re-provisions duplicates each run | use `status='active'` |
| 4 | `voice_agents` | `provider_assistant_id`, `voice_id`, `system_prompt`, `first_message`, `description` | **NO** (has `agent_id`, `config jsonb`) | elevenlabs-create-agent:221-239 insert | Agent insert fails → orphaned remote agent, no DB row | map provider id→`agent_id`; put the rest in `config` |
| 5 | `voice_agents` | `status` | **YES** (live) — but **stale in `types.ts`** | VoiceAgents.tsx:712 `.eq('status','active')` | Query is actually valid against live DB; the `tsc` TS2589 at VoiceAgents.tsx:711 is from the **stale generated types** missing `status` | **regenerate `types.ts`** |
| 6 | `business_profiles` | `tenant_id` | **NO** (has `user_id`, `workspace_id NOT NULL`) | send-lead-email:233-237, email-deploy:129-133 `.eq("tenant_id",…)` | Profile lookup errors/returns nothing → personalization falls back to defaults | use `workspace_id` (matches EmailOutreachDialog) |
| 7 | `campaign_metrics` | `click_count` | **NO** (column is `clicks`) | campaign-calculate-roi:55 | Email conversions read `undefined` → email ROI always 0 | use `clicks` |
| 8 | `outbound_message_events` | `metadata.email_id` (json) | metadata col exists; key never written | dispatch-outbound-sequences discards Resend id (866-876); outbound-email-webhook:85-98 matches on it | Open/click/bounce never matched → engagement dead | persist Resend `email_id` into metadata |

## Notes / things to verify before fixing
- **#2 (kernel_events.status):** the live column dump shows no `status`/`processed_at`. Confirm there isn't a separate state table or a view; if truly absent, the kernel has *never* recorded event completion. `kernel_decisions`/`kernel_actions` DO appear to carry `status` (used by `updateDecisionStatus` `{status, executed_at}` — verify `executed_at` exists too).
- **#5:** the frontend `tsc` TS2589 "excessively deep" error is a *symptom* of the stale `types.ts` (the Supabase query builder can't resolve `status` so it recurses). Regenerating types should clear it without code changes.
- `qa-execution-cert:1563` `onConflict:"tenant_id,tenant_id,idempotency_key"` — verify the real unique index name/columns on that table before trusting the upsert.
