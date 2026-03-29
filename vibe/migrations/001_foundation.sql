-- ============================================================================
-- VIBE GTM Dashboard — Phase 1: Foundation
-- Cherry-picked from RevOs (ddwqkkiqgjptguzoeohr)
-- Target: VIBE Supabase (ptaqytvztkhjpuawdxng)
-- ============================================================================

-- ── Enums ──────────────────────────────────────────────────────────────────
CREATE TYPE public.app_role AS ENUM ('admin', 'sales', 'manager');
CREATE TYPE public.data_mode AS ENUM ('live', 'demo');

-- ── Organizations (from RevOs workspaces) ─────────────────────────────────
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  owner_id uuid NOT NULL,
  demo_mode boolean NOT NULL DEFAULT false,
  stripe_connected boolean DEFAULT false,
  analytics_connected boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ── Team Members (from RevOs workspace_members) ──────────────────────────
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_members_organization_id ON public.team_members(organization_id);

-- ── User Roles ────────────────────────────────────────────────────────────
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ── Platform Admins ───────────────────────────────────────────────────────
CREATE TABLE public.platform_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- ── Industry Verticals (public reference data) ───────────────────────────
CREATE TABLE public.industry_verticals (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  aliases text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.industry_verticals ENABLE ROW LEVEL SECURITY;

-- ── Segments ──────────────────────────────────────────────────────────────
CREATE TABLE public.segments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  criteria jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

-- ── Notifications ─────────────────────────────────────────────────────────
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  title text NOT NULL,
  message text,
  type text DEFAULT 'info',
  is_read boolean DEFAULT false,
  read_at timestamptz,
  action_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Helper Functions (adapted from RevOs)
-- ============================================================================

-- Check if current user has access to an organization
CREATE OR REPLACE FUNCTION public.user_has_org_access(p_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
  );
END;
$$;

-- Check if current user is a platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
END;
$$;

-- Check if a user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = p_role
  );
END;
$$;

-- Get all organization IDs for a user
CREATE OR REPLACE FUNCTION public.get_user_org_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
    SELECT organization_id FROM public.team_members
    WHERE user_id = p_user_id;
END;
$$;

-- ============================================================================
-- RLS Policies — Foundation
-- ============================================================================

-- Organizations: members can see their orgs
CREATE POLICY "org_select" ON public.organizations
  FOR SELECT USING (user_has_org_access(id) OR is_platform_admin());
CREATE POLICY "org_insert" ON public.organizations
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "org_update" ON public.organizations
  FOR UPDATE USING (user_has_org_access(id) AND has_role(auth.uid(), 'admin'));
CREATE POLICY "org_delete" ON public.organizations
  FOR DELETE USING (owner_id = auth.uid() OR is_platform_admin());

-- Team Members
CREATE POLICY "tm_select" ON public.team_members
  FOR SELECT USING (user_has_org_access(organization_id) OR is_platform_admin());
CREATE POLICY "tm_insert" ON public.team_members
  FOR INSERT WITH CHECK (user_has_org_access(organization_id) AND has_role(auth.uid(), 'admin'));
CREATE POLICY "tm_update" ON public.team_members
  FOR UPDATE USING (user_has_org_access(organization_id) AND has_role(auth.uid(), 'admin'));
CREATE POLICY "tm_delete" ON public.team_members
  FOR DELETE USING (user_has_org_access(organization_id) AND has_role(auth.uid(), 'admin'));

-- User Roles
CREATE POLICY "ur_select" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR is_platform_admin());
CREATE POLICY "ur_manage" ON public.user_roles
  FOR ALL USING (is_platform_admin());

-- Platform Admins
CREATE POLICY "pa_select" ON public.platform_admins
  FOR SELECT USING (user_id = auth.uid() OR is_platform_admin());

-- Industry Verticals (public read)
CREATE POLICY "iv_select" ON public.industry_verticals
  FOR SELECT USING (true);

-- Segments
CREATE POLICY "seg_select" ON public.segments
  FOR SELECT USING (user_has_org_access(organization_id));
CREATE POLICY "seg_insert" ON public.segments
  FOR INSERT WITH CHECK (user_has_org_access(organization_id));
CREATE POLICY "seg_update" ON public.segments
  FOR UPDATE USING (user_has_org_access(organization_id));
CREATE POLICY "seg_delete" ON public.segments
  FOR DELETE USING (user_has_org_access(organization_id) AND has_role(auth.uid(), 'admin'));

-- Notifications
CREATE POLICY "notif_select" ON public.notifications
  FOR SELECT USING (user_has_org_access(organization_id) AND (user_id = auth.uid() OR user_id IS NULL));
CREATE POLICY "notif_insert" ON public.notifications
  FOR INSERT WITH CHECK (user_has_org_access(organization_id));
CREATE POLICY "notif_update" ON public.notifications
  FOR UPDATE USING (user_has_org_access(organization_id) AND user_id = auth.uid());
