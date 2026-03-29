-- ============================================================================
-- VIBE GTM Dashboard — Phase 3: Prospect Pipeline Tracker
-- Leads, Prospects, Voice, Outbound
-- ============================================================================

-- ── Leads ─────────────────────────────────────────────────────────────────
CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  job_title text,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  score integer DEFAULT 0,
  vertical text,
  industry text,
  company_size text,
  segment_code text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  landing_page_url text,
  notes text,
  tags text[],
  custom_fields jsonb DEFAULT '{}'::jsonb,
  campaign_id uuid,
  assigned_to uuid,
  created_by uuid,
  contacted_at timestamptz,
  qualified_at timestamptz,
  converted_at timestamptz,
  lost_at timestamptz,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  data_mode data_mode NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_leads_organization_id ON public.leads(organization_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_data_mode ON public.leads(data_mode);
CREATE INDEX idx_leads_email ON public.leads(email);

-- Add FK from deals → leads now that leads exists
ALTER TABLE public.deals ADD CONSTRAINT fk_deals_lead_id
  FOREIGN KEY (lead_id) REFERENCES public.leads(id);

-- ── CRM Leads (enriched) ─────────────────────────────────────────────────
CREATE TABLE public.crm_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id),
  first_name text,
  last_name text,
  email text,
  phone text,
  company text,
  title text,
  source text,
  status text DEFAULT 'new',
  score integer DEFAULT 0,
  enrichment_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_crm_leads_organization_id ON public.crm_leads(organization_id);

-- ── CRM Contacts ──────────────────────────────────────────────────────────
CREATE TABLE public.crm_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  phone text,
  company_name text,
  role_title text,
  status text DEFAULT 'prospect',
  lifecycle_stage text,
  segment_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_crm_contacts_organization_id ON public.crm_contacts(organization_id);

-- ── Lead Activities ───────────────────────────────────────────────────────
CREATE TABLE public.lead_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lead_activities_organization_id ON public.lead_activities(organization_id);
CREATE INDEX idx_lead_activities_lead_id ON public.lead_activities(lead_id);

-- ── Lead Stage Events ─────────────────────────────────────────────────────
CREATE TABLE public.lead_stage_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  stage text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_stage_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lead_stage_events_organization_id ON public.lead_stage_events(organization_id);
CREATE INDEX idx_lead_stage_events_lead_id ON public.lead_stage_events(lead_id);

-- ── Tasks ─────────────────────────────────────────────────────────────────
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id),
  deal_id uuid REFERENCES public.deals(id),
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium',
  status text DEFAULT 'pending',
  task_type text DEFAULT 'follow_up',
  due_date timestamptz,
  assigned_to uuid,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tasks_organization_id ON public.tasks(organization_id);

-- ── Opportunities ─────────────────────────────────────────────────────────
CREATE TABLE public.opportunities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts(id),
  campaign_id uuid,
  owner_user_id uuid,
  name text NOT NULL,
  stage text NOT NULL DEFAULT 'lead',
  source text,
  amount numeric DEFAULT 0,
  win_probability numeric DEFAULT 0,
  expected_close_date date,
  closed_at timestamptz,
  lost_reason text,
  external_crm_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_opportunities_organization_id ON public.opportunities(organization_id);

-- ── Prospects ─────────────────────────────────────────────────────────────
CREATE TABLE public.prospects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  phone text,
  linkedin_url text,
  company text,
  title text,
  industry text,
  company_size text,
  location text,
  timezone text,
  status text DEFAULT 'new',
  enrichment_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_prospects_organization_id ON public.prospects(organization_id);

-- ── Prospect Scores ───────────────────────────────────────────────────────
CREATE TABLE public.prospect_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  band text,
  rationale text,
  key_signals text[],
  hypothesized_pain_points text[],
  recommended_angle text,
  tone_recommendation text,
  last_scored_at timestamptz DEFAULT now()
);
ALTER TABLE public.prospect_scores ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_prospect_scores_organization_id ON public.prospect_scores(organization_id);

