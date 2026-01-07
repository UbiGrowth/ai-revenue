-- ============================================================================
-- PLATFORM FIXES - Address OAuth, Email, and Access Issues
-- ============================================================================
-- Purpose: Fix issues introduced by today's migrations
-- Date: January 7, 2026
-- Priority: URGENT HOTFIX
-- ============================================================================

-- ============================================================================
-- 1. ENSURE ALL WORKSPACE OWNERS ARE IN workspace_members TABLE
-- ============================================================================
-- This is critical for RLS policies to work correctly

INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
SELECT 
  w.id as workspace_id,
  w.owner_id as user_id,
  'owner' as role,
  COALESCE(w.created_at, NOW()) as joined_at
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_members wm
  WHERE wm.workspace_id = w.id AND wm.user_id = w.owner_id
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- ============================================================================
-- 2. FIX user_has_workspace_access FUNCTION
-- ============================================================================
-- Ensure it checks BOTH ownership AND membership properly

CREATE OR REPLACE FUNCTION public.user_has_workspace_access(_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  has_access boolean;
  current_user_id uuid;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- If no user is authenticated, deny access
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is platform admin
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = current_user_id AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is workspace owner (bypasses RLS with SECURITY DEFINER)
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = current_user_id
  ) INTO has_access;
  
  IF has_access THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is workspace member
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = current_user_id
  ) INTO has_access;
  
  RETURN COALESCE(has_access, FALSE);
END;
$$;

-- ============================================================================
-- 3. ENSURE INTEGRATION SETTINGS TABLES HAVE PROPER RLS
-- ============================================================================
-- These tables need to allow authenticated users to read/write their own settings

-- ai_settings_google (for Gmail OAuth)
ALTER TABLE public.ai_settings_google ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select_google_settings" ON public.ai_settings_google;
DROP POLICY IF EXISTS "workspace_insert_google_settings" ON public.ai_settings_google;
DROP POLICY IF EXISTS "workspace_update_google_settings" ON public.ai_settings_google;
DROP POLICY IF EXISTS "workspace_delete_google_settings" ON public.ai_settings_google;

CREATE POLICY "workspace_select_google_settings"
  ON public.ai_settings_google FOR SELECT
  USING (
    -- Allow if user has workspace access via tenant_id
    public.user_has_workspace_access(tenant_id)
    -- OR if this is their user_id (for backward compatibility)
    OR tenant_id = auth.uid()
  );

CREATE POLICY "workspace_insert_google_settings"
  ON public.ai_settings_google FOR INSERT
  WITH CHECK (
    public.user_has_workspace_access(tenant_id)
    OR tenant_id = auth.uid()
  );

CREATE POLICY "workspace_update_google_settings"
  ON public.ai_settings_google FOR UPDATE
  USING (
    public.user_has_workspace_access(tenant_id)
    OR tenant_id = auth.uid()
  );

CREATE POLICY "workspace_delete_google_settings"
  ON public.ai_settings_google FOR DELETE
  USING (
    public.user_has_workspace_access(tenant_id)
    OR tenant_id = auth.uid()
  );

-- ai_settings_email (for test email functionality)
ALTER TABLE public.ai_settings_email ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select_email_settings" ON public.ai_settings_email;
DROP POLICY IF EXISTS "workspace_insert_email_settings" ON public.ai_settings_email;
DROP POLICY IF EXISTS "workspace_update_email_settings" ON public.ai_settings_email;
DROP POLICY IF EXISTS "workspace_delete_email_settings" ON public.ai_settings_email;

CREATE POLICY "workspace_select_email_settings"
  ON public.ai_settings_email FOR SELECT
  USING (
    public.user_has_workspace_access(tenant_id)
    OR tenant_id = auth.uid()
  );

CREATE POLICY "workspace_insert_email_settings"
  ON public.ai_settings_email FOR INSERT
  WITH CHECK (
    public.user_has_workspace_access(tenant_id)
    OR tenant_id = auth.uid()
  );

CREATE POLICY "workspace_update_email_settings"
  ON public.ai_settings_email FOR UPDATE
  USING (
    public.user_has_workspace_access(tenant_id)
    OR tenant_id = auth.uid()
  );

CREATE POLICY "workspace_delete_email_settings"
  ON public.ai_settings_email FOR DELETE
  USING (
    public.user_has_workspace_access(tenant_id)
    OR tenant_id = auth.uid()
  );

-- ============================================================================
-- 4. FIX PROFILES TABLE RLS
-- ============================================================================
-- Ensure users can always read their own profile (needed for role checks)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;

CREATE POLICY "users_select_own_profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users_update_own_profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "users_insert_own_profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ============================================================================
-- 5. ENSURE WORKSPACES TABLE HAS PROPER RLS
-- ============================================================================

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can view workspaces" ON public.workspaces;

CREATE POLICY "users_select_workspaces"
  ON public.workspaces FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users_insert_workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "users_update_workspaces"
  ON public.workspaces FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 6. ENSURE workspace_members TABLE HAS PROPER RLS
-- ============================================================================

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can manage workspace members" ON public.workspace_members;

CREATE POLICY "users_select_workspace_members"
  ON public.workspace_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
    OR workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "users_insert_workspace_members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
    OR workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "users_update_workspace_members"
  ON public.workspace_members FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
    OR workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "users_delete_workspace_members"
  ON public.workspace_members FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
    OR workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 7. ADD MISSING INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_workspace 
  ON public.workspace_members(user_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner 
  ON public.workspaces(owner_id);

CREATE INDEX IF NOT EXISTS idx_ai_settings_google_tenant 
  ON public.ai_settings_google(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_settings_email_tenant 
  ON public.ai_settings_email(tenant_id);

-- ============================================================================
-- 8. DIAGNOSTIC OUTPUT
-- ============================================================================

DO $$
DECLARE
  workspace_count integer;
  member_count integer;
  orphaned_count integer;
BEGIN
  -- Count workspaces
  SELECT COUNT(*) INTO workspace_count FROM public.workspaces;
  
  -- Count workspace members
  SELECT COUNT(*) INTO member_count FROM public.workspace_members;
  
  -- Count workspace owners not in members table (should be 0 after fix)
  SELECT COUNT(*) INTO orphaned_count
  FROM public.workspaces w
  WHERE NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = w.id AND wm.user_id = w.owner_id
  );
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PLATFORM FIX MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total workspaces: %', workspace_count;
  RAISE NOTICE 'Total workspace members: %', member_count;
  RAISE NOTICE 'Orphaned workspace owners: %', orphaned_count;
  RAISE NOTICE '========================================';
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Some workspace owners are still not in workspace_members table!';
  ELSE
    RAISE NOTICE '✓ All workspace owners are properly added to workspace_members';
  END IF;
END $$;

