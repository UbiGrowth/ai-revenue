/**
 * Import Phone Number to ElevenLabs
 * POST /api/voice/import-number
 * 
 * Imports a Twilio phone number to ElevenLabs with native Twilio integration
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
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!ELEVENLABS_API_KEY || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error('Missing required environment variables: ELEVENLABS_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN');
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
      tenant_id,
      voice_number_id,
    } = await req.json();

    if (!tenant_id || !voice_number_id) {
      throw new Error('Missing required fields: tenant_id, voice_number_id');
    }

    // Verify user belongs to tenant
    const { data: userTenant, error: tenantCheckError } = await supabaseClient
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .single();

    if (tenantCheckError || !userTenant) {
      throw new Error('User does not belong to specified tenant');
    }

    // 1. Fetch voice_phone_numbers record
    const { data: voiceNumber, error: numberError } = await supabaseClient
      .from('voice_phone_numbers')
      .select('*')
      .eq('id', voice_number_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (numberError || !voiceNumber) {
      throw new Error(`Voice phone number not found: ${voice_number_id}`);
    }

    if (!voiceNumber.phone_number) {
      throw new Error('Phone number not set in voice_phone_numbers record');
    }

    // 2. Import number to ElevenLabs
    const importResponse = await fetch('https://api.elevenlabs.io/v1/convai/phone-numbers/import', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: voiceNumber.phone_number,
        twilio_account_sid: TWILIO_ACCOUNT_SID,
        twilio_auth_token: TWILIO_AUTH_TOKEN,
      }),
    });

    if (!importResponse.ok) {
      const errorText = await importResponse.text();
      throw new Error(`ElevenLabs import failed: ${errorText}`);
    }

    const importData = await importResponse.json();
    const elevenLabsPhoneNumberId = importData.phone_number_id || importData.id;

    // 3. Update voice_phone_numbers record
    const { data: updatedNumber, error: updateError } = await supabaseClient
      .from('voice_phone_numbers')
      .update({
        elevenlabs_phone_number_id: elevenLabsPhoneNumberId,
        provider_status: 'imported',
        updated_at: new Date().toISOString(),
      })
      .eq('id', voice_number_id)
      .select('*')
      .single();

    if (updateError || !updatedNumber) {
      throw new Error(`Failed to update voice_phone_numbers: ${updateError?.message}`);
    }

    console.log(`✅ Number imported to ElevenLabs: ${voiceNumber.phone_number} (ID: ${elevenLabsPhoneNumberId})`);

    return new Response(
      JSON.stringify({
        success: true,
        voice_number: updatedNumber,
        elevenlabs_phone_number_id: elevenLabsPhoneNumberId,
        message: 'Phone number imported to ElevenLabs successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error importing phone number:', error);
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
