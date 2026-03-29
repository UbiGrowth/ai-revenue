-- ============================================================================
-- VIBE GTM Dashboard — Phase 2: Phase 0 Scorecard
-- Deals, Campaigns, CRO, Revenue Views
-- ============================================================================

-- ── Deals ─────────────────────────────────────────────────────────────────
CREATE TABLE public.deals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid, -- FK added after leads table exists
  name text NOT NULL,
  value numeric DEFAULT 0,
  stage text NOT NULL DEFAULT 'prospecting',
  status text,
  source text NOT NULL DEFAULT 'user',
  probability integer DEFAULT 10,
  notes text,
  expected_close_date date,
  actual_close_date date,
  owner_id uuid,
  created_by uuid,
  revenue_verified boolean NOT NULL DEFAULT false,
  stripe_payment_id text,
  closed_won_at timestamptz,
  won_at timestamptz,
  lost_at timestamptz,
  data_mode data_mode NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deals_organization_id ON public.deals(organization_id);
CREATE INDEX idx_deals_stage ON public.deals(stage);
CREATE INDEX idx_deals_data_mode ON public.deals(data_mode);

-- ── Campaigns ─────────────────────────────────────────────────────────────
CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  deployed_at timestamptz,
  target_audience jsonb,
  budget_allocated numeric DEFAULT 0,
  external_campaign_id text,
  is_locked boolean DEFAULT false,
  locked_at timestamptz,
  locked_reason text,
  schedule jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_campaigns_organization_id ON public.campaigns(organization_id);

-- ── Campaign Metrics ──────────────────────────────────────────────────────
CREATE TABLE public.campaign_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  engagement_rate numeric DEFAULT 0,
  cost numeric DEFAULT 0,
  revenue numeric DEFAULT 0,
  roi numeric DEFAULT 0,
  open_count integer DEFAULT 0,
  bounce_count integer DEFAULT 0,
  unsubscribe_count integer DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_campaign_metrics_organization_id ON public.campaign_metrics(organization_id);

-- ── Stripe Events (for revenue verification) ─────────────────────────────
CREATE TABLE public.stripe_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  stripe_event_id text UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_mode data_mode NOT NULL DEFAULT 'live',
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stripe_events_organization_id ON public.stripe_events(organization_id);

-- ── AI Settings: Stripe (hint-only, no plaintext secrets) ────────────────
CREATE TABLE public.ai_settings_stripe (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  is_connected boolean DEFAULT false,
  stripe_secret_key_hint text, -- last 4 chars only, actual key in Vault
  stripe_publishable_key text,
  stripe_webhook_secret_hint text, -- last 4 chars only, actual key in Vault
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_settings_stripe ENABLE ROW LEVEL SECURITY;

-- ── CRO Targets ──────────────────────────────────────────────────────────
CREATE TABLE public.cro_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period text NOT NULL,
  owner_type text NOT NULL,
  owner_id text NOT NULL,
  target_new_arr numeric DEFAULT 0,
  target_pipeline numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.cro_targets ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cro_targets_organization_id ON public.cro_targets(organization_id);

-- ── CRO Forecasts ────────────────────────────────────────────────────────
CREATE TABLE public.cro_forecasts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period text NOT NULL,
  scenario text NOT NULL,
  forecast_new_arr numeric DEFAULT 0,
  confidence numeric DEFAULT 0.5,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.cro_forecasts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cro_forecasts_organization_id ON public.cro_forecasts(organization_id);

-- ── CRO Deal Reviews ────────────────────────────────────────────────────
CREATE TABLE public.cro_deal_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id),
  review_type text NOT NULL DEFAULT 'standard',
  score integer DEFAULT 50,
  summary_md text,
  risks text,
  next_steps text,
  reviewed_by uuid,
  reviewed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.cro_deal_reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cro_deal_reviews_organization_id ON public.cro_deal_reviews(organization_id);

-- ── CRO Recommendations ──────────────────────────────────────────────────
CREATE TABLE public.cro_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  severity text DEFAULT 'medium',
  source_type text,
  source_id text,
  status text DEFAULT 'pending',
  suggested_actions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.cro_recommendations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cro_recommendations_organization_id ON public.cro_recommendations(organization_id);

