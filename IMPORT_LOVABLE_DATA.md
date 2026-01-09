# Import Lovable Cloud Data to Phase 3 Database

## ⚠️ IMPORTANT NOTES

1. **Phase 3 Compatibility**: The export uses `tenant_id` in `ai_settings_email` and `ai_settings_voice`, but Phase 3 migrated these to `workspace_id`
2. **Data is from Lovable Cloud** (old database `nyzgsizvtqhafoxixyrd`)
3. **Target is Phase 3 database** (`ddwqkkiqgjptguzoeohr`)

---

## 🔍 Pre-Import Checklist

- [ ] Backup current Phase 3 database (just in case)
- [ ] Verify no duplicate workspace IDs
- [ ] Check that referenced user IDs exist in `auth.users`

---

## 📋 Import Steps

### Option 1: Via Supabase SQL Editor (RECOMMENDED)

1. **Go to SQL Editor**:
   https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/sql

2. **Run Pre-Import Check**:
```sql
-- Check existing workspaces (to avoid conflicts)
SELECT id, name, slug FROM workspaces;

-- Check if UUIDs from export already exist
SELECT COUNT(*) FROM workspaces 
WHERE id IN (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '245f7faf-0fab-47ea-91b2-16ef6830fb8a',
  '81dc2cb8-67ae-4608-9987-37ee864c87b0'
);
-- Should return 0 if no conflicts
```

3. **Import Base Data** (Copy sections from FULL_DATA_EXPORT.sql):
   - ✅ `workspaces` (lines 21-32)
   - ✅ `workspace_members` (lines 37-50)
   - ✅ `industry_verticals` (lines 95-129) - Reference data
   - ✅ `cmo_brand_profiles` (lines 55-58)
   - ✅ `cmo_icp_segments` (lines 63-67)
   - ✅ `cmo_offers` (lines 72-74)
   - ✅ `cmo_funnels` (lines 79-83)
   - ✅ `cmo_marketing_plans` (lines 88-90)

4. **Import AI Settings** (⚠️ **MODIFIED for Phase 3**):
   
```sql
-- ai_settings_email (uses workspace_id in Phase 3, not tenant_id)
INSERT INTO ai_settings_email (workspace_id, email_provider, from_address, reply_to_address, sender_name, is_connected, updated_at) VALUES
('4161ee82-be97-4fa8-9017-5c40be3ebe19', 'resend', 'bill@ubigrowth.ai', 'bill@ubigrowth.com', 'Bill Lupo', true, '2026-01-06 23:53:13.147+00'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'resend', '', '', '', true, '2025-12-21 06:22:00.363088+00'),
('245f7faf-0fab-47ea-91b2-16ef6830fb8a', 'resend', '', '', '', true, '2025-12-21 06:22:00.363088+00'),
('4d120e41-2235-4392-baad-61538e200ca7', 'resend', 'joshua@plantpr.com', 'joshua@plantpr.com', 'Joshua Plant', true, '2025-12-21 06:22:00.363088+00'),
('b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'resend', 'omid+aicmo@ubigrowth.com', 'omid+aicmoreply@ubigrowth.com', 'Omid from AI CMO', true, '2025-12-21 06:22:00.363088+00'),
('81dc2cb8-67ae-4608-9987-37ee864c87b0', 'resend', 'steve@brainsurgeryteam.com', 'sblaising@brainsurgeryinc.com', 'Brain Surgery Inc', true, '2026-01-05 14:41:01.073+00')
ON CONFLICT (workspace_id) DO NOTHING;

-- ai_settings_voice (uses workspace_id in Phase 3, not tenant_id)
INSERT INTO ai_settings_voice (workspace_id, voice_provider, default_elevenlabs_voice_id, elevenlabs_model, is_connected, updated_at) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'vapi', 'EXAVITQu4vr4xnSDxMaL', 'eleven_multilingual_v2', true, '2025-12-21 06:19:28.623483+00'),
('245f7faf-0fab-47ea-91b2-16ef6830fb8a', 'vapi', 'EXAVITQu4vr4xnSDxMaL', 'eleven_multilingual_v2', true, '2025-12-21 06:19:28.623483+00'),
('81dc2cb8-67ae-4608-9987-37ee864c87b0', 'vapi', 'EXAVITQu4vr4xnSDxMaL', 'eleven_multilingual_v2', true, '2025-12-21 06:19:28.623483+00'),
('b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'vapi', 'EXAVITQu4vr4xnSDxMaL', 'eleven_multilingual_v2', true, '2025-12-21 06:19:28.623483+00'),
('4d120e41-2235-4392-baad-61538e200ca7', 'vapi', 'EXAVITQu4vr4xnSDxMaL', 'eleven_multilingual_v2', true, '2025-12-21 06:19:28.623483+00'),
('4161ee82-be97-4fa8-9017-5c40be3ebe19', 'vapi', 'EXAVITQu4vr4xnSDxMaL', 'eleven_multilingual_v2', true, '2026-01-05 23:10:11.356+00')
ON CONFLICT (workspace_id) DO NOTHING;
```

