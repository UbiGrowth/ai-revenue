import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env['DATABASE_PATH'] = `/tmp/billing_test_${process.pid}.db`;

import { runMigrations } from './src/migrations';
import vibeDb, { storage } from './src/storage';

runMigrations(vibeDb);

const TENANT = 'tenant-abc';
const OTHER  = 'tenant-xyz';

vibeDb.prepare(`
  INSERT OR IGNORE INTO vibe_tasks
    (task_id, user_prompt, source_branch, destination_branch,
     execution_state, iteration_count, initiated_at, last_modified,
     tenant_id, llm_model, llm_prompt_tokens, llm_completion_tokens, llm_total_tokens)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
`).run('task-1','fix bug','main','vibe/1','completed',1,
       Date.now(),Date.now(), TENANT,'claude',1000,500,1500);

describe('Billing storage — tenant isolation', () => {

  it('getBillingUsage scopes to TENANT and computes cost correctly', () => {
    const rows = storage.getBillingUsage(TENANT);
    assert.ok(rows.length > 0, 'expected rows for TENANT');
    const row = rows.find(r => r.model === 'claude')!;
    assert.ok(row, 'claude model row present');
    assert.equal(row.input_tokens, 1000);
    assert.equal(row.output_tokens, 500);
    // (1000/1e6)*3 + (500/1e6)*15 = 0.003 + 0.0075 = 0.0105 USD
    assert.ok(Math.abs(row.cost_usd - 0.0105) < 1e-9, `cost=${row.cost_usd}`);
    assert.equal(row.job_count, 1);
  });

  it('getBillingUsage returns no rows for OTHER tenant (no bleed)', () => {
    assert.equal(storage.getBillingUsage(OTHER).length, 0);
  });

  it('getBillingExport returns per-task rows only for TENANT', () => {
    const rows = storage.getBillingExport(TENANT);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].task_id, 'task-1');
    assert.equal(rows[0].llm_prompt_tokens, 1000);
    assert.equal(rows[0].llm_completion_tokens, 500);
  });

  it('getBillingExport is empty for OTHER tenant', () => {
    assert.equal(storage.getBillingExport(OTHER).length, 0);
  });

  it('getTenantSpend matches expected cost for TENANT', () => {
    const spend = storage.getTenantSpend(TENANT);
    assert.ok(Math.abs(spend - 0.0105) < 1e-9, `spend=${spend}`);
  });

  it('getTenantSpend is 0 for OTHER tenant', () => {
    assert.equal(storage.getTenantSpend(OTHER), 0);
  });

  it('getTenantBudget returns null when no budget set', () => {
    assert.equal(storage.getTenantBudget(TENANT), null);
  });

  it('setTenantBudget persists and getTenantBudget retrieves it', () => {
    storage.setTenantBudget(TENANT, 25.00);
    assert.equal(storage.getTenantBudget(TENANT), 25.00);
  });

  it('setTenantBudget upserts — second call updates existing ceiling', () => {
    storage.setTenantBudget(TENANT, 50.00);
    assert.equal(storage.getTenantBudget(TENANT), 50.00);
  });

  it('budget for OTHER tenant is unaffected by TENANT upsert', () => {
    assert.equal(storage.getTenantBudget(OTHER), null);
  });
});
