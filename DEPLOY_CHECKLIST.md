# Phase 3 Deployment Checklist

**Estimated Time**: 10 minutes  
**Dashboard**: https://supabase.com/dashboard/project/nyzgsizvtqhafoxixyrd

---

## ☑️ Step-by-Step Deployment

### 1. Database Migration (2 minutes)

- [ ] Open dashboard: https://supabase.com/dashboard/project/nyzgsizvtqhafoxixyrd
- [ ] Go to: **Database** → **SQL Editor**
- [ ] Click: **New Query**
- [ ] Copy entire contents of `DEPLOY_COPY_PASTE.sql`
- [ ] Paste into SQL Editor
- [ ] Click: **Run**
- [ ] Verify output shows: ✅ Migration successful!

**Expected Result**:
```
target_segment_codes | ARRAY | YES
target_tags          | ARRAY | YES
```

---

### 2. Deploy Edge Functions (5 minutes)

Go to: **Edge Functions** in dashboard

Deploy these 4 functions (from GitHub main branch):

- [ ] **run-job-queue**
  - Click function → Deploy
  - Select branch: `main`
  - Confirm deployment

- [ ] **campaign-schedule-outbox**
  - Click function → Deploy
  - Select branch: `main`
  - Confirm deployment

- [ ] **cmo-campaign-orchestrate**
  - Click function → Deploy
  - Select branch: `main`
  - Confirm deployment

- [ ] **ai-cmo-autopilot-build**
  - Click function → Deploy
  - Select branch: `main`
  - Confirm deployment

**Tip**: Functions should auto-pull from your GitHub repo since you just pushed to `main`.

---

### 3. Configure Twilio (Optional - 2 minutes)

Only if you want SMS channel:

- [ ] Go to: **Settings** → **Edge Functions** → **Environment Variables**
- [ ] Add variable: `TWILIO_ACCOUNT_SID` = `your_account_sid`
- [ ] Add variable: `TWILIO_AUTH_TOKEN` = `your_auth_token`
- [ ] Add variable: `TWILIO_FROM_NUMBER` = `+1234567890`
- [ ] Click: **Save**

---

### 4. Quick Smoke Test (2 minutes)

Run in **SQL Editor**:

```sql
-- Test 1: Verify schema
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'cmo_campaigns' AND column_name LIKE 'target_%';
-- Expected: target_tags, target_segment_codes

-- Test 2: Create test campaign
INSERT INTO cmo_campaigns (
  workspace_id, campaign_name, campaign_type, 
  target_tags, target_segment_codes, status
) 
SELECT 
  id, 
  'Phase 3 Verification Test', 
  'email',
  ARRAY['Test']::text[], 
  ARRAY['VIP']::text[],
  'draft'
FROM workspaces 
LIMIT 1
RETURNING id, target_tags, target_segment_codes;
-- Expected: Returns row with both arrays populated

-- Test 3: Verify functions exist
SELECT COUNT(*) as deployed_functions
FROM pg_stat_user_functions 
WHERE schemaname = 'public';
-- Expected: 10+
```

All tests pass? ✅ **Deployment complete!**

---

### 5. Full UI Test (Optional - 5 minutes)

- [ ] Open your app
- [ ] Go to Campaign Builder
- [ ] Create autopilot campaign
- [ ] Select some tags in "Target Specific Tags"
- [ ] Select some segments in "Target Specific Segments"
- [ ] Click "Build Campaign"
- [ ] Verify campaign created
- [ ] Check in database:
  ```sql
  SELECT target_tags, target_segment_codes 
  FROM cmo_campaigns 
  ORDER BY created_at DESC 
  LIMIT 1;
  ```
- [ ] Expected: Arrays contain your selected values

---

## 🎉 Deployment Complete!

Once all checkboxes are marked:

✅ Migration applied  
✅ Functions deployed  
✅ Twilio configured (optional)  
✅ Tests passing  

**Phase 3 is LIVE!** 🚀

---

## 📊 Post-Deployment Monitoring

Check these queries periodically:

```sql
-- Channel health
SELECT channel, status, count(*) 
FROM channel_outbox 
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY channel, status
ORDER BY channel, status;

-- Campaign targeting usage
SELECT 
  COUNT(CASE WHEN target_tags IS NOT NULL THEN 1 END) as with_tag_targeting,
  COUNT(CASE WHEN target_segment_codes IS NOT NULL THEN 1 END) as with_segment_targeting,
  COUNT(*) as total_campaigns
FROM cmo_campaigns
WHERE created_at > NOW() - INTERVAL '7 days';

-- Error rate
SELECT 
  channel,
  COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / COUNT(*) as error_rate_pct
FROM channel_outbox
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY channel;
```

---

## 🆘 Troubleshooting

**Migration fails**:
- Check you're connected to correct project
- Verify you have admin/owner role
- Try running SQL line-by-line

**Functions won't deploy**:
- Verify GitHub integration is connected
- Check branch name is correct (`main`)
- Try manual deploy: Upload function folder as zip

**SMS not working**:
- Verify Twilio credentials are correct
- Check Twilio account balance
- Test credentials in Twilio dashboard first

---

**Questions?** See `RELEASE_READINESS_REPORT_PHASE3.md`

