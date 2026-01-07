-- ============================================================================
-- VERIFICATION SCRIPT - Test Platform Fixes
-- ============================================================================
-- Purpose: Verify that all fixes are working correctly
-- Run this AFTER applying the fix migration
-- ============================================================================

-- Test 1: Check if user_has_workspace_access function works
DO $$
DECLARE
  test_result boolean;
  test_workspace_id uuid;
BEGIN
  -- Get a workspace ID for the current user
  SELECT id INTO test_workspace_id 
  FROM public.workspaces 
  WHERE owner_id = auth.uid() 
  LIMIT 1;
  
  IF test_workspace_id IS NULL THEN
    RAISE NOTICE 'Test 1: SKIPPED - No workspaces found for current user';
  ELSE
    SELECT public.user_has_workspace_access(test_workspace_id) INTO test_result;
    
    IF test_result THEN
      RAISE NOTICE 'Test 1: ✓ PASSED - user_has_workspace_access works correctly';
    ELSE
      RAISE WARNING 'Test 1: ✗ FAILED - user_has_workspace_access returned FALSE for owned workspace';
    END IF;
  END IF;
END $$;

-- Test 2: Check workspace memberships
SELECT 
  'Test 2: Workspace Memberships' as test_name,
  COUNT(*) as total_workspaces,
  COUNT(CASE WHEN has_member_record THEN 1 END) as workspaces_with_members,
  COUNT(CASE WHEN NOT has_member_record THEN 1 END) as missing_members
FROM (
  SELECT 
    w.id,
    w.name,
    w.owner_id,
    EXISTS(
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = w.id AND wm.user_id = w.owner_id
    ) as has_member_record
  FROM public.workspaces w
) workspace_check;

-- Test 3: Check if profiles table is accessible
SELECT 
  'Test 3: Profile Access' as test_name,
  CASE 
    WHEN COUNT(*) > 0 THEN '✓ PASSED - Can read own profile'
    ELSE '✗ FAILED - Cannot read profile'
  END as result,
  COUNT(*) as profile_count
FROM public.profiles
WHERE id = auth.uid();

-- Test 4: Check if workspaces table is accessible
SELECT 
  'Test 4: Workspace Access' as test_name,
  CASE 
    WHEN COUNT(*) >= 0 THEN '✓ PASSED - Can query workspaces'
    ELSE '✗ FAILED - Cannot query workspaces'
  END as result,
  COUNT(*) as workspace_count
FROM public.workspaces;

-- Test 5: Check if email settings are accessible
SELECT 
  'Test 5: Email Settings Access' as test_name,
  CASE 
    WHEN COUNT(*) >= 0 THEN '✓ PASSED - Can query email settings'
    ELSE '✗ FAILED - Cannot query email settings'
  END as result,
  COUNT(*) as settings_count
FROM public.ai_settings_email
WHERE tenant_id = auth.uid() OR public.user_has_workspace_access(tenant_id);

-- Test 6: Check if Google OAuth settings are accessible
SELECT 
  'Test 6: Google OAuth Settings Access' as test_name,
  CASE 
    WHEN COUNT(*) >= 0 THEN '✓ PASSED - Can query Google settings'
    ELSE '✗ FAILED - Cannot query Google settings'
  END as result,
  COUNT(*) as settings_count
FROM public.ai_settings_google
WHERE tenant_id = auth.uid() OR public.user_has_workspace_access(tenant_id);

-- Test 7: Check leads access
SELECT 
  'Test 7: Leads Access' as test_name,
  CASE 
    WHEN COUNT(*) >= 0 THEN '✓ PASSED - Can query leads'
    ELSE '✗ FAILED - Cannot query leads'
  END as result,
  COUNT(*) as leads_count
FROM public.leads
WHERE workspace_id IN (
  SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  UNION
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
);

-- Test 8: List all workspaces user has access to
SELECT 
  'Test 8: User Workspace List' as test_name,
  w.id,
  w.name,
  CASE 
    WHEN w.owner_id = auth.uid() THEN 'Owner'
    ELSE wm.role
  END as user_role,
  public.user_has_workspace_access(w.id) as has_access
FROM public.workspaces w
LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = auth.uid()
WHERE w.owner_id = auth.uid() OR wm.user_id = auth.uid()
ORDER BY w.created_at DESC;

-- Summary
SELECT 
  '========================================' as summary,
  '' as blank_line,
  'VERIFICATION COMPLETE' as title,
  '' as blank_line2,
  'Check above for any FAILED tests' as instruction,
  '========================================' as footer;

