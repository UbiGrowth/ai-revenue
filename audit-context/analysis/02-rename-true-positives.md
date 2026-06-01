# `workspace_id → tenant_id` Rename — Definitive Classification

Method: grep of all `supabase/functions/**/index.ts` for duplicate `tenant_id`/`tenantId` object keys, destructurings, const/param bindings, plus cross-check against the **live schema** (which column each target table actually has). Raw data: `rename-dup-keys-values.txt`, `rename-hard-errors.txt`.

Edge functions are Deno/esbuild-bundled (NOT covered by the frontend `tsc`), so **duplicate object-literal keys do NOT fail to build** (last key wins at runtime). Only duplicate *bindings* (destructuring/const/param) are hard SyntaxErrors. Wrong *column names* fail at runtime via PostgREST.

---

## TIER A — Hard errors: function cannot load/parse (FIX FIRST)
Duplicate binding in the same scope = `SyntaxError: Identifier has already been declared`.

| File:line | Construct | Evidence |
|---|---|---|
| `cmo-campaign-orchestrate/index.ts:799` | `const { tenant_id, tenant_id, ... } = input` | dup destructuring |
| `cmo-campaign-orchestrate/index.ts:837` | `const tenantId = tenant_id \|\| tenant_id` | (depends on 799) |
| `cmo-optimizer/index.ts:83` | `const { tenant_id, tenant_id, ... } = input` | dup destructuring |
| `cmo-voice-agent-builder/index.ts:49` | `const { tenant_id, tenant_id, ... } = input` | dup destructuring |
| `outbound-prospect-intel/index.ts:72` | `const { tenant_id, tenant_id, ... } = await req.json()` | dup destructuring |
| `infrastructure-test-runner/index.ts:319-320` | two `const tenantId = body.tenant_id;` | dup const |
| `infrastructure-test-runner/index.ts:230` | `validateIds(row, tenantId: string, tenantId: string)` | dup param name |
| `email-deploy/index.ts:103 + 258` | `const tenantId` redeclared; `:258` self-refs in initializer | dup const + TDZ (audit C-E2) |
| `crm-email-reply-webhook/index.ts:277-282` | `recordReplyAnalytics(..., tenantId, tenantId?)` dup param | audit C-E3 |

**False positives (different scopes — NOT errors, leave alone):** `ai-cmo-voice-agents:50/95`, `google-oauth:106/163` (two declarations in separate functions/branches).

---

## TIER B — Wrong column written: runtime `PGRST204 column does not exist` (FIX with `tenant_id → workspace_id`)
These insert/select `tenant_id` on **`channel_outbox`, which has only `workspace_id` (NOT NULL)**. They currently fail every call (and omit the required `workspace_id`). This is why `channel_outbox` is empty in prod.

| File:line | Op | Required change |
|---|---|---|
| `execute-voice-campaign/index.ts:145-146, 212-213, 239-240` | insert channel_outbox | `tenant_id` → `workspace_id` (single key) |
| `email-deploy/index.ts:280-281` | insert channel_outbox | `tenant_id` → `workspace_id` |
| `test-email/index.ts:365-366` | insert channel_outbox | `tenant_id` → `workspace_id` |
| `vapi-outbound-call/index.ts:90-91` | insert channel_outbox | `tenant_id` → `workspace_id` (note: 91 already holds the workspace id) |
| `campaign-schedule-outbox/index.ts:226-227` | insert channel_outbox (verify target) | `tenant_id` → `workspace_id` |
| `channel-outbox-webhook/index.ts:112, 149-150` | `select("...tenant_id, tenant_id...")` from channel_outbox | drop tenant_id, use `workspace_id` |

> `execute-voice-campaign:168` (crm_activities) and `:281` are different tables — `crm_activities` IS tenant-only, so `tenant_id` there is correct. Verify each line's target table before editing.

---

## TIER C — Different-value duplicate key: silent wrong value (the 2nd overrides the 1st)
On tables where `tenant_id` *does* exist, the second key wins and the first is discarded.

| File:line | Keys (2nd wins) |
|---|---|
| `outbound-dispatch-due/index.ts:182-183` | `run.tenant_id` then `campaign?.tenant_id` |
| `vapi-outbound-call/index.ts:90-91` | `effectiveTenantId` then `effectiveWorkspaceId` (also Tier B) |
| `execute-voice-campaign/index.ts:145/212/239` | `effectiveTenantId` then `asset.tenant_id` (also Tier B) |
| `campaign-schedule-outbox/index.ts:226-227` | `tenantId` then `campaign.tenant_id` (also Tier B) |
| `qa-execution-cert/index.ts:1563` | `onConflict:"tenant_id,tenant_id,idempotency_key"` (dup conflict target) |
| `qa-execution-cert/index.ts:953` | `select("id, tenant_id, tenant_id, ...")` |
| `cmo-optimizer-cron/index.ts:44` | `select("id, tenant_id, tenant_id, ...")` |

---

## TIER D — Same-value duplicate key: harmless at runtime, lint/smell only (low priority)
Both keys hold the identical value, so behavior is unaffected; clean up opportunistically.

`cmo-launch-campaign:82-83,142-143` · `cmo-kernel:107-108` · `cmo-webhook-outbound:133-134` · `cmo-generate-content:89-90,147-148` · `cmo-summarize-weekly:169-170,194-195` · `cmo-generate-funnel:84-85,146-147` · `cmo-create-plan:75-76,113-114` · `ai-cmo-autopilot-build:209-299 (multiple)` · `cmo-campaign-orchestrate:299/413/461/513/569/626/753/944 (tenantId/tenantId)` · `test-email:365-366` (also Tier B) · `infrastructure-test-runner` (many) · `qa-execution-cert` (many) · `channel-outbox-webhook:149-150` (also Tier B context)

TS interface duplicate members (only matter if ever tsc'd; Deno ignores): `infrastructure-test-runner:73-74`, `qa-execution-cert:941-942`.
