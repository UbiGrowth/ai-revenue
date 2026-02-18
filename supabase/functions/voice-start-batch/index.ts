/**
 * Start Batch Voice Campaign
 * POST /api/voice/start-batch
 * 
 * Initiates a batch campaign by queueing calls to target segment leads
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const { campaign_id } = await req.json();

    if (!campaign_id) {
      throw new Error('Missing required field: campaign_id');
    }

    // 1. Fetch campaign
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('voice_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign not found: ${campaign_id}`);
    }

    // Verify user belongs to tenant
    const { data: userTenant, error: tenantCheckError } = await supabaseClient
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('tenant_id', campaign.tenant_id)
      .single();

    if (tenantCheckError || !userTenant) {
      throw new Error('User does not belong to campaign tenant');
    }

    // 2. Fetch voice agent
    const { data: voiceAgent, error: agentError } = await supabaseClient
      .from('voice_agents')
      .select('*')
      .eq('id', campaign.voice_agent_id)
      .single();

    if (agentError || !voiceAgent) {
      throw new Error(`Voice agent not found: ${campaign.voice_agent_id}`);
    }

    // 3. Fetch voice phone number
    const { data: voiceNumber, error: numberError } = await supabaseClient
      .from('voice_phone_numbers')
      .select('*')
      .eq('id', campaign.voice_number_id)
      .single();

    if (numberError || !voiceNumber) {
      throw new Error(`Voice phone number not found: ${campaign.voice_number_id}`);
    }

    // 4. Query leads from target segment
    let query = supabaseClient
      .from('leads')
      .select('id, name, email, phone, data')
      .eq('tenant_id', campaign.tenant_id);

    // Apply segment filter if defined
    if (campaign.target_segment) {
      const segment = campaign.target_segment;
      
      if (segment.status) {
        query = query.eq('status', segment.status);
      }
      if (segment.score_min !== undefined) {
        query = query.gte('score', segment.score_min);
      }
      if (segment.score_max !== undefined) {
        query = query.lte('score', segment.score_max);
      }
      if (segment.tags && segment.tags.length > 0) {
        query = query.contains('tags', segment.tags);
      }
    }

    const { data: leads, error: leadsError } = await query;

    if (leadsError) {
      throw new Error(`Failed to query leads: ${leadsError.message}`);
    }

    if (!leads || leads.length === 0) {
      throw new Error('No leads found matching target segment');
    }

    // Filter leads with valid phone numbers
    const callableLeads = leads.filter(lead => lead.phone && lead.phone.trim() !== '');

    if (callableLeads.length === 0) {
      throw new Error('No leads with valid phone numbers in target segment');
    }

    console.log(`📞 Starting batch campaign: ${callableLeads.length} leads queued`);

    // 5. Queue calls for each lead
    const callResults = [];
    const errors = [];

    for (const lead of callableLeads) {
      try {
        // Prepare call payload
        const callPayload: any = {
          agent_id: voiceAgent.elevenlabs_agent_id,
          phone_number: lead.phone,
          from_number: voiceNumber.phone_number,
          metadata: {
            campaign_id: campaign_id,
            lead_id: lead.id,
            lead_name: lead.name,
            lead_email: lead.email,
          },
        };

        // Initiate call
        const callResponse = await fetch('https://api.elevenlabs.io/v1/convai/conversations/phone', {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(callPayload),
        });

        if (!callResponse.ok) {
          const errorText = await callResponse.text();
          errors.push({ lead_id: lead.id, error: errorText });
          continue;
        }

        const callData = await callResponse.json();
        const conversationId = callData.conversation_id || callData.id;

        // Create call record
        const { data: callRecord, error: recordError } = await supabaseClient
          .from('voice_call_records')
          .insert({
            tenant_id: campaign.tenant_id,
            workspace_id: campaign.workspace_id,
            voice_agent_id: campaign.voice_agent_id,
            voice_number_id: campaign.voice_number_id,
            campaign_id: campaign_id,
            lead_id: lead.id,
            from_number: voiceNumber.phone_number,
            to_number: lead.phone,
            direction: 'outbound',
            provider: 'elevenlabs',
            provider_call_id: conversationId,
            status: 'initiated',
            started_at: new Date().toISOString(),
          })
          .select('*')
          .single();

        if (recordError) {
          errors.push({ lead_id: lead.id, error: recordError.message });
        } else {
          callResults.push({
            lead_id: lead.id,
            call_id: callRecord.id,
            conversation_id: conversationId,
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        errors.push({
          lead_id: lead.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 6. Update campaign status
    const { error: updateError } = await supabaseClient
      .from('voice_campaigns')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        stats: {
          total_leads: callableLeads.length,
          calls_initiated: callResults.length,
          calls_failed: errors.length,
        },
      })
      .eq('id', campaign_id);

    if (updateError) {
      console.error('Failed to update campaign status:', updateError);
    }

    console.log(`✅ Batch campaign started: ${callResults.length} calls initiated, ${errors.length} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaign_id,
        calls_initiated: callResults.length,
        calls_failed: errors.length,
        total_leads: callableLeads.length,
        call_results: callResults,
        errors: errors.length > 0 ? errors : undefined,
        message: `Batch campaign started: ${callResults.length} calls initiated`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error starting batch campaign:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
