-- Add CFO economic deltas column to optimization_action_results (nullable JSONB)
ALTER TABLE public.optimization_action_results 
ADD COLUMN IF NOT EXISTS economic_deltas JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.optimization_action_results.economic_deltas IS 'CFO learning signals: delta_cac, delta_payback_months, delta_margin_pct, delta_revenue_per_fte';

-- Add CFO guardrails storage to optimization_cycles for audit trail
ALTER TABLE public.optimization_cycles
ADD COLUMN IF NOT EXISTS cfo_gates_active TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.optimization_cycles.cfo_gates_active IS 'CFO gates triggered during this cycle: payback_exceeded, margin_below_floor, cash_constrained';