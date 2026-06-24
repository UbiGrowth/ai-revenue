/**
 * Attach Agent to Phone Number
 * POST /api/voice/attach-agent
 * 
 * Attaches a voice agent to a phone number in ElevenLabs
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
    } = await req.json();

    if (!voice_agent_id || !voice_number_id) {
      throw new Error('Missing required fields: voice_agent_id, voice_number_id');
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

    if (!voiceNumber.elevenlabs_phone_number_id) {
      throw new Error('Phone number not imported to ElevenLabs. Call voice-import-number first.');
    }

    if (!voiceAgent.elevenlabs_agent_id) {
      throw new Error('Agent not deployed to ElevenLabs');
    }

    // 3. Attach agent to phone number via ElevenLabs API
    const attachResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/phone-numbers/${voiceNumber.elevenlabs_phone_number_id}`,
      {
        method: 'PATCH',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: voiceAgent.elevenlabs_agent_id,
        }),
      }
    );

    if (!attachResponse.ok) {
      const errorText = await attachResponse.text();
      throw new Error(`ElevenLabs attach failed: ${errorText}`);
    }

    const attachData = await attachResponse.json();

    // 4. Update voice_phone_numbers record with agent assignment
    const { data: updatedNumber, error: updateError } = await supabaseClient
      .from('voice_phone_numbers')
      .update({
        voice_agent_id: voice_agent_id,
        provider_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', voice_number_id)
      .select('*')
      .single();

    if (updateError || !updatedNumber) {
      throw new Error(`Failed to update voice_phone_numbers: ${updateError?.message}`);
    }

    console.log(`✅ Agent attached: ${voiceAgent.name} -> ${voiceNumber.phone_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        voice_number: updatedNumber,
        voice_agent: voiceAgent,
        message: 'Agent attached to phone number successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error attaching agent:', error);
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
