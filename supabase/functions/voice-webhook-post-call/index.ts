/**
 * ElevenLabs Post-Call Webhook Handler
 * POST /api/voice/webhook-post-call
 * 
 * Handles ElevenLabs post-call webhooks, updates call records, and emits events
 * NO AUTH REQUIRED - Uses webhook signature verification instead
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-elevenlabs-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Parse webhook payload
    const payload = await req.json();

    console.log('📞 Webhook received:', JSON.stringify(payload, null, 2));

    // Verify webhook structure (basic validation)
    if (!payload.conversation_id && !payload.id) {
      throw new Error('Invalid webhook payload: missing conversation_id or id');
    }

    const conversationId = payload.conversation_id || payload.id;

    // 1. Find call record by provider_call_id
    const { data: callRecord, error: callError } = await supabaseClient
      .from('voice_call_records')
      .select('*')
      .eq('provider_call_id', conversationId)
      .single();

    if (callError || !callRecord) {
      console.error(`Call record not found for conversation: ${conversationId}`);
      // Still return 200 to acknowledge webhook
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook received but call record not found',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Extract call details from webhook
    const status = payload.status || 'completed';
    const duration = payload.duration_seconds || payload.duration || 0;
    const endedAt = payload.ended_at || new Date().toISOString();
    const transcript = payload.transcript || null;
    const recording_url = payload.recording_url || payload.audio_url || null;
    const cost = payload.cost || 0;

    // 3. Update voice_call_records
    const { data: updatedRecord, error: updateError } = await supabaseClient
      .from('voice_call_records')
      .update({
        status: status,
        duration_seconds: duration,
        ended_at: endedAt,
        transcript: transcript,
        recording_url: recording_url,
        provider_metadata: payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', callRecord.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to update call record:', updateError);
    }

    // 4. Emit normalized event to kernel_events
    const { error: eventError } = await supabaseClient
      .from('kernel_events')
      .insert({
        tenant_id: callRecord.tenant_id,
        workspace_id: callRecord.workspace_id,
        event_type: 'voice.call.completed',
        entity_type: 'voice_call',
        entity_id: callRecord.id,
        actor_id: null,
        actor_type: 'system',
        metadata: {
          conversation_id: conversationId,
          voice_agent_id: callRecord.voice_agent_id,
          campaign_id: callRecord.campaign_id,
          lead_id: callRecord.lead_id,
          duration: duration,
          status: status,
          customer_number: callRecord.customer_number,
          phone_number_id: callRecord.phone_number_id,
        },
        occurred_at: endedAt,
      });

    if (eventError) {
      console.error('Failed to emit kernel event:', eventError);
    }

    // 5. Insert voice_usage_ledger entry
    const { error: usageError } = await supabaseClient
      .from('voice_usage_ledger')
      .insert({
        tenant_id: callRecord.tenant_id,
        workspace_id: callRecord.workspace_id,
        agent_id: callRecord.voice_agent_id,
        call_id: callRecord.id,
        campaign_id: callRecord.campaign_id,
        usage_type: 'outbound_call',
        provider: 'elevenlabs',
        duration_seconds: duration,
        cost_usd: cost,
        occurred_at: new Date().toISOString(),
      });

    if (usageError) {
      console.error('Failed to insert usage ledger:', usageError);
    }

    // 6. Enqueue kernel decision for campaign optimization
    if (callRecord.campaign_id) {
      const { error: decisionError } = await supabaseClient
        .from('kernel_decisions')
        .insert({
          tenant_id: callRecord.tenant_id,
          workspace_id: callRecord.workspace_id,
          policy_name: 'voice_campaign_optimization',
          trigger_type: 'event',
          trigger_event_id: null,
          entity_type: 'voice_campaign',
          entity_id: callRecord.campaign_id,
          context: {
            call_id: callRecord.id,
            conversation_id: conversationId,
            voice_agent_id: callRecord.voice_agent_id,
            duration: duration,
            status: status,
            lead_id: callRecord.lead_id,
          },
          status: 'pending',
          priority: 'medium',
          scheduled_at: new Date().toISOString(),
        });

      if (decisionError) {
        console.error('Failed to enqueue kernel decision:', decisionError);
      }
    }

    console.log(`✅ Webhook processed: ${conversationId} (${status}, ${duration}s)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    // Return 200 to avoid webhook retry storms
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
