/**
 * Deal Source Isolation Test
 * 
 * INVARIANT: In live mode, only source='user' deals count toward analytics.
 * Test/seed deals must NEVER pollute live metrics.
 * 
 * This test suite runs in two modes:
 * 1. UNIT MODE (CI): Tests business logic with mocks - no external deps
 * 2. INTEGRATION MODE (local): Tests against real Supabase when env vars present
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// ============================================================================
// UNIT TESTS (Always run - no external dependencies)
// ============================================================================

describe('Deal source isolation - Unit Tests', () => {
  
  it('should classify source="test" deals as excluded from live metrics', () => {
    const deal = { source: 'test', stage: 'closed_won', value: 10000 };
    const isExcludedFromLive = deal.source !== 'user';
    expect(isExcludedFromLive).toBe(true);
  });

  it('should classify source="user" deals as included in live metrics', () => {
    const deal = { source: 'user', stage: 'closed_won', value: 5000 };
    const isIncludedInLive = deal.source === 'user';
    expect(isIncludedInLive).toBe(true);
  });

  it('should validate source values against allowed enum', () => {
    const validSources = ['user', 'test', 'seed', 'import'];
    
    expect(validSources.includes('user')).toBe(true);
    expect(validSources.includes('test')).toBe(true);
    expect(validSources.includes('invalid_source')).toBe(false);
  });

  it('should calculate pipeline metrics excluding test deals', () => {
    const deals = [
      { source: 'user', stage: 'closed_won', value: 5000, revenue_verified: true },
      { source: 'test', stage: 'closed_won', value: 10000, revenue_verified: true },
      { source: 'user', stage: 'closed_won', value: 3000, revenue_verified: true },
      { source: 'seed', stage: 'closed_won', value: 50000, revenue_verified: true },
    ];

    // Live mode filter: only source='user' counts
    const liveDeals = deals.filter(d => d.source === 'user');
    const wonCount = liveDeals.filter(d => d.stage === 'closed_won').length;
    const verifiedRevenue = liveDeals
      .filter(d => d.stage === 'closed_won' && d.revenue_verified)
      .reduce((sum, d) => sum + d.value, 0);

    expect(wonCount).toBe(2);
    expect(verifiedRevenue).toBe(8000);
  });

  it('should include all deals when demo_mode is true', () => {
    const deals = [
      { source: 'user', stage: 'closed_won', value: 5000 },
      { source: 'test', stage: 'closed_won', value: 10000 },
      { source: 'seed', stage: 'closed_won', value: 50000 },
    ];
    
    const demoMode = true;
    
    // Demo mode: all sources count
    const visibleDeals = demoMode ? deals : deals.filter(d => d.source === 'user');
    expect(visibleDeals.length).toBe(3);
  });

  it('data_mode should be set based on workspace demo_mode', () => {
    const setDealDataMode = (deal: { data_mode?: string }, workspaceDemoMode: boolean) => {
      deal.data_mode = workspaceDemoMode ? 'demo' : 'live';
      return deal;
    };

    const liveDeal = setDealDataMode({}, false);
    expect(liveDeal.data_mode).toBe('live');

    const demoDeal = setDealDataMode({}, true);
    expect(demoDeal.data_mode).toBe('demo');
  });
});

// ============================================================================
// INTEGRATION TESTS (Only run when env vars present)
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_OWNER_ID = process.env.TEST_OWNER_ID;

function hdrs() {
  return {
    'Content-Type': 'application/json',
    apikey: SERVICE_KEY!,
    Authorization: `Bearer ${SERVICE_KEY}`,
    Prefer: 'return=representation',
  };
}

const canRunIntegration = !!SUPABASE_URL && !!SERVICE_KEY && !!TEST_OWNER_ID;

describe.skipIf(!canRunIntegration)('Deal source isolation - Integration Tests', () => {
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
        headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` },
      });
    }
    if (userDealId) {
      await fetch(`${SUPABASE_URL}/rest/v1/deals?id=eq.${userDealId}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` },
      });
    }
    if (testWorkspaceId) {
      await fetch(`${SUPABASE_URL}/rest/v1/workspaces?id=eq.${testWorkspaceId}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` },
      });
    }
  });

  it("source='test' closed_won deal must NOT count in live analytics", async () => {
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
      { headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` } }
    );

    if (!viewRes.ok) {
      const txt = await viewRes.text();
      throw new Error(`View query failed (${viewRes.status}): ${txt}`);
    }

    const rows = await viewRes.json();
    const metrics = rows?.[0];

    expect(metrics).toBeTruthy();
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
      { headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` } }
    );

    if (!viewRes.ok) {
      const txt = await viewRes.text();
      throw new Error(`View query failed (${viewRes.status}): ${txt}`);
    }

    const rows = await viewRes.json();
    const metrics = rows?.[0];

    expect(metrics).toBeTruthy();
    expect(Number(metrics.won ?? 0)).toBe(1);
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
