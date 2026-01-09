// Lead Qualification Agent
// Analyzes and scores incoming leads automatically

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import OpenAI from "npm:openai@^4.20.1"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

if (!OPENAI_API_KEY) {
  console.error('FATAL: OPENAI_API_KEY environment variable is not set');
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || 'dummy-key-will-fail'
})

interface LeadInput {
  name?: string
  company?: string
  email?: string
  phone?: string
  title?: string
  industry?: string
  company_size?: string
  budget?: string
  timeline?: string
  source?: string
  notes?: string
  raw_text?: string
}

serve(async (req) => {
  try {
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: OPENAI_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const leadData: LeadInput = await req.json()
    
    // Build context from lead data
    const leadContext = leadData.raw_text || `
Name: ${leadData.name || 'Unknown'}
Company: ${leadData.company || 'Unknown'}
Email: ${leadData.email || 'Unknown'}
Phone: ${leadData.phone || 'Unknown'}
Title: ${leadData.title || 'Unknown'}
Industry: ${leadData.industry || 'Unknown'}
Company Size: ${leadData.company_size || 'Unknown'}
Budget: ${leadData.budget || 'Unknown'}
Timeline: ${leadData.timeline || 'Unknown'}
Source: ${leadData.source || 'Unknown'}
Notes: ${leadData.notes || 'None'}
    `.trim()
    
    console.log("Qualifying lead:", leadData.name || leadData.email)
    
    // Call OpenAI to analyze and score the lead
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert lead qualification analyst for a B2B marketing automation platform.

Analyze leads based on:
- Company quality (size, industry fit)
- Contact quality (decision maker level, completeness)
- Budget indicators
- Timeline urgency
- Engagement signals

Return ONLY valid JSON with this exact structure:
{
  "score": <1-10 integer>,
  "quality": "<hot|warm|cold>",
  "reasoning": "<brief explanation>",
  "recommended_action": "<immediate_outreach|nurture_campaign|generic_drip|disqualify>",
  "priority": "<high|medium|low>",
  "next_steps": "<specific action to take>",
  "estimated_value": "<low|medium|high>",
  "signals": {
    "positive": ["<signal1>", "<signal2>"],
    "negative": ["<concern1>", "<concern2>"],
    "missing": ["<info1>", "<info2>"]
  }
}`
        },
        {
          role: 'user',
          content: `Qualify this lead:\n\n${leadContext}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500
    })
    
    const analysis = JSON.parse(completion.choices[0].message.content)
    
    // Add metadata
    const result = {
      success: true,
      lead_id: leadData.email || leadData.name,
      input_data: leadData,
      qualification: analysis,
      tokens_used: completion.usage,
      qualified_at: new Date().toISOString()
    }
    
    console.log(`✅ Lead qualified: ${analysis.quality} (score: ${analysis.score}/10)`)
    
    return new Response(
      JSON.stringify(result, null, 2),
      { 
        headers: { 
          "Content-Type": "application/json",
          "X-Lead-Score": String(analysis.score),
          "X-Lead-Quality": analysis.quality
        },
        status: 200
      }
    )
    
  } catch (error) {
    console.error("❌ Error qualifying lead:", error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: error.stack
      }, null, 2),
      { 
        headers: { "Content-Type": "application/json" },
        status: 500
      }
    )
  }
})