-- ── Prospect Signals ──────────────────────────────────────────────────────
CREATE TABLE public.prospect_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  source text NOT NULL,
  signal_data jsonb NOT NULL,
  signal_strength numeric,
  detected_at timestamptz DEFAULT now()
);
ALTER TABLE public.prospect_signals ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_prospect_signals_organization_id ON public.prospect_signals(organization_id);

-- ── Voice Agents ──────────────────────────────────────────────────────────
CREATE TABLE public.voice_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text DEFAULT 'vapi',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  campaign_id uuid,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_agents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_voice_agents_organization_id ON public.voice_agents(organization_id);

-- ── Voice Phone Numbers ───────────────────────────────────────────────────
CREATE TABLE public.voice_phone_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  display_name text,
  provider text DEFAULT 'vapi',
  provider_number_id text,
  status text DEFAULT 'active',
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_voice_phone_numbers_organization_id ON public.voice_phone_numbers(organization_id);

-- ── Voice Call Records ────────────────────────────────────────────────────
CREATE TABLE public.voice_call_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_number_id uuid REFERENCES public.voice_phone_numbers(id),
  voice_agent_id uuid REFERENCES public.voice_agents(id),
  lead_id uuid REFERENCES public.leads(id),
  campaign_id uuid,
  provider_call_id text,
  call_type text NOT NULL DEFAULT 'outbound',
  status text NOT NULL DEFAULT 'queued',
  customer_number text,
  customer_name text,
  duration_seconds integer DEFAULT 0,
  cost numeric DEFAULT 0,
  transcript text,
  summary text,
  recording_url text,
  outcome text,
  failure_reason text,
  analysis jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_call_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_voice_call_records_organization_id ON public.voice_call_records(organization_id);

-- ── Outbound Campaigns ────────────────────────────────────────────────────
CREATE TABLE public.outbound_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL,
  objective text,
  target_persona text,
  config jsonb,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.outbound_campaigns ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_outbound_campaigns_organization_id ON public.outbound_campaigns(organization_id);

-- ── Outbound Sequences ────────────────────────────────────────────────────
CREATE TABLE public.outbound_sequences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.outbound_sequences ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_outbound_sequences_organization_id ON public.outbound_sequences(organization_id);

-- ── Outbound Sequence Steps ───────────────────────────────────────────────
CREATE TABLE public.outbound_sequence_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES public.outbound_sequences(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  step_type text NOT NULL,
  delay_days integer DEFAULT 0,
  channel text,
  message_template text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.outbound_sequence_steps ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_outbound_sequence_steps_organization_id ON public.outbound_sequence_steps(organization_id);

-- ── Outbound Sequence Runs ────────────────────────────────────────────────
CREATE TABLE public.outbound_sequence_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES public.outbound_sequences(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id),
  status text DEFAULT 'active',
  last_step_sent integer,
  next_step_due_at timestamptz,
  started_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.outbound_sequence_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_outbound_sequence_runs_organization_id ON public.outbound_sequence_runs(organization_id);

-- ============================================================================
-- RLS Policies — Pipeline Tables (org-scoped)
-- ============================================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'leads', 'crm_leads', 'crm_contacts', 'lead_activities', 'lead_stage_events',
    'tasks', 'opportunities', 'prospects', 'prospect_scores', 'prospect_signals',
    'voice_agents', 'voice_phone_numbers', 'voice_call_records',
    'outbound_campaigns', 'outbound_sequences', 'outbound_sequence_steps',
    'outbound_sequence_runs'
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

-- Leads: enhanced policies (role-gated like RevOs)
DROP POLICY IF EXISTS "leads_select" ON public.leads;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
DROP POLICY IF EXISTS "leads_update" ON public.leads;
DROP POLICY IF EXISTS "leads_delete" ON public.leads;

CREATE POLICY "leads_select" ON public.leads
  FOR SELECT USING (
    user_has_org_access(organization_id)
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'sales'))
  );
