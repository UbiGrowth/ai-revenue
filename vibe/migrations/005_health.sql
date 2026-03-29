-- ============================================================================
-- VIBE GTM Dashboard — Phase 5: Platform Health Monitor
-- Agent runs, SLO metrics, Alerts
-- ============================================================================

-- ── Agent Runs ────────────────────────────────────────────────────────────
CREATE TABLE public.agent_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent text NOT NULL,
  mode text,
  status text DEFAULT 'pending',
  input jsonb DEFAULT '{}'::jsonb,
  output jsonb DEFAULT '{}'::jsonb,
  error_message text,
  duration_ms integer,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_agent_runs_organization_id ON public.agent_runs(organization_id);
CREATE INDEX idx_agent_runs_status ON public.agent_runs(status);
CREATE INDEX idx_agent_runs_created_at ON public.agent_runs(created_at DESC);

-- ── SLO Metrics ───────────────────────────────────────────────────────────
CREATE TABLE public.slo_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  threshold numeric NOT NULL,
  is_breached boolean NOT NULL DEFAULT false,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  details jsonb,
  measured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.slo_metrics ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_slo_metrics_organization_id ON public.slo_metrics(organization_id);
CREATE INDEX idx_slo_metrics_metric_name ON public.slo_metrics(metric_name);
CREATE INDEX idx_slo_metrics_measured_at ON public.slo_metrics(measured_at DESC);

-- ── SLO Alerts ────────────────────────────────────────────────────────────
CREATE TABLE public.slo_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  metric_name text,
  metric_value numeric,
  threshold numeric,
  message text NOT NULL,
  details jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.slo_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_slo_alerts_organization_id ON public.slo_alerts(organization_id);
CREATE INDEX idx_slo_alerts_severity ON public.slo_alerts(severity);
CREATE INDEX idx_slo_alerts_created_at ON public.slo_alerts(created_at DESC);

-- ============================================================================
-- RLS Policies — Health Tables
-- ============================================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['agent_runs', 'slo_metrics', 'slo_alerts'] LOOP
    EXECUTE format(
      'CREATE POLICY "%1$s_select" ON public.%1$s FOR SELECT USING (organization_id IS NULL OR user_has_org_access(organization_id) OR is_platform_admin())',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_insert" ON public.%1$s FOR INSERT WITH CHECK (organization_id IS NULL OR user_has_org_access(organization_id))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_update" ON public.%1$s FOR UPDATE USING (organization_id IS NULL OR user_has_org_access(organization_id))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_delete" ON public.%1$s FOR DELETE USING (is_platform_admin())',
      tbl
    );
  END LOOP;
END $$;