-- ============================================================================
-- RLS Policies — Scorecard Tables
-- ============================================================================

-- Standard org-scoped policy macro (SELECT/INSERT/UPDATE/DELETE)
-- Applied to: deals, campaigns, campaign_metrics, stripe_events, ai_settings_stripe,
--             cro_targets, cro_forecasts, cro_deal_reviews, cro_recommendations

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'deals', 'campaigns', 'campaign_metrics', 'stripe_events',
    'ai_settings_stripe', 'cro_targets', 'cro_forecasts',
    'cro_deal_reviews', 'cro_recommendations'
  ] LOOP
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

-- ============================================================================
-- Views — Scorecard (adapted from RevOs, workspace_id → organization_id)
-- ============================================================================

-- Pipeline truth: revenue-gated by Stripe verification
CREATE OR REPLACE VIEW public.v_pipeline_truth AS
WITH org AS (
  SELECT
    o.id AS organization_id,
    o.demo_mode,
    o.stripe_connected,
    CASE WHEN o.demo_mode THEN 'demo'::public.data_mode ELSE 'live'::public.data_mode END AS required_mode
  FROM public.organizations o
),
deal_stats AS (
  SELECT
    d.organization_id,
    d.stage,
    COUNT(*) AS deal_count,
    SUM(d.value) AS total_value,
    SUM(CASE WHEN d.revenue_verified THEN d.value ELSE 0 END) AS verified_value,
    COUNT(*) FILTER (WHERE d.revenue_verified) AS verified_count
  FROM public.deals d
  JOIN org ON org.organization_id = d.organization_id AND org.required_mode = d.data_mode
  GROUP BY d.organization_id, d.stage
)
SELECT
  org.organization_id,
  org.demo_mode,
  org.stripe_connected,
  COALESCE(SUM(ds.total_value) FILTER (WHERE ds.stage NOT IN ('closed_won', 'closed_lost')), 0) AS pipeline_value,
  COALESCE(SUM(ds.deal_count) FILTER (WHERE ds.stage NOT IN ('closed_won', 'closed_lost')), 0) AS pipeline_count,
  CASE
    WHEN org.demo_mode THEN COALESCE(SUM(ds.total_value) FILTER (WHERE ds.stage = 'closed_won'), 0)
    WHEN NOT org.stripe_connected THEN 0
    ELSE COALESCE(SUM(ds.verified_value) FILTER (WHERE ds.stage = 'closed_won'), 0)
  END AS won_revenue,
  COALESCE(SUM(ds.deal_count) FILTER (WHERE ds.stage = 'closed_won'), 0) AS won_count,
  COALESCE(SUM(ds.verified_count) FILTER (WHERE ds.stage = 'closed_won'), 0) AS verified_won_count,
  COALESCE(SUM(ds.total_value) FILTER (WHERE ds.stage = 'closed_lost'), 0) AS lost_value,
  COALESCE(SUM(ds.deal_count) FILTER (WHERE ds.stage = 'closed_lost'), 0) AS lost_count,
  CASE
    WHEN org.demo_mode THEN 'DEMO_MODE'
    WHEN NOT org.stripe_connected THEN 'NO_STRIPE_CONNECTED'
    ELSE 'LIVE_OK'
  END AS data_quality_status
FROM org
LEFT JOIN deal_stats ds ON ds.organization_id = org.organization_id
GROUP BY org.organization_id, org.demo_mode, org.stripe_connected;

-- Revenue by organization (Stripe-verified)
CREATE OR REPLACE VIEW public.v_revenue_by_org AS
SELECT
  o.id AS organization_id,
  o.demo_mode,
  CASE
    WHEN o.stripe_connected = false THEN 0
    ELSE COALESCE(SUM((e.payload->>'amount')::numeric), 0)
  END AS revenue
FROM organizations o
LEFT JOIN stripe_events e
  ON e.organization_id = o.id
  AND e.data_mode = CASE WHEN o.demo_mode THEN 'demo'::data_mode ELSE 'live'::data_mode END
GROUP BY o.id, o.demo_mode, o.stripe_connected;