5. **Import CRM Data**:
   - ✅ `email_sequences` (lines 134-137)
   - ✅ `email_sequence_steps` (lines 142-149)
   - ✅ `sequence_enrollments` (lines 154-157)
   - ✅ `deals` (lines 162-167)
   - ✅ `tasks` (lines 172-176)
   - ✅ `prospects` (lines 218-223)
   - ✅ `campaign_metrics` (lines 205-213)

6. **Verify Import**:
```sql
-- Check imported data
SELECT 'workspaces' as table_name, COUNT(*) as count FROM workspaces
UNION ALL
SELECT 'workspace_members', COUNT(*) FROM workspace_members
UNION ALL
SELECT 'cmo_brand_profiles', COUNT(*) FROM cmo_brand_profiles
UNION ALL
SELECT 'cmo_icp_segments', COUNT(*) FROM cmo_icp_segments
UNION ALL
SELECT 'ai_settings_email', COUNT(*) FROM ai_settings_email
UNION ALL
SELECT 'ai_settings_voice', COUNT(*) FROM ai_settings_voice;
```

---

### Option 2: Via Supabase CLI (Automated)

```powershell
# Run the import (after creating adjusted SQL file)
cd "C:\Users\bill\.cursor\ubigrowth-marketing-hub"
psql $DATABASE_URL -f "FULL_DATA_EXPORT_PHASE3.sql"
```

---

## ⚠️ Known Issues & Fixes

### Issue 1: `tenant_id` vs `workspace_id`
**Problem**: Export uses `tenant_id` in ai_settings tables, but Phase 3 uses `workspace_id`  
**Fix**: Replace column names in AI settings sections (see step 4 above)

### Issue 2: Missing User References
**Problem**: Some `owner_id` or `created_by` UUIDs might not exist in target database  
**Fix**: Either:
- Create placeholder users first
- Use `ON CONFLICT DO NOTHING` to skip orphaned records

### Issue 3: Large Tables Not Included
**Problem**: Leads, campaigns, assets not in export  
**Fix**: Export separately from Lovable Cloud:
```sql
-- Run in Lovable Cloud SQL Editor
COPY (SELECT * FROM leads) TO '/tmp/leads.csv' CSV HEADER;
COPY (SELECT * FROM cmo_campaigns) TO '/tmp/cmo_campaigns.csv' CSV HEADER;
```

---

## 📊 Expected Result

After import, you should have:
- ✅ 10 workspaces from Lovable Cloud
- ✅ All CMO data (brand profiles, ICPs, offers, funnels, plans)
- ✅ Email sequences and enrollments
- ✅ AI provider settings configured
- ✅ CRM data (deals, tasks, prospects)
- ✅ Reference data (industry verticals)

---

## 🔄 Next Steps After Import

1. **Import Large Tables** (leads, campaigns, assets) via CSV
2. **Verify Workspace Access** - Ensure users can see their workspaces
3. **Test Phase 3 Features**:
   - Create a campaign with tag/segment targeting
   - Send test email/SMS
   - Check CRM leads list

---

## 🆘 Rollback (If Needed)

```sql
-- Delete imported data (be careful!)
DELETE FROM workspace_members WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE created_at > '2026-01-07'
);
DELETE FROM workspaces WHERE created_at > '2026-01-07';
-- ... repeat for other tables
```

