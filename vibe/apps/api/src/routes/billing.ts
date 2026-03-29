import express, { Response } from 'express';
import { storage } from '../storage';
import { extractTenantFromJwt } from '../middleware/tenant';
import { AuthRequest } from '../auth';

const router = express.Router();

// All billing routes require authenticated tenant context.
router.use(extractTenantFromJwt());

/** Reject requests where the URL :tenantId does not match the authenticated tenant. */
function guardTenant(req: AuthRequest, res: Response): boolean {
  if (req.params.tenantId !== req.tenantId) {
    res.status(403).json({ error: 'Access denied: cannot access another tenant\'s billing data' });
    return false;
  }
  return true;
}

// ── GET /api/billing/usage/:tenantId ──────────────────────────────────────
// Returns token aggregates and cost per (date, model), plus the budget limit.
router.get('/usage/:tenantId', (req: AuthRequest, res: Response) => {
  if (!guardTenant(req, res)) return;

  const tenantId = req.tenantId!;
  const rows = storage.getBillingUsage(tenantId);
  const totalSpend = rows.reduce((sum, r) => sum + r.cost_usd, 0);
  const budgetLimit = storage.getTenantBudget(tenantId);

  res.json({
    tenantId,
    totalSpend,
    budgetLimit,
    rows,
  });
});

// ── GET /api/billing/export/:tenantId ────────────────────────────────────
// Streams a CSV file of all metered LLM calls for the tenant.
router.get('/export/:tenantId', (req: AuthRequest, res: Response) => {
  if (!guardTenant(req, res)) return;

  const tenantId = req.tenantId!;
  const rows = storage.getBillingExport(tenantId);

  const header = 'date,model,input_tokens,output_tokens,cost_usd,task_id\n';
  const body = rows
    .map((r) => {
      const date = new Date(r.initiated_at).toISOString().split('T')[0];
      const cost = computeCost(r.llm_model, r.llm_prompt_tokens, r.llm_completion_tokens);
      return [date, r.llm_model, r.llm_prompt_tokens, r.llm_completion_tokens, cost.toFixed(6), r.task_id].join(',');
    })
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="billing-${tenantId}.csv"`);
  res.send(header + body);
});

// ── POST /api/billing/budget/:tenantId ───────────────────────────────────
// Body: { limitUSD: number }  — sets or updates the tenant's spend ceiling.
router.post('/budget/:tenantId', (req: AuthRequest, res: Response) => {
  if (!guardTenant(req, res)) return;

  const { limitUSD } = req.body as { limitUSD?: unknown };
  if (typeof limitUSD !== 'number' || limitUSD < 0) {
    return res.status(400).json({ error: 'limitUSD must be a non-negative number' });
  }

  storage.setTenantBudget(req.tenantId!, limitUSD);
  res.json({ tenantId: req.tenantId, limitUSD, message: 'Budget ceiling updated successfully' });
});

// ── Helpers ───────────────────────────────────────────────────────────────

const MODEL_RATES: Record<string, { input: number; output: number }> = {
  claude: { input: 3.0,  output: 15.0 },
  gpt:    { input: 10.0, output: 30.0 },
};

function computeCost(model: string, promptTokens: number, completionTokens: number): number {
  const rates = MODEL_RATES[model] ?? MODEL_RATES.claude;
  return (promptTokens / 1_000_000) * rates.input + (completionTokens / 1_000_000) * rates.output;
}

export default router;