-- Data quality by organization
CREATE OR REPLACE VIEW public.v_data_quality_by_org AS
SELECT
  o.id AS organization_id,
  o.demo_mode,
  COALESCE(stripe.is_connected, false) AS stripe_connected,
  o.analytics_connected,
  CASE
    WHEN o.demo_mode = true THEN 'DEMO_MODE'
    WHEN COALESCE(stripe.is_connected, false) = false THEN 'NO_STRIPE_CONNECTED'
    WHEN o.analytics_connected = false THEN 'NO_ANALYTICS_CONNECTED'
    ELSE 'LIVE_OK'
  END AS data_quality_status
FROM organizations o
LEFT JOIN ai_settings_stripe stripe ON stripe.organization_id = o.id;

-- Pipeline metrics by organization
CREATE OR REPLACE VIEW public.v_pipeline_metrics_by_org AS
SELECT
  o.id AS organization_id,
  o.demo_mode,
  COALESCE(lead_counts.total_leads, 0) AS total_leads,
  COALESCE(lead_counts.contacted, 0) AS contacted,
  COALESCE(lead_counts.qualified, 0) AS qualified,
  COALESCE(lead_counts.converted, 0) AS converted,
  COALESCE(lead_counts.lost_leads, 0) AS lost_leads,
  COALESCE(deal_counts.won, 0) AS won,
  COALESCE(deal_counts.lost, 0) AS lost,
  CASE
    WHEN s.is_connected = true THEN COALESCE(deal_counts.verified_revenue, 0)
    ELSE 0
  END AS verified_revenue,
  CASE
    WHEN COALESCE(lead_counts.total_leads, 0) > 0
    THEN ROUND((COALESCE(lead_counts.converted, 0)::numeric / lead_counts.total_leads) * 100, 1)
    ELSE 0
  END AS conversion_rate,
  CASE
    WHEN (COALESCE(deal_counts.won, 0) + COALESCE(deal_counts.lost, 0)) > 0
    THEN ROUND((COALESCE(deal_counts.won, 0)::numeric / (deal_counts.won + deal_counts.lost)) * 100, 1)
    ELSE 0
  END AS win_rate,
  deal_counts.avg_conversion_time_days,
  COALESCE(deal_counts.stage_breakdown, '{}'::jsonb) AS stage_breakdown,
  CASE
    WHEN o.demo_mode = true THEN 'DEMO_MODE'
    WHEN s.is_connected = true THEN 'LIVE_OK'
    ELSE 'NO_STRIPE_CONNECTED'
  END AS data_quality_status
FROM organizations o
LEFT JOIN ai_settings_stripe s ON s.organization_id = o.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS total_leads,
    COUNT(*) FILTER (WHERE status IN ('contacted', 'qualified', 'converted', 'won')) AS contacted,
    COUNT(*) FILTER (WHERE status IN ('qualified', 'converted', 'won')) AS qualified,
    COUNT(*) FILTER (WHERE status IN ('converted', 'won')) AS converted,
    COUNT(*) FILTER (WHERE status IN ('lost', 'unqualified')) AS lost_leads
  FROM leads l
  WHERE l.organization_id = o.id
    AND (o.demo_mode = true OR l.data_mode = 'live')
) lead_counts ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE d.stage = 'closed_won') AS won,
    COUNT(*) FILTER (WHERE d.stage = 'closed_lost') AS lost,
    SUM(d.value) FILTER (WHERE d.stage = 'closed_won' AND d.revenue_verified = true) AS verified_revenue,
    ROUND(AVG(EXTRACT(EPOCH FROM (d.won_at - d.created_at)) / 86400)
      FILTER (WHERE d.stage = 'closed_won' AND d.won_at IS NOT NULL), 1) AS avg_conversion_time_days,
    jsonb_object_agg(
      stage_agg.stage,
      jsonb_build_object('count', stage_agg.cnt)
    ) FILTER (WHERE stage_agg.cnt > 0) AS stage_breakdown
  FROM deals d
  LEFT JOIN LATERAL (
    SELECT d2.stage, COUNT(*) AS cnt
    FROM deals d2
    WHERE d2.organization_id = o.id
      AND (o.demo_mode = true OR d2.source = 'user')
    GROUP BY d2.stage
  ) stage_agg ON stage_agg.stage = d.stage
  WHERE d.organization_id = o.id
    AND (o.demo_mode = true OR d.source = 'user')
) deal_counts ON true;
