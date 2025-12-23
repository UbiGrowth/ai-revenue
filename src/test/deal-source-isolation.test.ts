/**
 * Deal Source Isolation Test
 * 
 * INVARIANT: In live mode, only source='user' deals count toward analytics.
 * Test/seed deals must NEVER pollute live metrics.
 * 
 * Required env vars:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - TEST_OWNER_ID (a real user UUID from auth.users)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_OWNER_ID = process.env.TEST_OWNER_ID!;

function hdrs() {
  return {
    'Content-Type': 'application/json',
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    Prefer: 'return=representation',
  };
}

const canRunTests = !!SUPABASE_URL && !!SERVICE_KEY && !!TEST_OWNER_ID;

describe.skipIf(!canRunTests)('Pipeline metrics: deal source isolation', () => {
  let testWorkspaceId: string | undefined;
  let testDealId: string | undefined;
  let userDealId: string | undefined;

  beforeAll(async () => {
    if (!SUPABASE_URL || !SERVICE_KEY || !TEST_OWNER_ID) {
      throw new Error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_OWNER_ID');
    }

    const slug = `source-test-${Date.now()}`;

    const wsRes = await fetch(`${SUPABASE_URL}/rest/v1/workspaces`, {
      method: 'POST',
      headers: hdrs(),
      body: JSON.stringify({
        name: `Source Isolation Test - ${Date.now()}`,
        slug,
        owner_id: TEST_OWNER_ID,
        demo_mode: false,
      }),
    });

    if (!wsRes.ok) {
      const txt = await wsRes.text();
      throw new Error(`Workspace create failed (${wsRes.status}): ${txt}`);
    }

    const [workspace] = await wsRes.json();
    testWorkspaceId = workspace.id;
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    if (testDealId) {
      await fetch(`${SUPABASE_URL}/rest/v1/deals?id=eq.${testDealId}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
    }
    if (userDealId) {
      await fetch(`${SUPABASE_URL}/rest/v1/deals?id=eq.${userDealId}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
    }
    if (testWorkspaceId) {
      await fetch(`${SUPABASE_URL}/rest/v1/workspaces?id=eq.${testWorkspaceId}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
    }
  });

  it("source='test' closed_won deal must NOT count in live analytics", async () => {
    // Insert test deal that should be excluded by the view filter in live mode
    const dealRes = await fetch(`${SUPABASE_URL}/rest/v1/deals`, {
      method: 'POST',
      headers: hdrs(),
      body: JSON.stringify({
        workspace_id: testWorkspaceId,
        name: 'Test Deal - Should Not Count',
        stage: 'closed_won',
        value: 10000,
        revenue_verified: true,
        source: 'test',
      }),
    });

    if (!dealRes.ok) {
      const txt = await dealRes.text();
      throw new Error(`Deal create failed (${dealRes.status}): ${txt}`);
    }

    const [deal] = await dealRes.json();
    testDealId = deal.id;

    const viewRes = await fetch(
      `${SUPABASE_URL}/rest/v1/v_pipeline_metrics_by_workspace?workspace_id=eq.${testWorkspaceId}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );

    if (!viewRes.ok) {
      const txt = await viewRes.text();
      throw new Error(`View query failed (${viewRes.status}): ${txt}`);
    }

    const rows = await viewRes.json();
    const metrics = rows?.[0];

    // If the view returns no row, that's also a failure (view should emit 1 row per workspace)
    expect(metrics).toBeTruthy();

    // INVARIANT: source='test' excluded in live mode => won must remain 0
    expect(Number(metrics.won ?? 0)).toBe(0);
    expect(Number(metrics.verified_revenue ?? 0)).toBe(0);
  });

  it("source='user' closed_won deal MUST count in live analytics", async () => {
    const dealRes = await fetch(`${SUPABASE_URL}/rest/v1/deals`, {
      method: 'POST',
      headers: hdrs(),
      body: JSON.stringify({
        workspace_id: testWorkspaceId,
        name: 'User Deal - Should Count',
        stage: 'closed_won',
        value: 5000,
        revenue_verified: true,
        source: 'user',
      }),
    });

    if (!dealRes.ok) {
      const txt = await dealRes.text();
      throw new Error(`Deal create failed (${dealRes.status}): ${txt}`);
    }

    const [deal] = await dealRes.json();
    userDealId = deal.id;

    const viewRes = await fetch(
      `${SUPABASE_URL}/rest/v1/v_pipeline_metrics_by_workspace?workspace_id=eq.${testWorkspaceId}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );

    if (!viewRes.ok) {
      const txt = await viewRes.text();
      throw new Error(`View query failed (${viewRes.status}): ${txt}`);
    }

    const rows = await viewRes.json();
    const metrics = rows?.[0];

    expect(metrics).toBeTruthy();

    // INVARIANT: only the user deal counts => won must be 1
    expect(Number(metrics.won ?? 0)).toBe(1);
    // revenue_verified true => verified_revenue should be 5000 (if your view sums it)
    expect(Number(metrics.verified_revenue ?? 0)).toBe(5000);
  });

  it('source constraint rejects invalid values', async () => {
    const dealRes = await fetch(`${SUPABASE_URL}/rest/v1/deals`, {
      method: 'POST',
      headers: hdrs(),
      body: JSON.stringify({
        workspace_id: testWorkspaceId,
        name: 'Invalid Source Deal',
        stage: 'prospecting',
        value: 1000,
        source: 'invalid_source',
      }),
    });

    expect(dealRes.ok).toBe(false);
  });
});
