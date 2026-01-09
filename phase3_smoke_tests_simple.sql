-- ============================================
-- PHASE 3 SIMPLE SMOKE TESTS
-- Simplified version that works with RLS
-- ============================================

-- Test 1: Count imported leads
SELECT 'Test 1: Imported Leads' as test, COUNT(*) as count FROM leads 
WHERE id IN (
  '58fcdf13-6156-498b-bf2d-70211d2506c5',
  'b17b1ea5-4dd1-49b0-bbbe-b1d95af6f699',
  '0576457f-f803-4e95-8cab-16877e26ca0e',
  '5bda55fc-af7f-439e-9ba8-02b906a157f4',
  '11b9d662-aaab-4c1b-828c-2ba3b6829d0c',
  'c495afa3-eb01-4e7f-9719-7343e526a073'
);

-- Test 2: Count imported campaigns
SELECT 'Test 2: Imported Campaigns' as test, COUNT(*) as count FROM cmo_campaigns
WHERE id IN (
  '28c3efe2-1fb0-471a-abfb-9a2a4ec10fea',
  '8161df2a-cb5e-4415-81c7-e3d999a90f79',
  '1938621e-54de-45d8-be63-3ad571848e9c',
  '31b4760f-cdaf-4e3c-b91f-6c047f7c983f',
  '11111111-2222-3333-4444-555555555555'
);

-- Test 3: Count imported assets
SELECT 'Test 3: Imported Assets' as test, COUNT(*) as count FROM cmo_content_assets
WHERE campaign_id IN (
  '28c3efe2-1fb0-471a-abfb-9a2a4ec10fea',
  '31b4760f-cdaf-4e3c-b91f-6c047f7c983f'
);

-- Test 4: Count workspaces
SELECT 'Test 4: Workspaces' as test, COUNT(*) as count FROM workspaces;

-- Test 5: Count workspace members
SELECT 'Test 5: Workspace Members' as test, COUNT(*) as count FROM workspace_members;

-- Test 6: Show sample lead data
SELECT 'Test 6: Sample Lead Data' as test, 
  first_name || ' ' || last_name as name,
  email,
  company
FROM leads 
WHERE id = '58fcdf13-6156-498b-bf2d-70211d2506c5';

-- Test 7: Show sample campaign data
SELECT 'Test 7: Sample Campaign Data' as test,
  campaign_name,
  status
FROM cmo_campaigns
WHERE id = '28c3efe2-1fb0-471a-abfb-9a2a4ec10fea';

-- Test 8: Check tenants table exists
SELECT 'Test 8: Tenants Table' as test, 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') 
    THEN 'EXISTS' ELSE 'MISSING' END as status;

-- Test 9: Check channel_outbox exists
SELECT 'Test 9: Channel Outbox Table' as test,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channel_outbox') 
    THEN 'EXISTS' ELSE 'MISSING' END as status;

-- Test 10: Check cmo extended tables
SELECT 'Test 10: CMO Extended Tables' as test,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cmo_plan_milestones') 
    THEN 'EXISTS' ELSE 'MISSING' END as milestones,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cmo_funnel_stages') 
    THEN 'EXISTS' ELSE 'MISSING' END as stages;

