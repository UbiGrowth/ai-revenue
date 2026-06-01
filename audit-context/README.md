# /audit-context — Fix-Prep Package for Revos

Read-only gather for the four-subsystem audit (email, reporting, voice, orchestration). Nothing in the app was changed. Live data is from Supabase project **`ddwqkkiqgjptguzoeohr` ("AI Revenue")**, the repo's linked project (`supabase/config.toml:1`), captured 2026-05-30.

## Start here — the two decisions that gate every fix

**1. tenant vs workspace → there is NO global canonical column; it is per-table.** See `analysis/01-canonical-column-and-schema-truth.md`.
- `channel_outbox`, `campaigns`, `campaign_metrics`, `cro_*`, `business_profiles`, `email_sequences`, `ai_settings_voice`, most `cmo_*` → **`workspace_id`** (RLS: `user_has_workspace_access`).
- `kernel_*`, `outbound_*`, `crm_*`, `prospects`, `workspaces` → **`tenant_id`** (RLS: `user_belongs_to_tenant`).
- `voice_agents`, `job_queue`, `deals`, `leads` → carry **both** (often both NOT NULL); populate both, isolate on the column the RLS policy names.
- **Headline:** `channel_outbox` has **no `tenant_id` column at all**. The code that inserts `tenant_id` into it (6 functions) fails every call → the table is **empty in prod** and voice/email is never queued or tracked. The "duplicate `tenant_id` key" the original audit saw is a symptom; the real fix is `tenant_id → workspace_id`.

**2. Voice provider → the UI is a Vapi app with an ElevenLabs agent-list grafted on.** See `analysis/voice-provider-map.txt`.
- `VoiceAgents.tsx` invokes `elevenlabs-list-agents` for the list, but **every call/manage/analytics action invokes Vapi functions** (`vapi-outbound-call`, `execute-voice-campaign`, `vapi-manage-assistant`, `vapi-analytics`, `vapi-list-calls`).
- All live calling requires `VAPI_PRIVATE_KEY` (12 functions). ElevenLabs is wired only for list/create/test (+ a dead `elevenlabs-make-call` hitting a non-existent endpoint). `run-job-queue` is the only worker with both provider paths — and `job_queue` is empty.
- Decision needed: **finish on ElevenLabs** (rewrite call path + add result webhook) **or revert to Vapi** (stop telling users to delete the key). Don't ship half.

## Contents
```
analysis/
  01-canonical-column-and-schema-truth.md   ← per-table canonical col, RLS, in-flight counts
  02-rename-true-positives.md               ← Tier A hard errors / B wrong-column / C wrong-value / D harmless
  03-schema-mismatch-table.md               ← 8 columns code uses that don't exist live
  06-queries.sql                            ← re-runnable read-only counts (run before any fix)
  env-inventory.txt                         ← all env var names + the GOOGLE_CLIENT_ID vs GOOGLE_OAUTH_CLIENT_ID drift
  voice-provider-map.txt                    ← Vapi vs ElevenLabs callers, what the UI invokes
  typecheck.txt / eslint-src.txt            ← build truth (2 tsc errors; 223 eslint errors in src)
  rename-hard-errors.txt / rename-dup-keys-values.txt / kernel-status-check.txt / channel_outbox-writers.txt
sources/{email,voice,reporting,orchestration,hooks-build}/   ← full source of every audited file
```

## Build truth (captured)
- `tsc -p tsconfig.app.json`: **2 errors** — `MondayLeadConverter.tsx:3` missing `xlsx` dep; `VoiceAgents.tsx:711` TS2589 (symptom of **stale `types.ts`** missing `voice_agents.status`).
- `eslint src`: **223 errors / 79 warnings** — incl. `rules-of-hooks` at `useCMOOptimistic.ts:29,31`.
- **Regenerate `src/integrations/supabase/types.ts` first** — it is stale vs live and is what produces TS2589.

## Cron / webhooks / auth (see config + migrations)
- `verify_jwt=false` (rely on internal-secret/svix): all email & outbound webhooks, `email-sequence`, `dispatch-outbound-sequences`, `cron-daily-automation`, `cmo-optimizer-cron`, `cmo-cron-weekly`, `daily-automation`, `run-job-queue`, `ai-cmo-voice-step-run`, `test-email`, `auto-setup-voice` is plain (no verify).
- pg_cron jobs live in `supabase/migrations` (`run_job_queue_cron`, `dispatch_outbound_cron`) calling edge functions via `net.http_post`; cleanup jobs in `20260107000002_performance_optimizations.sql`.
- Hardcoded secret fallbacks remain in source: `INTERNAL_FUNCTION_SECRET || 'ubigrowth-internal-2024'`, `CRON_SECRET='cron-dispatch-secret-2024'`; `cron-daily-automation`/`cmo-optimizer-cron` also accept `body.cron===true` with no secret.

## Couldn't locate / ambiguous (flagged honestly)
- **`kernel_events.status`/`processed_at`**: not in live schema. Either a state table/view exists that wasn't found, or the kernel never persisted completion. Verify before "fixing" H-O1.
- **`campaign-schedule-outbox` insert target**: assumed `channel_outbox` by name; confirm the table on line 226 before applying the `workspace_id` change.
- **`qa-execution-cert` upsert** `onConflict:"tenant_id,tenant_id,idempotency_key"`: needs the real unique-index definition to fix correctly.
- A stray Supabase URL `nyzgsizvtqhafoxixyrd.supabase.co` appears in repo text; the authoritative linked project is `ddwqkkiqgjptguzoeohr` per `config.toml`. Confirm prod `VITE_SUPABASE_URL` matches before trusting counts.
