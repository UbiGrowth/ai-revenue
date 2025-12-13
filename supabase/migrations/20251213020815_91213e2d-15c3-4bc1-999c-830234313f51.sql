-- Add feature flags to tenants table
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS revenue_os_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS cfo_expansion_enabled boolean NOT NULL DEFAULT false;

-- Create SLO tracking table for kernel cycles
CREATE TABLE IF NOT EXISTS public.kernel_cycle_slo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cycle_date date NOT NULL,
  cycles_attempted integer NOT NULL DEFAULT 0,
  cycles_succeeded integer NOT NULL DEFAULT 0,
  cycles_failed integer NOT NULL DEFAULT 0,
  economics_actions_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, cycle_date)
);

-- Enable RLS
ALTER TABLE public.kernel_cycle_slo ENABLE ROW LEVEL SECURITY;

-- RLS policy for tenant isolation
CREATE POLICY "tenant_isolation" ON public.kernel_cycle_slo
  FOR ALL
  USING (
    tenant_id = auth.uid() OR 
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

-- Add comment for documentation on ownership and SLOs
COMMENT ON TABLE public.kernel_cycle_slo IS 'SLO tracking for Revenue OS kernel. Owners: Kernel+Spine=Kevin, Config/Targets UI=Omid, Ops/Usage+CFO Digest=Gary. SLOs: daily success rate ≥99%, no cross-tenant contamination, economics actions per week > 0.';

-- Index for querying by date range
CREATE INDEX idx_kernel_cycle_slo_tenant_date ON public.kernel_cycle_slo(tenant_id, cycle_date DESC);