# Revenue OS – CFO Behavior Cheat Sheet

The OS is **ALWAYS** economics-aware. Here's how it behaves:

---

## 1. When Payback Is Too Long

**Signal:** `payback_months` > target + tolerance

**OS behavior:**
- **Blocks:** pure "more spend" / demand-scaling actions
- **Prefers:**
  - Conversion rate improvements (better follow-up, better routing)
  - Pricing / packaging tests
  - Shortening sales cycle actions
- **Expect to see actions targeting:**
  - `win_rate`
  - `avg_sales_cycle_days`
  - `pipeline_quality_score`
  - `cac_blended` (down)

**What you should do:**
- Approve most conversion/pricing actions.
- Be skeptical of any action that pushes more spend until payback normalizes.

---

## 2. When Margin Is Too Low

**Signal:** `gross_margin_pct` < configured `margin_floor_pct`

**OS behavior:**
- **Blocks:** channel scaling and high-cost acquisition actions
- **Prefers:**
  - Price increases or discount reduction experiments
  - Shifting mix away from low-margin channels/segments
  - Offer restructuring (same ACV, less cost to deliver)

**What you should do:**
- Expect "raise price" or "tighten discounting" experiments.
- Expect recommendations to throttle specific channels or segments.
- Only override if there's a strategic reason to accept low margin.

---

## 3. When Cash Runway Is Tight

**Signal:** `cash_runway_months` < configured threshold

**OS behavior:**
- **Drops:**
  - Large, high-exposure experiments
  - Aggressive spend-increase actions
- **Enforces:**
  - Tighter budget caps
  - Lower `max_exposure_percent` on tests
- **Biases toward:**
  - Low-cost efficiency improvements
  - Protecting existing recurring revenue

**What you should do:**
- Expect "micro" experiments and cost controls, not big bets.
- Treat any spend-increase recommendation as high-scrutiny.

---

## 4. How to Read Action Cards (CFO Lens)

On each action card in the OS Actions section, pay attention to:

### Target metric
If it's economics (`cac_blended`, `payback_months`, `gross_margin_pct`, `revenue_per_fte`), CFO lens is driving.

### Guardrails
Check `max_additional_spend`, `max_exposure_percent`, and abort conditions.

### Outcome tags after completion
- **"Improved economics"** → OS will reuse patterns like this.
- **"Hurt economics"** → OS will actively avoid repeats.

> **Note:** If an action improves pipeline but hurts economics, assume the OS will down-rank similar actions in future cycles.

---

## CFO Gate Summary

| Gate | Trigger | Effect |
|------|---------|--------|
| Payback | `payback_months > target + tolerance` | Suppress demand scaling, prefer conversion/pricing |
| Margin | `gross_margin_pct < margin_floor` | Block channel scaling, prefer pricing/cost actions |
| Cash | `cash_runway_months < threshold` | Reduce experiment exposure, enforce spend caps |

---

## Operator Quick Reference

```
CFO gates active?  → Check cycle_summary.cfo_gates_active[]
Action economics?  → Check action.target_metric domain
Learning signal?   → Check optimization_action_results.economic_deltas
```

This makes the CFO expansion real for operators without changing any code.
