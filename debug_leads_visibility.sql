-- ============================================
-- DEBUG: Why can't we see leads in the UI?
-- ============================================

-- Test 1: Count all leads (bypasses RLS if run as service_role)
SELECT 'Total Leads in Database' as check, COUNT(*) as count FROM leads;

-- Test 2: Check if Lovable leads exist
SELECT 'Lovable Leads Imported' as check, COUNT(*) as count FROM leads
WHERE id IN (
  '58fcdf13-6156-498b-bf2d-70211d2506c5',
  'b17b1ea5-4dd1-49b0-bbbe-b1d95af6f699',
  '0576457f-f803-4e95-8cab-16877e26ca0e',
  '5bda55fc-af7f-439e-9ba8-02b906a157f4',
  '11b9d662-aaab-4c1b-828c-2ba3b6829d0c',
  'c495afa3-eb01-4e7f-9719-7343e526a073'
);

-- Test 3: Show sample lead data
SELECT 
  'Sample Lead Data' as check,
  id,
  first_name,
  last_name,
  email,
  workspace_id
FROM leads
WHERE id = '58fcdf13-6156-498b-bf2d-70211d2506c5';

-- Test 4: Check RLS status on leads table
SELECT 
  'RLS Status on Leads Table' as check,
  relname as table_name,
  relrowsecurity as rls_enabled,
  relforcerowsecurity as rls_forced
FROM pg_class
WHERE relname = 'leads';

-- Test 5: List all workspace IDs with lead counts
SELECT 
  'Leads by Workspace' as check,
  workspace_id,
  COUNT(*) as lead_count
FROM leads
GROUP BY workspace_id
ORDER BY lead_count DESC;

-- Test 6: Check if user has workspace access
SELECT 
  'Current User Workspaces' as check,
  w.id,
  w.name,
  w.slug
FROM workspaces w
LIMIT 10;