CREATE POLICY "leads_insert" ON public.leads
  FOR INSERT WITH CHECK (
    user_has_org_access(organization_id)
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'sales'))
  );
CREATE POLICY "leads_update" ON public.leads
  FOR UPDATE USING (
    user_has_org_access(organization_id)
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR assigned_to = auth.uid())
  );
CREATE POLICY "leads_delete" ON public.leads
  FOR DELETE USING (
    user_has_org_access(organization_id)
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  );

-- ============================================================================
-- Views — Pipeline (adapted from RevOs)
-- ============================================================================

-- Conversion funnel
CREATE OR REPLACE VIEW public.v_conversion_funnel AS
WITH org AS (
  SELECT
    o.id AS organization_id,
    o.demo_mode,
    o.stripe_connected
  FROM public.organizations o
),
lead_counts AS (
  SELECT
    l.organization_id,
    COUNT(*) AS total_leads,
    COUNT(*) FILTER (WHERE l.status = 'new') AS new_leads,
    COUNT(*) FILTER (WHERE l.status IN ('contacted', 'working')) AS contacted_leads,
    COUNT(*) FILTER (WHERE l.status = 'qualified') AS qualified_leads,
    COUNT(*) FILTER (WHERE l.status = 'converted') AS converted_leads,
    COUNT(*) FILTER (WHERE l.status = 'lost') AS lost_leads
  FROM public.leads l
  GROUP BY l.organization_id
),
deal_counts AS (
  SELECT
    d.organization_id,
    COUNT(*) FILTER (WHERE d.stage = 'closed_won') AS won_deals,
    COUNT(*) FILTER (WHERE d.stage = 'closed_lost') AS lost_deals,
    COUNT(*) FILTER (WHERE d.stage NOT IN ('closed_won', 'closed_lost')) AS active_deals
  FROM public.deals d
  JOIN org ON org.organization_id = d.organization_id
    AND ((org.demo_mode AND d.data_mode = 'demo') OR (NOT org.demo_mode AND d.data_mode = 'live'))
  GROUP BY d.organization_id
)
SELECT
  org.organization_id,
  org.demo_mode,
  COALESCE(lc.total_leads, 0) AS total_leads,
  COALESCE(lc.new_leads, 0) AS new_leads,
  COALESCE(lc.contacted_leads, 0) AS contacted_leads,
  COALESCE(lc.qualified_leads, 0) AS qualified_leads,
  COALESCE(lc.converted_leads, 0) AS converted_leads,
  COALESCE(lc.lost_leads, 0) AS lost_leads,
  COALESCE(dc.active_deals, 0) AS active_deals,
  COALESCE(dc.won_deals, 0) AS won_deals,
  COALESCE(dc.lost_deals, 0) AS lost_deals,
  CASE
    WHEN COALESCE(lc.total_leads, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(lc.qualified_leads, 0)::numeric / lc.total_leads) * 100, 2)
  END AS lead_to_qualified_rate,
  CASE
    WHEN COALESCE(lc.qualified_leads, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(dc.won_deals, 0)::numeric / lc.qualified_leads) * 100, 2)
  END AS qualified_to_won_rate,
  CASE
    WHEN COALESCE(lc.total_leads, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(dc.won_deals, 0)::numeric / lc.total_leads) * 100, 2)
  END AS overall_conversion_rate
FROM org
LEFT JOIN lead_counts lc ON lc.organization_id = org.organization_id
LEFT JOIN deal_counts dc ON dc.organization_id = org.organization_id;

-- Lead pipeline (data-mode gated)
CREATE OR REPLACE VIEW public.v_lead_pipeline AS
WITH org AS (
  SELECT
    o.id AS organization_id,
    o.demo_mode,
    CASE WHEN o.demo_mode THEN 'demo'::public.data_mode ELSE 'live'::public.data_mode END AS required_mode
  FROM public.organizations o
)
SELECT
  l.id,
  l.organization_id,
  l.first_name,
  l.last_name,
  l.email,
  l.company,
  l.status,
  l.score,
  l.source,
  l.created_at,
  l.contacted_at,
  l.qualified_at,
  l.converted_at,
  l.lost_at,
  l.data_mode,
  org.demo_mode
