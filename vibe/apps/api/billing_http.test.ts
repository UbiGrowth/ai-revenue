import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env['DATABASE_PATH'] = `/tmp/billing_http_${process.pid}.db`;

import { runMigrations } from './src/migrations';
import vibeDb, { storage } from './src/storage';
import { extractTenantFromJwt } from './src/middleware/tenant';
import express from 'express';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Make a base64url-encoded JWT with the given payload (no real signing). */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fakesig`;
}

function request(
  server: http.Server,
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: unknown } = {}
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const payload = opts.body ? JSON.stringify(opts.body) : undefined;
    const headers: Record<string, string> = {
      ...(opts.headers || {}),
      ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)) } : {}),
    };
    const req = http.request({ hostname: 'localhost', port: addr.port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode!, body: JSON.parse(data || 'null') }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

runMigrations(vibeDb);

const TENANT_A = 'tenant-alpha';
const TENANT_B = 'tenant-beta';

// Seed a task with tokens for TENANT_A
vibeDb.prepare(`
  INSERT OR IGNORE INTO vibe_tasks
    (task_id, user_prompt, source_branch, destination_branch,
     execution_state, iteration_count, initiated_at, last_modified,
     tenant_id, llm_model, llm_prompt_tokens, llm_completion_tokens, llm_total_tokens)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
`).run('http-task-1','add feature','main','vibe/x','completed',1,
       Date.now(),Date.now(), TENANT_A,'gpt',2000,1000,3000);

// Boot a minimal express app with just the billing router
import billingRouter from './src/routes/billing';

const app = express();
app.use(express.json());
app.use('/api/billing', billingRouter);

let server: http.Server;

describe('Billing HTTP — middleware + routes', () => {

  before(() => new Promise<void>(res => { server = app.listen(0, res); }));
  after(()  => new Promise<void>(res => server.close(() => res())));

  // ── JWT middleware tests ────────────────────────────────────────────────

  it('returns 401 with no auth header and no X-Tenant-Id', async () => {
    const r = await request(server, 'GET', `/api/billing/usage/${TENANT_A}`);
    assert.equal(r.status, 401);
  });

  it('returns 401 with malformed Bearer token', async () => {
    const r = await request(server, 'GET', `/api/billing/usage/${TENANT_A}`, {
      headers: { Authorization: 'Bearer notajwt' },
    });
    assert.equal(r.status, 401);
  });

  it('accepts X-Tenant-Id header as fallback when no JWT', async () => {
    const r = await request(server, 'GET', `/api/billing/usage/${TENANT_A}`, {
      headers: { 'X-Tenant-Id': TENANT_A },
    });
    assert.equal(r.status, 200);
  });

  it('accepts JWT with tenant_id claim', async () => {
    const jwt = fakeJwt({ tenant_id: TENANT_A, iat: 1 });
    const r = await request(server, 'GET', `/api/billing/usage/${TENANT_A}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.equal(r.status, 200);
  });

  it('accepts JWT with sub claim as tenantId', async () => {
    const jwt = fakeJwt({ sub: TENANT_A });
    const r = await request(server, 'GET', `/api/billing/usage/${TENANT_A}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.equal(r.status, 200);
  });

  // ── Cross-tenant 403 tests ──────────────────────────────────────────────

  it('GET /usage rejects with 403 when JWT tenant ≠ URL tenant', async () => {
    const jwt = fakeJwt({ tenant_id: TENANT_B }); // authenticated as B
    const r = await request(server, 'GET', `/api/billing/usage/${TENANT_A}`, { // asking for A
      headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.equal(r.status, 403);
  });

  it('GET /export rejects with 403 cross-tenant', async () => {
    const jwt = fakeJwt({ tenant_id: TENANT_B });
    const r = await request(server, 'GET', `/api/billing/export/${TENANT_A}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.equal(r.status, 403);
  });

  it('POST /budget rejects with 403 cross-tenant', async () => {
    const jwt = fakeJwt({ tenant_id: TENANT_B });
    const r = await request(server, 'POST', `/api/billing/budget/${TENANT_A}`, {
      headers: { Authorization: `Bearer ${jwt}` },
      body: { limitUSD: 100 },
    });
    assert.equal(r.status, 403);
  });

  // ── Correct-tenant usage ────────────────────────────────────────────────

  it('GET /usage/:tenantId returns correct aggregated data', async () => {
    const jwt = fakeJwt({ tenant_id: TENANT_A });
    const r = await request(server, 'GET', `/api/billing/usage/${TENANT_A}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.equal(r.status, 200);
    const body = r.body as any;
    assert.equal(body.tenantId, TENANT_A);
    assert.ok(Array.isArray(body.rows));
    const row = body.rows.find((x: any) => x.model === 'gpt');
    assert.ok(row, 'gpt row present');
    assert.equal(row.input_tokens, 2000);
    assert.equal(row.output_tokens, 1000);
    // cost = (2000/1e6)*10 + (1000/1e6)*30 = 0.02 + 0.03 = 0.05
    assert.ok(Math.abs(row.cost_usd - 0.05) < 1e-9, `cost=${row.cost_usd}`);
  });

  it('GET /export/:tenantId returns CSV content-type', async () => {
    return new Promise<void>((resolve, reject) => {
      const addr = server.address() as { port: number };
      const jwt = fakeJwt({ tenant_id: TENANT_A });
      const req = http.request({
        hostname: 'localhost', port: addr.port,
        method: 'GET', path: `/api/billing/export/${TENANT_A}`,
        headers: { Authorization: `Bearer ${jwt}` },
      }, (res) => {
        assert.ok(res.headers['content-type']?.includes('text/csv'), `content-type=${res.headers['content-type']}`);
        let csv = '';
        res.on('data', c => csv += c);
        res.on('end', () => {
          assert.ok(csv.startsWith('date,model,input_tokens'), `csv starts=${csv.slice(0,50)}`);
          assert.ok(csv.includes('gpt'), 'csv contains gpt row');
          assert.equal(res.statusCode, 200);
          resolve();
        });
      });
      req.on('error', reject);
      req.end();
    });
  });

  it('POST /budget/:tenantId sets ceiling and GET /usage reflects it', async () => {
    const jwt = fakeJwt({ tenant_id: TENANT_A });
    const set = await request(server, 'POST', `/api/billing/budget/${TENANT_A}`, {
      headers: { Authorization: `Bearer ${jwt}` },
      body: { limitUSD: 99.99 },
    });
    assert.equal(set.status, 200);

    const get = await request(server, 'GET', `/api/billing/usage/${TENANT_A}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.equal((get.body as any).budgetLimit, 99.99);
  });

  it('POST /budget rejects non-numeric limitUSD with 400', async () => {
    const jwt = fakeJwt({ tenant_id: TENANT_A });
    const r = await request(server, 'POST', `/api/billing/budget/${TENANT_A}`, {
      headers: { Authorization: `Bearer ${jwt}` },
      body: { limitUSD: 'not-a-number' },
    });
    assert.equal(r.status, 400);
  });

  it('POST /budget rejects negative limitUSD with 400', async () => {
    const jwt = fakeJwt({ tenant_id: TENANT_A });
    const r = await request(server, 'POST', `/api/billing/budget/${TENANT_A}`, {
      headers: { Authorization: `Bearer ${jwt}` },
      body: { limitUSD: -5 },
    });
    assert.equal(r.status, 400);
  });
});
