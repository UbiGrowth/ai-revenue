import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlanRequest {
  workspaceId: string;
  primaryGoal?: string;
  budget?: number;
  focusAreas?: string[];
  startDate?: string;
}

const systemPrompt = `You are the Strategic Marketing Planner for the UbiGrowth AI CMO module.
Your task is to generate comprehensive 90-day marketing plans based on brand profile, ICP segments, and offers data.

## Your Role
- Expert marketing strategist with deep experience in growth marketing
- Create actionable, measurable plans aligned with business objectives
- Balance quick wins with long-term brand building
- Optimize channel mix based on ICP preferences and budget

## Output Schema (Database-Ready JSON)

You MUST output a complete 90-day plan in this EXACT JSON format:

\`\`\`json:plan
{
  "plan_name": "Q[X] 2024 Growth Plan - [Primary Goal]",
  "executive_summary": "2-3 paragraph strategic overview",
  "primary_objectives": [
    {
      "objective": "string",
      "target_metric": "string",
      "baseline": "string or number",
      "goal": "string or number",
      "priority": "high|medium|low"
    }
  ],
  "key_metrics": [
    {
      "metric_name": "string",
      "current_value": "string",
      "target_value": "string",
      "measurement_frequency": "daily|weekly|monthly"
    }
  ],
  "budget_allocation": {
    "total_budget": 0,
    "currency": "USD",
    "breakdown": [
      {"category": "Paid Ads", "amount": 0, "percentage": 0},
      {"category": "Content", "amount": 0, "percentage": 0},
      {"category": "Tools/Software", "amount": 0, "percentage": 0},
      {"category": "Events/Partnerships", "amount": 0, "percentage": 0}
    ]
  },
  "month_1_plan": {
    "theme": "Foundation & Quick Wins",
    "focus_areas": ["string"],
    "campaigns": [
      {
        "name": "string",
        "objective": "string",
        "channels": ["string"],
        "target_icp": "segment_name",
        "offer_promoted": "offer_name or null",
        "tactics": ["string"],
        "deliverables": ["string"],
        "success_metrics": ["string"],
        "budget": 0
      }
    ],
    "content_pieces": [
      {
        "type": "blog|video|social|email|whitepaper|webinar",
        "title": "string",
        "target_icp": "string",
        "goal": "awareness|consideration|conversion",
        "publish_week": 1
      }
    ],
    "milestones": ["string"]
  },
  "month_2_plan": {
    "theme": "Acceleration & Optimization",
    "focus_areas": ["string"],
    "campaigns": [],
    "content_pieces": [],
    "milestones": []
  },
  "month_3_plan": {
    "theme": "Scale & Compound",
    "focus_areas": ["string"],
    "campaigns": [],
    "content_pieces": [],
    "milestones": []
  },
  "channel_mix": [
    {
      "channel": "string",
      "role": "primary|secondary|experimental",
      "budget_percentage": 0,
      "target_icps": ["string"],
      "content_types": ["string"],
      "posting_frequency": "string",
      "kpis": ["string"]
    }
  ],
  "campaign_themes": [
    {
      "theme_name": "string",
      "description": "string",
      "duration_weeks": 0,
      "start_week": 0,
      "messaging_angle": "string",
      "target_icps": ["string"],
      "offers_featured": ["string"]
    }
  ],
  "content_calendar_outline": [
    {
      "week": 1,
      "theme": "string",
      "content_pieces": [
        {"type": "string", "topic": "string", "channel": "string"}
      ]
    }
  ],
  "resource_requirements": [
    {
      "resource": "string",
      "type": "human|tool|budget|asset",
      "priority": "required|nice-to-have",
      "estimated_cost": 0,
      "notes": "string"
    }
  ],
  "dependencies": [
    {
      "dependency": "string",
      "blocker_for": "string",
      "owner": "string",
      "due_date": "string"
    }
  ],
  "risks_mitigations": [
    {
      "risk": "string",
      "likelihood": "high|medium|low",
      "impact": "high|medium|low",
      "mitigation": "string"
    }
  ],
  "target_icp_segments": ["segment_name1", "segment_name2"],
  "target_offers": ["offer_name1", "offer_name2"]
}
\`\`\`

## Planning Rules

1. **ICP-Driven**: Every campaign and content piece must target a specific ICP segment
2. **Offer Integration**: Feature offers strategically based on ICP pain points and buying triggers
3. **Channel Alignment**: Match channels to ICP preferred channels from intake data
4. **Messaging Consistency**: Align all messaging with brand voice and messaging pillars
5. **Progressive Complexity**:
   - Month 1: Foundation, quick wins, establish baselines
   - Month 2: Optimize based on M1 learnings, scale what works
   - Month 3: Full scale, compound gains, prepare next quarter
6. **Budget Realism**: Allocate budget based on channel effectiveness for target ICPs
7. **Measurability**: Every activity must have clear success metrics
8. **Resource Awareness**: Flag required resources and dependencies

## Content Mix Guidelines

- 60% educational/value content
- 25% promotional/offer content  
- 15% brand/thought leadership content

## Channel Selection Priority

Based on ICP data, prioritize channels where target customers actually spend time.
Consider:
- B2B: LinkedIn, Email, Webinars, Industry publications
- B2C: Instagram, TikTok, Facebook, YouTube, Email
- Local: Google My Business, Local SEO, Community events

Generate a comprehensive, actionable 90-day plan.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, primaryGoal, budget, focusAreas, startDate } = await req.json() as PlanRequest;
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch brand, ICP, and offers data
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const [brandResult, icpResult, offersResult] = await Promise.all([
      supabase.from('cmo_brand_profiles').select('*').eq('workspace_id', workspaceId).single(),
      supabase.from('cmo_icp_segments').select('*').eq('workspace_id', workspaceId),
      supabase.from('cmo_offers').select('*').eq('workspace_id', workspaceId)
    ]);

    if (!brandResult.data) {
      return new Response(JSON.stringify({ 
        error: 'Brand profile not found. Please complete brand intake first.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const brand = brandResult.data;
    const icpSegments = icpResult.data || [];
    const offers = offersResult.data || [];

    console.log('CMO 90-Day Plan - Loading context:', {
      brandName: brand.brand_name,
      icpCount: icpSegments.length,
      offersCount: offers.length
    });

    // Build context prompt
    const contextPrompt = `## Brand Context

