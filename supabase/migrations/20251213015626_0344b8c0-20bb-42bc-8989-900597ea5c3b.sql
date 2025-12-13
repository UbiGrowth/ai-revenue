-- Create weekly_cfo_portfolio_snapshot RPC function (portfolio-level aggregate)
CREATE OR REPLACE FUNCTION public.weekly_cfo_portfolio_snapshot()
RETURNS TABLE (
  tenants_active integer,
  avg_payback_months numeric,
  avg_cac_blended numeric,
  avg_gross_margin_pct numeric,
  avg_contribution_margin_pct numeric,
  avg_revenue_per_fte numeric,
  avg_sales_efficiency_ratio numeric,
  total_econ_actions integer,
  total_econ_actions_improved integer,
  total_econ_actions_hurt integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH weekly AS (
    SELECT *
    FROM weekly_cfo_snapshot()
  )
  SELECT
    COUNT(*)::integer AS tenants_active,
    AVG(payback_months) AS avg_payback_months,
    AVG(cac_blended) AS avg_cac_blended,
    AVG(gross_margin_pct) AS avg_gross_margin_pct,
    AVG(contribution_margin_pct) AS avg_contribution_margin_pct,
    AVG(revenue_per_fte) AS avg_revenue_per_fte,
    AVG(sales_efficiency_ratio) AS avg_sales_efficiency_ratio,
    SUM(econ_actions_total)::integer AS total_econ_actions,
    SUM(econ_actions_improved)::integer AS total_econ_actions_improved,
    SUM(econ_actions_hurt)::integer AS total_econ_actions_hurt
  FROM weekly;
$$;