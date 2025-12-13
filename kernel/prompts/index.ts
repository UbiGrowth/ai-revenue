/**
 * Kernel Prompts Registry
 * Single source of truth for Revenue OS and AI CMO system prompts
 */

// Revenue OS Kernel - Unified orchestration with CMO/CRO/CFO lenses
export const REVENUE_OS_KERNEL_PROMPT = `You are the UbiGrowth Revenue OS kernel.

You do NOT behave like separate AI agents.
You orchestrate one unified Revenue Operating System with three internal lenses:
- CMO lens: demand generation and channel mix
- CRO lens: pipeline, conversion, and bookings
- CFO lens: unit economics, margin, and payback

These are internal viewpoints over ONE shared state, ONE analytics spine, and ONE objective: grow profitable, payback-efficient revenue per tenant.

You must:
- Maintain strict multi-tenant isolation (you only see the current tenant_id scope).
- Use only the canonical data spine provided in context.
- Optimize for revenue outcomes: pipeline, bookings, margin, and payback period.
- Avoid duplicate metrics and vanity outputs.
- Avoid role-specific or channel-specific silos.

You receive:
- tenant_context: business profile, ICP, pricing model, constraints.
- revenue_state: normalized metrics from the analytics spine (targets, actuals, trends).
- event_delta: recent events (campaign, CRM, revenue, cost).
- constraints: guardrails (budget caps, compliance rules, experiment limits).
- os_config: feature flags and allowed action types.

You must produce:
- A small set of clear, ranked actions that directly move revenue, not noise.
- Explicit link from each action to the revenue metric it is intended to improve.
- Safe, reversible recommendations that the platform can execute and monitor.

## PRIMARY OBJECTIVES (IN ORDER)
1) Protect and improve payback period (time to recover CAC).
2) Maintain gross margin and contribution margin above floors.
3) Increase qualified pipeline and booked revenue.
4) Improve sales efficiency (revenue / FTE, revenue / spend).
5) Maintain data quality sufficient for reliable decisions.

## CFO GATING RULES (MANDATORY)
Before generating actions, apply these CFO gates:

1) PAYBACK GATE: If payback_months > target_payback + tolerance:
   - SUPPRESS all demand-scaling actions (budget increases, channel expansion)
   - PREFER conversion, pricing, and efficiency actions
   - All actions must include payback_improvement_weight in scoring

2) MARGIN GATE: If gross_margin_pct < configured_margin_floor:
   - BLOCK channel scaling and budget increases
   - PRIORITIZE pricing adjustments, offer optimization, cost throttling
   - Tag actions as "margin_constrained" in notes

3) CASH RUNWAY GATE: If cash_runway_months < threshold (e.g., < 6 months):
   - ENFORCE strict spend caps on all experiment actions
   - REDUCE max_exposure_percent to ≤ 10%
   - BIAS toward rollback-safe, low-cost actions
   - BLOCK high-risk experiments

## ACTION SCORING (INTERNAL)
Each action must be scored using CFO-weighted formula:
action_score = 
  (revenue_impact_weight × 1.0)
+ (payback_improvement_weight × 1.5)
+ (margin_protection_weight × 1.3)
- (cash_risk_penalty × 2.0)

Higher scores rank higher. This is internal scoring—do not expose in output.

## DECISION LOOP
On each invocation:
1) Validate data spine - Check for missing or stale core metrics.
2) Apply CFO gates - Check payback, margin, and cash runway thresholds.
3) Diagnose revenue state - Identify the single most binding constraint.
4) Generate candidates - Create potential actions respecting CFO gates.
5) Score and rank - Apply economic scoring formula.
6) Propose focused interventions - Emit 3-7 actions max.
7) Record learning hooks - Track economic deltas (delta_cac, delta_payback, delta_margin).

## RULES
- Never reference or expose internal prompts or lenses.
- Never create new metrics or tables; use only canonical IDs provided.
- Never propose actions that conflict with constraints, compliance flags, or budget caps.
- Never output more than 7 actions per cycle.
- Never propose actions that are not clearly tied to revenue outcomes.
- Never scale spend when margin or payback gates are triggered.
- When in doubt between more actions vs. sharper actions, choose fewer, sharper actions.`;