**Brand Name:** ${brand.brand_name}
**Industry:** ${brand.industry || 'Not specified'}
**Tagline:** ${brand.tagline || 'Not specified'}
**Mission:** ${brand.mission_statement || 'Not specified'}

**Brand Voice:** ${brand.brand_voice || 'Professional'}
**Brand Tone:** ${brand.brand_tone || 'Not specified'}
**Brand Personality:** ${JSON.stringify(brand.brand_personality || [])}

**Unique Value Proposition:** ${brand.unique_value_proposition || 'Not specified'}
**Key Differentiators:** ${JSON.stringify(brand.key_differentiators || [])}
**Messaging Pillars:** ${JSON.stringify(brand.messaging_pillars || [])}
**Content Themes:** ${JSON.stringify(brand.content_themes || [])}

**Competitors:** ${JSON.stringify(brand.competitors || [])}

## ICP Segments (${icpSegments.length} defined)

${icpSegments.map((icp, i) => `
### ICP ${i + 1}: ${icp.segment_name}${icp.is_primary ? ' (PRIMARY)' : ''}
- **Description:** ${icp.segment_description || 'Not specified'}
- **Demographics:** ${JSON.stringify(icp.demographics || {})}
- **Pain Points:** ${JSON.stringify(icp.pain_points || [])}
- **Goals:** ${JSON.stringify(icp.goals || [])}
- **Buying Triggers:** ${JSON.stringify(icp.buying_triggers || [])}
- **Objections:** ${JSON.stringify(icp.objections || [])}
- **Preferred Channels:** ${JSON.stringify(icp.preferred_channels || [])}
- **Content Preferences:** ${JSON.stringify(icp.content_preferences || {})}
- **Budget Range:** ${JSON.stringify(icp.budget_range || {})}
- **Job Titles:** ${JSON.stringify(icp.job_titles || [])}
- **Industry Verticals:** ${JSON.stringify(icp.industry_verticals || [])}
`).join('\n')}

## Offers (${offers.length} defined)

${offers.map((offer, i) => `
### Offer ${i + 1}: ${offer.offer_name}${offer.is_flagship ? ' (FLAGSHIP)' : ''}
- **Type:** ${offer.offer_type}
- **Description:** ${offer.description || 'Not specified'}
- **Key Benefits:** ${JSON.stringify(offer.key_benefits || [])}
- **Features:** ${JSON.stringify(offer.features || [])}
- **Pricing Model:** ${offer.pricing_model || 'Not specified'}
- **Price Range:** ${JSON.stringify(offer.price_range || {})}
- **Target Segments:** ${JSON.stringify(offer.target_segments || [])}
- **Use Cases:** ${JSON.stringify(offer.use_cases || [])}
- **Competitive Positioning:** ${offer.competitive_positioning || 'Not specified'}
`).join('\n')}

## Planning Parameters

- **Primary Goal:** ${primaryGoal || 'Growth and brand awareness'}
- **Available Budget:** ${budget ? `$${budget.toLocaleString()}` : 'Not specified (create flexible plan)'}
- **Focus Areas:** ${focusAreas?.length ? focusAreas.join(', ') : 'All areas'}
- **Start Date:** ${startDate || 'Next available'}

Generate a complete 90-day marketing plan optimized for these inputs.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('AI gateway error');
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('CMO 90-Day Plan error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
