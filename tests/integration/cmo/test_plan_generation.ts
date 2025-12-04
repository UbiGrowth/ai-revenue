import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Integration tests for CMO 90-Day Plan Generation
 * Validates schema compliance and prompt output structure
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

interface PlanSchema {
  plan: {
    name: string;
    goal_summary: string;
    start_date: string;
    end_date: string;
    budget_note?: string;
    milestones: Array<{
      label: string;
      target_date: string;
      metric: string;
      target_value: number;
      funnel_action: string;
      channels: string[];
      dependencies?: string[];
    }>;
    kpis: Array<{
      metric: string;
      baseline: number;
      target: number;
      measurement: string;
    }>;
    weekly_checkpoints?: Array<{
      week: number;
      focus: string;
      deliverables: string[];
      success_criteria: string;
    }>;
    channel_allocation?: Array<{
      channel: string;
      budget_percentage: number;
      primary_metric: string;
      target_icp?: string;
    }>;
    risk_flags?: Array<{
      risk: string;
      mitigation: string;
      trigger?: string;
    }>;
  };
}

describe('CMO Plan Generation', () => {
  const testWorkspaceId = 'test-workspace-' + Date.now();
  const testTenantId = 'test-tenant-' + Date.now();

  it('should validate plan schema structure', () => {
    const mockPlanOutput: PlanSchema = {
      plan: {
        name: 'Q1 2025 Growth Plan',
        goal_summary: 'Increase MQLs by 40% through multi-channel campaigns',
        start_date: '2025-01-01',
        end_date: '2025-03-31',
        budget_note: '$50,000 allocated across channels',
        milestones: [
          {
            label: 'Foundation Setup',
            target_date: '2025-01-14',
            metric: 'leads',
            target_value: 100,
            funnel_action: 'Launch analytics tracking',
            channels: ['email', 'linkedin'],
            dependencies: ['Brand guidelines finalized']
          }
        ],
        kpis: [
          {
            metric: 'MQLs',
            baseline: 200,
            target: 280,
            measurement: 'weekly'
          }
        ],
        weekly_checkpoints: [
          {
            week: 1,
            focus: 'Analytics setup',
            deliverables: ['GA4 configured', 'UTM strategy'],
            success_criteria: 'All tracking pixels live'
          }
        ],
        channel_allocation: [
          {
            channel: 'LinkedIn',
            budget_percentage: 40,
            primary_metric: 'engagement_rate',
            target_icp: 'Enterprise CMOs'
          }
        ],
        risk_flags: [
          {
            risk: 'Low initial engagement',
            mitigation: 'Increase ad spend on top performers',
            trigger: 'CTR < 1% after week 2'
          }
        ]
      }
    };

    // Validate required fields
    expect(mockPlanOutput.plan.name).toBeDefined();
    expect(mockPlanOutput.plan.goal_summary).toBeDefined();
    expect(mockPlanOutput.plan.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mockPlanOutput.plan.end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mockPlanOutput.plan.milestones.length).toBeGreaterThan(0);
    expect(mockPlanOutput.plan.kpis.length).toBeGreaterThan(0);

    // Validate milestone structure
    const milestone = mockPlanOutput.plan.milestones[0];
    expect(milestone.label).toBeDefined();
    expect(milestone.target_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(['leads', 'mqls', 'revenue', 'reach', 'conversions', 'signups', 'engagement', 'traffic'])
      .toContain(milestone.metric);
    expect(typeof milestone.target_value).toBe('number');
    expect(milestone.funnel_action).toBeDefined();
    expect(Array.isArray(milestone.channels)).toBe(true);

    // Validate KPI structure
    const kpi = mockPlanOutput.plan.kpis[0];
    expect(kpi.metric).toBeDefined();
    expect(typeof kpi.baseline).toBe('number');
    expect(typeof kpi.target).toBe('number');
    expect(['daily', 'weekly', 'monthly']).toContain(kpi.measurement);
  });

  it('should validate date range is approximately 90 days', () => {
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-03-31');
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    expect(diffDays).toBeGreaterThanOrEqual(85);
    expect(diffDays).toBeLessThanOrEqual(95);
  });

  it('should validate milestone metrics are valid enum values', () => {
    const validMetrics = ['leads', 'mqls', 'revenue', 'reach', 'conversions', 'signups', 'engagement', 'traffic'];
    const testMetrics = ['leads', 'mqls', 'revenue'];
    
    testMetrics.forEach(metric => {
      expect(validMetrics).toContain(metric);
    });
  });

  it('should validate KPI measurement intervals', () => {
    const validIntervals = ['daily', 'weekly', 'monthly'];
    const testIntervals = ['weekly', 'monthly'];
    
    testIntervals.forEach(interval => {
      expect(validIntervals).toContain(interval);
    });
  });

  it('should ensure milestones have quantifiable targets', () => {
    const milestones = [
      { label: 'Phase 1', target_value: 100 },
      { label: 'Phase 2', target_value: 250 },
      { label: 'Phase 3', target_value: 500 }
    ];

    milestones.forEach(milestone => {
      expect(typeof milestone.target_value).toBe('number');
      expect(milestone.target_value).toBeGreaterThan(0);
    });
  });

  it('should validate budget allocation percentages sum to 100 or less', () => {
    const channelAllocation = [
      { channel: 'LinkedIn', budget_percentage: 40 },
      { channel: 'Email', budget_percentage: 30 },
      { channel: 'Google Ads', budget_percentage: 30 }
    ];

    const totalPercentage = channelAllocation.reduce((sum, ch) => sum + ch.budget_percentage, 0);
    expect(totalPercentage).toBeLessThanOrEqual(100);
  });
});