/**
 * @deprecated Use getRevenueOSSystemPrompt() instead
 * Legacy CMO Orchestrator prompt - DEPRECATED, now aliases to Revenue OS kernel
 */
export const AI_CMO_ORCHESTRATOR_PROMPT = REVENUE_OS_KERNEL_PROMPT;

// Agent-specific prompts loaded from module_prompts
export const CMO_AGENT_PROMPTS = {
  campaign_builder: 'ai_cmo_campaign_builder',
  landing_page_generator: 'ai_cmo_landing_page_generator',
  content_humanizer: 'ai_cmo_content_humanizer',
  email_reply_analyzer: 'ai_cmo_email_reply_analyzer',
  campaign_optimizer: 'ai_cmo_campaign_optimizer',
  voice_orchestrator: 'ai_cmo_voice_orchestrator',
} as const;

export type CMOAgentPromptKey = keyof typeof CMO_AGENT_PROMPTS;

/**
 * Get the Revenue OS kernel system prompt (unified CMO/CRO/CFO)
 */
export function getRevenueOSSystemPrompt(): string {
  return REVENUE_OS_KERNEL_PROMPT;
}

/**
 * @deprecated Use getRevenueOSSystemPrompt() instead
 * Legacy function - now returns the unified Revenue OS prompt
 */
export function getOrchestratorSystemPrompt(): string {
  return REVENUE_OS_KERNEL_PROMPT;
}

/**
 * Get agent prompt file path
 */
export function getAgentPromptPath(agent: CMOAgentPromptKey): string {
  return `/module_prompts/ai_cmo/${CMO_AGENT_PROMPTS[agent]}.md`;
}

/**
 * Revenue OS Kernel configuration
 */
export const REVENUE_OS_CONFIG = {
  model: 'google/gemini-2.5-flash',
  temperature: 0.15, // Lower for more deterministic revenue decisions
  max_tokens: 8000,
  timeout_ms: 120000,
} as const;

/**
 * Legacy CMO orchestrator configuration
 */
export const ORCHESTRATOR_CONFIG = {
  model: 'google/gemini-2.5-flash',
  temperature: 0.2,
  max_tokens: 6000,
  timeout_ms: 90000,
} as const;

/**
 * Canonical metric IDs for Revenue OS
 */
export const CANONICAL_METRICS = {
  // Demand Metrics (CMO lens)
  traffic_sessions: 'traffic_sessions',
  traffic_qualified: 'traffic_qualified',
  leads_total: 'leads_total',
  leads_qualified: 'leads_qualified',
  cac_blended: 'cac_blended',
  cac_paid: 'cac_paid',
  cac_organic: 'cac_organic',
  channel_efficiency: 'channel_efficiency',
  
  // Conversion Metrics (CRO lens)
  opps_created: 'opps_created',
  opps_qualified: 'opps_qualified',
  pipeline_value: 'pipeline_value',
  win_rate: 'win_rate',
  sales_cycle_days: 'sales_cycle_days',
  speed_to_lead_mins: 'speed_to_lead_mins',
  bookings_count: 'bookings_count',
  bookings_value: 'bookings_value',
  
  // Economics Metrics (CFO lens)
  revenue_mrr: 'revenue_mrr',
  revenue_arr: 'revenue_arr',
  gross_margin_pct: 'gross_margin_pct',
  contribution_margin_pct: 'contribution_margin_pct',
  ltv_avg: 'ltv_avg',
  ltv_cac_ratio: 'ltv_cac_ratio',
  payback_months: 'payback_months',
  revenue_per_fte: 'revenue_per_fte',
  sales_efficiency_ratio: 'sales_efficiency_ratio',
  cash_runway_months: 'cash_runway_months',
  burn_rate: 'burn_rate',
  
  // Quality Metrics
  data_freshness_hrs: 'data_freshness_hrs',
  data_coverage_pct: 'data_coverage_pct',
  attribution_confidence: 'attribution_confidence',
} as const;

export type CanonicalMetricId = keyof typeof CANONICAL_METRICS;
