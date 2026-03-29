-- ============================================================================
-- VIBE GTM Dashboard — Phase 4: Competitive Positioning
-- Brand profiles, ICP segments, Offers
-- ============================================================================

-- ── Brand Profiles (from RevOs cmo_brand_profiles) ────────────────────────
CREATE TABLE public.brand_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  tagline text,
  mission_statement text,
  brand_voice text,
  brand_tone text,
  logo_url text,
  website_url text,
  industry text,
  unique_value_proposition text,
  brand_personality jsonb DEFAULT '[]'::jsonb,
  core_values jsonb DEFAULT '[]'::jsonb,
  brand_colors jsonb DEFAULT '{}'::jsonb,
  brand_fonts jsonb DEFAULT '{}'::jsonb,
  competitors jsonb DEFAULT '[]'::jsonb,
  key_differentiators jsonb DEFAULT '[]'::jsonb,
  messaging_pillars jsonb DEFAULT '[]'::jsonb,
  content_themes jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_brand_profiles_organization_id ON public.brand_profiles(organization_id);

-- ── ICP Segments (from RevOs cmo_icp_segments) ───────────────────────────
CREATE TABLE public.icp_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  segment_name text NOT NULL,
  segment_description text,
  company_size text,
  demographics jsonb DEFAULT '{}'::jsonb,
  psychographics jsonb DEFAULT '{}'::jsonb,
  pain_points jsonb DEFAULT '[]'::jsonb,
  goals jsonb DEFAULT '[]'::jsonb,
  buying_triggers jsonb DEFAULT '[]'::jsonb,
  objections jsonb DEFAULT '[]'::jsonb,
  preferred_channels jsonb DEFAULT '[]'::jsonb,
  content_preferences jsonb DEFAULT '{}'::jsonb,
  decision_criteria jsonb DEFAULT '[]'::jsonb,
  budget_range jsonb DEFAULT '{}'::jsonb,
  industry_verticals jsonb DEFAULT '[]'::jsonb,
  job_titles jsonb DEFAULT '[]'::jsonb,
  is_primary boolean DEFAULT false,
  priority_score integer DEFAULT 50,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.icp_segments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_icp_segments_organization_id ON public.icp_segments(organization_id);

-- ── Offers (from RevOs cmo_offers) ───────────────────────────────────────
CREATE TABLE public.offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  offer_name text NOT NULL,
  offer_type text NOT NULL,
  description text,
  features jsonb DEFAULT '[]'::jsonb,
  key_benefits jsonb DEFAULT '[]'::jsonb,
  pricing_model text,
  price_range jsonb DEFAULT '{}'::jsonb,
  competitive_positioning text,
  target_segments jsonb DEFAULT '[]'::jsonb,
  use_cases jsonb DEFAULT '[]'::jsonb,
  case_studies jsonb DEFAULT '[]'::jsonb,
  testimonials jsonb DEFAULT '[]'::jsonb,
  success_metrics jsonb DEFAULT '{}'::jsonb,
  demo_url text,
  landing_page_url text,
  launch_date date,
  status text DEFAULT 'active',
  is_flagship boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_offers_organization_id ON public.offers(organization_id);

-- ============================================================================
-- RLS Policies — Competitive Tables
-- ============================================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['brand_profiles', 'icp_segments', 'offers'] LOOP
    EXECUTE format(
      'CREATE POLICY "%1$s_select" ON public.%1$s FOR SELECT USING (user_has_org_access(organization_id) OR is_platform_admin())',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_insert" ON public.%1$s FOR INSERT WITH CHECK (user_has_org_access(organization_id))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_update" ON public.%1$s FOR UPDATE USING (user_has_org_access(organization_id))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_delete" ON public.%1$s FOR DELETE USING (user_has_org_access(organization_id) AND has_role(auth.uid(), ''admin''))',
      tbl
    );
  END LOOP;
END $$;