FROM public.leads l
JOIN org ON org.organization_id = l.organization_id
WHERE l.data_mode = org.required_mode
   OR (l.data_mode IS NULL AND NOT org.demo_mode);

-- Source of truth (master CRM view)
CREATE OR REPLACE VIEW public.v_crm_source_of_truth AS
WITH org AS (
  SELECT
    o.id AS organization_id,
    o.demo_mode,
    o.stripe_connected,
    CASE WHEN o.demo_mode THEN 'demo'::public.data_mode ELSE 'live'::public.data_mode END AS required_mode
  FROM public.organizations o
),
lead_counts AS (
  SELECT
    l.organization_id,
    COUNT(*) AS total_leads,
    COUNT(*) FILTER (WHERE l.status = 'new') AS new_leads,
    COUNT(*) FILTER (WHERE l.status IN ('contacted', 'working')) AS contacted_leads,
    COUNT(*) FILTER (WHERE l.status = 'qualified') AS qualified_leads,
    COUNT(*) FILTER (WHERE l.status = 'converted') AS converted_leads,
    COUNT(*) FILTER (WHERE l.status = 'lost') AS lost_leads,
    AVG(EXTRACT(EPOCH FROM (l.contacted_at - l.created_at)) / 86400)
      FILTER (WHERE l.contacted_at IS NOT NULL) AS avg_days_to_contact,
    AVG(EXTRACT(EPOCH FROM (l.qualified_at - l.created_at)) / 86400)
      FILTER (WHERE l.qualified_at IS NOT NULL) AS avg_days_to_qualify,
    AVG(EXTRACT(EPOCH FROM (l.converted_at - l.created_at)) / 86400)
      FILTER (WHERE l.converted_at IS NOT NULL) AS avg_days_to_convert
  FROM public.leads l
  JOIN org ON org.organization_id = l.organization_id
    AND (l.data_mode = org.required_mode OR l.data_mode IS NULL)
  GROUP BY l.organization_id
),
deal_counts AS (
  SELECT
    d.organization_id,
    COUNT(*) AS total_deals,
    COUNT(*) FILTER (WHERE d.stage NOT IN ('closed_won', 'closed_lost')) AS active_deals,
    COUNT(*) FILTER (WHERE d.stage = 'closed_won') AS won_deals,
    COUNT(*) FILTER (WHERE d.stage = 'closed_lost') AS lost_deals,
    SUM(CASE WHEN d.stage NOT IN ('closed_won', 'closed_lost') THEN d.value ELSE 0 END) AS pipeline_value,
    SUM(CASE WHEN d.stage = 'closed_won' THEN d.value ELSE 0 END) AS won_value,
    SUM(CASE WHEN d.stage = 'closed_won' AND d.revenue_verified THEN d.value ELSE 0 END) AS verified_won_value,
    COUNT(*) FILTER (WHERE d.stage = 'closed_won' AND d.revenue_verified) AS verified_won_count
  FROM public.deals d
  JOIN org ON org.organization_id = d.organization_id AND d.data_mode = org.required_mode
  GROUP BY d.organization_id
),
stripe_revenue AS (
  SELECT
    e.organization_id,
    SUM(
      CASE
        WHEN e.event_type IN ('invoice.paid', 'checkout.session.completed', 'payment_intent.succeeded', 'charge.succeeded')
          AND COALESCE((e.payload->>'livemode')::boolean, true) = true
        THEN COALESCE(
          ((e.payload->'data'->'object'->>'amount_paid')::numeric),
          ((e.payload->'data'->'object'->>'amount_total')::numeric),
          ((e.payload->'data'->'object'->>'amount')::numeric),
          (e.payload->>'amount')::numeric,
          0
        ) / 100.0
        ELSE 0
      END
    ) AS stripe_revenue
  FROM public.stripe_events e
  JOIN org ON org.organization_id = e.organization_id AND e.data_mode = org.required_mode
  GROUP BY e.organization_id
)
SELECT
  org.organization_id,
  org.demo_mode,
  org.stripe_connected,
  COALESCE(lc.total_leads, 0) AS total_leads,
  COALESCE(lc.new_leads, 0) AS new_leads,
  COALESCE(lc.contacted_leads, 0) AS contacted_leads,
  COALESCE(lc.qualified_leads, 0) AS qualified_leads,
  COALESCE(lc.converted_leads, 0) AS converted_leads,
  COALESCE(lc.lost_leads, 0) AS lost_leads,
  CASE
    WHEN COALESCE(lc.total_leads, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(lc.contacted_leads, 0)::numeric / lc.total_leads) * 100, 2)
  END AS lead_to_contact_rate,
  CASE
    WHEN COALESCE(lc.total_leads, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(lc.qualified_leads, 0)::numeric / lc.total_leads) * 100, 2)
  END AS lead_to_qualified_rate,
  CASE
    WHEN COALESCE(lc.qualified_leads, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(dc.won_deals, 0)::numeric / lc.qualified_leads) * 100, 2)
  END AS qualified_to_won_rate,
  CASE
    WHEN COALESCE(lc.total_leads, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(dc.won_deals, 0)::numeric / lc.total_leads) * 100, 2)
  END AS overall_conversion_rate,
  COALESCE(dc.total_deals, 0) AS total_deals,
  COALESCE(dc.active_deals, 0) AS active_deals,
  COALESCE(dc.won_deals, 0) AS won_deals,
  COALESCE(dc.lost_deals, 0) AS lost_deals,
  COALESCE(dc.pipeline_value, 0) AS pipeline_value,
  CASE
    WHEN COALESCE(dc.total_deals, 0) = 0 THEN 0
    WHEN (COALESCE(dc.won_deals, 0) + COALESCE(dc.lost_deals, 0)) = 0 THEN 0
    ELSE ROUND((COALESCE(dc.won_deals, 0)::numeric / (dc.won_deals + dc.lost_deals)) * 100, 2)
  END AS win_rate,
  CASE
    WHEN org.demo_mode THEN COALESCE(dc.won_value, 0)
    WHEN NOT org.stripe_connected THEN 0
    ELSE COALESCE(dc.verified_won_value, 0)
  END AS won_revenue,
  CASE
    WHEN org.demo_mode THEN COALESCE(sr.stripe_revenue, 0)
    WHEN NOT org.stripe_connected THEN 0
    ELSE COALESCE(sr.stripe_revenue, 0)
  END AS stripe_revenue,
  COALESCE(dc.verified_won_count, 0) AS verified_won_count,
  ROUND(COALESCE(lc.avg_days_to_contact, 0)::numeric, 1) AS avg_days_to_contact,
  ROUND(COALESCE(lc.avg_days_to_qualify, 0)::numeric, 1) AS avg_days_to_qualify,
  ROUND(COALESCE(lc.avg_days_to_convert, 0)::numeric, 1) AS avg_days_to_convert,
  CASE
    WHEN org.demo_mode THEN 'DEMO_MODE'
    WHEN NOT org.stripe_connected AND COALESCE(dc.won_deals, 0) > 0 THEN 'REVENUE_UNVERIFIED'
    WHEN NOT org.stripe_connected THEN 'NO_STRIPE_CONNECTED'
    WHEN COALESCE(lc.total_leads, 0) = 0 AND COALESCE(dc.total_deals, 0) = 0 THEN 'EMPTY_CRM'
    ELSE 'LIVE_OK'
  END AS data_quality_status
FROM org
LEFT JOIN lead_counts lc ON lc.organization_id = org.organization_id
LEFT JOIN deal_counts dc ON dc.organization_id = org.organization_id
LEFT JOIN stripe_revenue sr ON sr.organization_id = org.organization_id;
