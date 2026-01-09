-- ============================================
-- LOVABLE DATA IMPORT VERIFICATION
-- Run this in Supabase SQL Editor
-- ============================================

-- Test 1: Verify imported leads
SELECT 
  'Imported Leads' as test_name,
  COUNT(*) as actual_count,
  6 as expected_count,
  CASE WHEN COUNT(*) = 6 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM leads 
WHERE id IN (
  '58fcdf13-6156-498b-bf2d-70211d2506c5',
  'b17b1ea5-4dd1-49b0-bbbe-b1d95af6f699',
  '0576457f-f803-4e95-8cab-16877e26ca0e',
  '5bda55fc-af7f-439e-9ba8-02b906a157f4',
  '11b9d662-aaab-4c1b-828c-2ba3b6829d0c',
  'c495afa3-eb01-4e7f-9719-7343e526a073'
)

UNION ALL

-- Test 2: Verify imported campaigns
SELECT 
  'Imported Campaigns' as test_name,
  COUNT(*) as actual_count,
  5 as expected_count,
  CASE WHEN COUNT(*) = 5 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM cmo_campaigns
WHERE id IN (
  '28c3efe2-1fb0-471a-abfb-9a2a4ec10fea',
  '8161df2a-cb5e-4415-81c7-e3d999a90f79',
  '1938621e-54de-45d8-be63-3ad571848e9c',
  '31b4760f-cdaf-4e3c-b91f-6c047f7c983f',
  '11111111-2222-3333-4444-555555555555'
)

UNION ALL

-- Test 3: Verify imported content assets
SELECT 
  'Imported Content Assets' as test_name,
  COUNT(*) as actual_count,
  6 as expected_count,
  CASE WHEN COUNT(*) = 6 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM cmo_content_assets
WHERE campaign_id IN (
  '28c3efe2-1fb0-471a-abfb-9a2a4ec10fea',
  '31b4760f-cdaf-4e3c-b91f-6c047f7c983f'
)

UNION ALL

-- Test 4: Verify workspaces
SELECT 
  'Total Workspaces' as test_name,
  COUNT(*) as actual_count,
  10 as expected_count,
  CASE WHEN COUNT(*) >= 10 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM workspaces

UNION ALL

-- Test 5: Verify tenants table exists
SELECT 
  'Tenants Table' as test_name,
  COUNT(*) as actual_count,
  0 as expected_count,
  '✅ PASS' as status
FROM tenants;

-- ============================================
-- DETAILED VIEW: Show imported data
-- ============================================

-- Imported Leads Detail
SELECT 
  '--- IMPORTED LEADS ---' as section,
  first_name || ' ' || last_name as name,
  email,
  company,
  source,
  status
FROM leads 
WHERE id IN (
  '58fcdf13-6156-498b-bf2d-70211d2506c5',
  'b17b1ea5-4dd1-49b0-bbbe-b1d95af6f699',
  '0576457f-f803-4e95-8cab-16877e26ca0e',
  '5bda55fc-af7f-439e-9ba8-02b906a157f4',
  '11b9d662-aaab-4c1b-828c-2ba3b6829d0c',
  'c495afa3-eb01-4e7f-9719-7343e526a073'
)
ORDER BY created_at;

-- Imported Campaigns Detail
SELECT 
  '--- IMPORTED CAMPAIGNS ---' as section,
  campaign_name,
  campaign_type,
  status,
  workspace_id
FROM cmo_campaigns
WHERE id IN (
  '28c3efe2-1fb0-471a-abfb-9a2a4ec10fea',
  '8161df2a-cb5e-4415-81c7-e3d999a90f79',
  '1938621e-54de-45d8-be63-3ad571848e9c',
  '31b4760f-cdaf-4e3c-b91f-6c047f7c983f',
  '11111111-2222-3333-4444-555555555555'
)
ORDER BY created_at;

-- Imported Content Assets Detail
SELECT 
  '--- IMPORTED CONTENT ASSETS ---' as section,
  title,
  content_type,
  channel,
  status
FROM cmo_content_assets
WHERE campaign_id IN (
  '28c3efe2-1fb0-471a-abfb-9a2a4ec10fea',
  '31b4760f-cdaf-4e3c-b91f-6c047f7c983f'
)
ORDER BY created_at;

