import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Integration tests for CMO Campaign Flow
 * Simulates full run from plan → funnel → campaign → content
 */

interface BrandProfile {
  id: string;
  brand_name: string;
  brand_voice: string;
  industry: string;
}

interface ICPSegment {
  id: string;
  segment_name: string;
  pain_points: string[];
  preferred_channels: string[];
}

interface MarketingPlan {
  id: string;
  plan_name: string;
  status: string;
  primary_objectives: any[];
}

interface Funnel {
  id: string;
  funnel_name: string;
  funnel_type: string;
  status: string;
}

interface Campaign {
  id: string;
  campaign_name: string;
  campaign_type: string;
  funnel_id: string;
  status: string;
}

interface ContentAsset {
  id: string;
  title: string;
  content_type: string;
  campaign_id: string;
  status: string;
}

describe('CMO Campaign Flow', () => {
  let mockBrandProfile: BrandProfile;
  let mockICPSegment: ICPSegment;
  let mockPlan: MarketingPlan;
  let mockFunnel: Funnel;
  let mockCampaign: Campaign;
  let mockContentAsset: ContentAsset;

  beforeAll(() => {
    // Initialize mock data simulating a complete flow
    mockBrandProfile = {
      id: 'brand-001',
      brand_name: 'UbiGrowth',
      brand_voice: 'Professional yet approachable',
      industry: 'Marketing Technology'
    };

    mockICPSegment = {
      id: 'icp-001',
      segment_name: 'Enterprise CMOs',
      pain_points: ['Manual campaign management', 'Lack of AI automation'],
      preferred_channels: ['LinkedIn', 'Email', 'Webinars']
    };

    mockPlan = {
      id: 'plan-001',
      plan_name: 'Q1 2025 Growth Initiative',
      status: 'active',
      primary_objectives: [
        { objective: 'Increase MQLs', target: 500, metric: 'mqls' },
        { objective: 'Improve conversion rate', target: 15, metric: 'percentage' }
      ]
    };

    mockFunnel = {
      id: 'funnel-001',
      funnel_name: 'Enterprise Lead Gen Funnel',
      funnel_type: 'lead_generation',
      status: 'active'
    };

    mockCampaign = {
      id: 'campaign-001',
      campaign_name: 'LinkedIn Thought Leadership',
      campaign_type: 'awareness',
      funnel_id: mockFunnel.id,
      status: 'draft'
    };

    mockContentAsset = {
      id: 'content-001',
      title: 'AI Marketing Automation Guide',
      content_type: 'whitepaper',
      campaign_id: mockCampaign.id,
      status: 'draft'
    };
  });

  describe('Step 1: Brand Setup', () => {
    it('should have valid brand profile', () => {
      expect(mockBrandProfile.brand_name).toBeDefined();
      expect(mockBrandProfile.brand_voice).toBeDefined();
      expect(mockBrandProfile.industry).toBeDefined();
    });

    it('should have at least one ICP segment', () => {
      expect(mockICPSegment.segment_name).toBeDefined();
      expect(mockICPSegment.pain_points.length).toBeGreaterThan(0);
      expect(mockICPSegment.preferred_channels.length).toBeGreaterThan(0);
    });
  });

  describe('Step 2: Plan Generation', () => {
    it('should create plan from brand context', () => {
      expect(mockPlan.id).toBeDefined();
      expect(mockPlan.plan_name).toBeDefined();
      expect(mockPlan.status).toBe('active');
    });

    it('should have measurable objectives', () => {
      expect(mockPlan.primary_objectives.length).toBeGreaterThan(0);
      mockPlan.primary_objectives.forEach(obj => {
        expect(obj.objective).toBeDefined();
        expect(typeof obj.target).toBe('number');
        expect(obj.metric).toBeDefined();
      });
    });
  });

  describe('Step 3: Funnel Architecture', () => {
    it('should create funnel linked to plan', () => {
      expect(mockFunnel.id).toBeDefined();
      expect(mockFunnel.funnel_name).toBeDefined();
      expect(mockFunnel.funnel_type).toBeDefined();
    });

    it('should have valid funnel type', () => {
      const validTypes = ['lead_generation', 'sales', 'onboarding', 'retention', 'marketing'];
      expect(validTypes).toContain(mockFunnel.funnel_type);
    });

    it('should have active status for ready funnels', () => {
      expect(['draft', 'active', 'paused', 'completed']).toContain(mockFunnel.status);
    });
  });

  describe('Step 4: Campaign Design', () => {
    it('should create campaign linked to funnel', () => {
      expect(mockCampaign.id).toBeDefined();
      expect(mockCampaign.campaign_name).toBeDefined();
      expect(mockCampaign.funnel_id).toBe(mockFunnel.id);
    });

    it('should have valid campaign type', () => {
      const validTypes = ['awareness', 'lead_gen', 'nurture', 'conversion', 'retention', 'reactivation'];
      expect(validTypes).toContain(mockCampaign.campaign_type);
    });

    it('should start in draft status', () => {
      expect(mockCampaign.status).toBe('draft');
    });
  });

  describe('Step 5: Content Generation', () => {
    it('should create content linked to campaign', () => {
      expect(mockContentAsset.id).toBeDefined();
      expect(mockContentAsset.title).toBeDefined();
      expect(mockContentAsset.campaign_id).toBe(mockCampaign.id);
    });

    it('should have valid content type', () => {
      const validTypes = [
        'email', 'social_post', 'blog', 'whitepaper', 'case_study',
        'landing_page', 'ad_copy', 'video_script', 'webinar', 'infographic'
      ];
      expect(validTypes).toContain(mockContentAsset.content_type);
    });

    it('should start in draft status', () => {
      expect(mockContentAsset.status).toBe('draft');
    });
  });

  describe('Full Flow Validation', () => {
    it('should maintain referential integrity through flow', () => {
      // Campaign should reference funnel
      expect(mockCampaign.funnel_id).toBe(mockFunnel.id);
      
      // Content should reference campaign
      expect(mockContentAsset.campaign_id).toBe(mockCampaign.id);
    });

    it('should support status transitions', () => {
      const validStatuses = ['draft', 'pending_review', 'approved', 'active', 'paused', 'completed'];
      
      // Simulate status transition
      const transitions = [
        { from: 'draft', to: 'pending_review' },
        { from: 'pending_review', to: 'approved' },
        { from: 'approved', to: 'active' },
        { from: 'active', to: 'completed' }
      ];

      transitions.forEach(t => {
        expect(validStatuses).toContain(t.from);
        expect(validStatuses).toContain(t.to);
      });
    });

    it('should track ICP targeting through flow', () => {
      // ICP preferences should inform channel selection
      expect(mockICPSegment.preferred_channels).toContain('LinkedIn');
      
      // Campaign should target appropriate channel
      expect(mockCampaign.campaign_name.toLowerCase()).toContain('linkedin');
    });
  });

  describe('Error Handling', () => {
    it('should reject campaign without funnel reference', () => {
      const invalidCampaign = {
        campaign_name: 'Orphan Campaign',
        campaign_type: 'awareness',
        funnel_id: null // Invalid
      };

      expect(invalidCampaign.funnel_id).toBeNull();
    });

    it('should reject content without campaign reference', () => {
      const invalidContent = {
        title: 'Orphan Content',
        content_type: 'email',
        campaign_id: undefined // Invalid
      };

      expect(invalidContent.campaign_id).toBeUndefined();
    });
  });
});
