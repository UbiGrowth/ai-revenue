# Phase 3 Manual Deployment Instructions

## Current Status

✅ **Code**: Pushed to `origin/main` (commit `531a3ee`)  
⚠️ **Deployment**: Requires Supabase Dashboard access or CLI token

---

## Deployment Options

### Option 1: Supabase Dashboard (Recommended)

1. **Apply Migration**
   - Go to: https://supabase.com/dashboard/project/nyzgsizvtqhafoxixyrd
   - Navigate to: Database → Migrations
   - Create new migration with this SQL:

```sql
-- Fix: Consolidate segment targeting to single canonical column
UPDATE public.cmo_campaigns
SET target_segment_codes = target_segments
WHERE target_segments IS NOT NULL 
  AND target_segment_codes IS NULL;

ALTER TABLE public.cmo_campaigns 
DROP COLUMN IF EXISTS target_segments;

COMMENT ON COLUMN public.cmo_campaigns.target_segment_codes IS 
'Array of segment codes to filter leads for this campaign. References tenant_segments.code. Leads are filtered WHERE segment_code = ANY(target_segment_codes).';

CREATE INDEX IF NOT EXISTS idx_cmo_campaigns_target_segment_codes 
ON public.cmo_campaigns USING GIN (target_segment_codes);
```

2. **Deploy Edge Functions**
   - Navigate to: Edge Functions
   - Deploy these functions from the repo:
     - `run-job-queue`
     - `campaign-schedule-outbox`
     - `cmo-campaign-orchestrate`
     - `ai-cmo-autopilot-build`

3. **Configure Twilio Secrets** (if using SMS)
   - Navigate to: Settings → Edge Functions → Environment Variables
   - Add:
     - `TWILIO_ACCOUNT_SID`
     - `TWILIO_AUTH_TOKEN`
     - `TWILIO_FROM_NUMBER`

---

### Option 2: CLI with Access Token

If you have a Supabase access token:

```bash
# Set token
$env:SUPABASE_ACCESS_TOKEN="your_token_here"

# Link project
supabase link --project-ref nyzgsizvtqhafoxixyrd

# Apply migration
supabase db push

# Deploy functions
supabase functions deploy run-job-queue
supabase functions deploy campaign-schedule-outbox
supabase functions deploy cmo-campaign-orchestrate
supabase functions deploy ai-cmo-autopilot-build
```

---

### Option 3: Direct Database Connection

If you have `psql` and database connection string:

```bash
# Apply migration
psql $DATABASE_URL -f supabase/migrations/20260108000001_fix_segment_column_confusion.sql

# Verify
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'cmo_campaigns' AND column_name LIKE 'target_%';"
```

---

## Verification After Deployment

Run these queries in SQL Editor to verify:

```sql
-- 1. Check schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cmo_campaigns' 
AND column_name LIKE 'target_%';
-- Expected: target_tags (ARRAY), target_segment_codes (ARRAY)

-- 2. Check functions deployed
SELECT * FROM pg_stat_user_functions 
WHERE funcname LIKE 'process%batch';

-- 3. Test campaign creation
INSERT INTO cmo_campaigns (
  workspace_id, campaign_name, campaign_type, 
  target_tags, target_segment_codes
) VALUES (
  '<your_workspace_id>',
  'Test Phase 3',
  'email',
  ARRAY['Hot']::text[],
  ARRAY['VIP']::text[]
) RETURNING id, target_tags, target_segment_codes;
```

---

## After Deployment: Run Smoke Tests

See `SMOKE_TEST.md` for full test suite. Quick checks:

1. Create campaign with tag targeting
2. Verify leads filtered correctly
3. Send test email
4. Send test SMS (if Twilio configured)
5. Check outbox table for entries

---

## Project Details

- **Project ID**: `nyzgsizvtqhafoxixyrd`
- **URL**: `https://nyzgsizvtqhafoxixyrd.supabase.co`
- **Dashboard**: https://supabase.com/dashboard/project/nyzgsizvtqhafoxixyrd

---

## Support

Questions? Check:
- `RELEASE_READINESS_REPORT_PHASE3.md` - Full technical details
- `PHASE3_DEPLOYMENT_GUIDE.md` - Troubleshooting
- `SMOKE_TEST.md` - Test procedures

