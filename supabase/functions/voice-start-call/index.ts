/**
 * Start Outbound Voice Call
 * POST /api/voice/start-call
 * 
 * Initiates a single outbound call via ElevenLabs
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
    const {
      voice_agent_id,
      voice_number_id,
      to_phone_number,
      lead_id,
      campaign_id,
      variables = {},
    } = await req.json();

    if (!voice_agent_id || !voice_number_id || !to_phone_number) {
      throw new Error('Missing required fields: voice_agent_id, voice_number_id, to_phone_number');
    }

    // 1. Fetch voice agent
    const { data: voiceAgent, error: agentError } = await supabaseClient
      .from('voice_agents')
      .select('*')
      .eq('id', voice_agent_id)
      .single();

    if (agentError || !voiceAgent) {
      throw new Error(`Voice agent not found: ${voice_agent_id}`);
    }

    // Verify user belongs to tenant
    const { data: userTenant, error: tenantCheckError } = await supabaseClient
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('tenant_id', voiceAgent.tenant_id)
      .single();

    if (tenantCheckError || !userTenant) {
      throw new Error('User does not belong to agent tenant');
    }

    // 2. Fetch voice phone number
    const { data: voiceNumber, error: numberError } = await supabaseClient
      .from('voice_phone_numbers')
      .select('*')
      .eq('id', voice_number_id)
      .eq('tenant_id', voiceAgent.tenant_id)
      .single();

    if (numberError || !voiceNumber) {
      throw new Error(`Voice phone number not found: ${voice_number_id}`);
    }

    if (!voiceAgent.elevenlabs_agent_id) {
      throw new Error('Agent not deployed to ElevenLabs');
    }

    // 3. Fetch lead details if lead_id provided
    let leadData = null;
    if (lead_id) {
      const { data: lead, error: leadError } = await supabaseClient
        .from('leads')
        .select('*')
        .eq('id', lead_id)
        .single();

      if (!leadError && lead) {
        leadData = lead;
      }
    }

    // 4. Start call via ElevenLabs API
    const callPayload: any = {
      agent_id: voiceAgent.elevenlabs_agent_id,
      phone_number: to_phone_number,
      from_number: voiceNumber.phone_number,
    };

    // Add custom variables if provided
    if (Object.keys(variables).length > 0 || leadData) {
      callPayload.metadata = {
        ...variables,
        ...(leadData && {
          lead_id: lead_id,
          lead_name: leadData.name,
          lead_email: leadData.email,
        }),
      };
    }

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
      throw new Error(`ElevenLabs call initiation failed: ${errorText}`);
    }

    const callData = await callResponse.json();
    const conversationId = callData.conversation_id || callData.id;

    // 5. Create voice_call_records entry
    const { data: callRecord, error: recordError } = await supabaseClient
      .from('voice_call_records')
      .insert({
        tenant_id: voiceAgent.tenant_id,
        workspace_id: voiceAgent.workspace_id,
        voice_agent_id: voice_agent_id,
        phone_number_id: voice_number_id,
        campaign_id: campaign_id || null,
        lead_id: lead_id || null,
        customer_number: to_phone_number,
        call_type: 'outbound',
        provider_call_id: conversationId,
        status: 'initiated',
        started_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (recordError || !callRecord) {
      console.error('Failed to create call record:', recordError);
    }

    console.log(`✅ Call initiated: ${voiceNumber.phone_number} -> ${to_phone_number} (${conversationId})`);

    return new Response(
      JSON.stringify({
        success: true,
        call_record: callRecord,
        conversation_id: conversationId,
        provider_response: callData,
        message: 'Call initiated successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error starting call:', error);
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
