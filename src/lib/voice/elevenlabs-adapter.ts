/**
 * ElevenLabs + Twilio Provider Adapter Implementation
 * Implements VoiceProviderAdapter for RevOS Voice v1
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  VoiceProviderAdapter,
  AgentOverrides,
  ProvisionAgentResult,
  AssignNumberResult,
  AttachResult,
  StartCallResult,
  StartBatchResult,
  NormalizedVoiceEvent,
  CallEventPayload,
} from './provider-adapter';

export class ElevenLabsAdapter implements VoiceProviderAdapter {
  private supabase: SupabaseClient;
  private elevenlabsApiKey: string;
  private twilioAccountSid?: string;
  private twilioAuthToken?: string;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    elevenlabsApiKey: string,
    twilioAccountSid?: string,
    twilioAuthToken?: string
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.elevenlabsApiKey = elevenlabsApiKey;
    this.twilioAccountSid = twilioAccountSid;
    this.twilioAuthToken = twilioAuthToken;
  }

  async provisionAgentFromTemplate(
    tenantId: string,
    templateId: string,
    overrides?: AgentOverrides
  ): Promise<ProvisionAgentResult> {
    // 1. Fetch template
    const { data: template, error: templateError } = await this.supabase
      .from('voice_agent_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // 2. Get tenant workspace
    const { data: tenant, error: tenantError } = await this.supabase
      .from('tenants')
      .select('id, name, workspace_id:workspaces!inner(id)')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    // Extract workspace_id
    const workspaceId = (tenant as any).workspace_id?.[0]?.id || (tenant as any).workspace_id;
    if (!workspaceId) {
      throw new Error(`No workspace found for tenant: ${tenantId}`);
    }

    // 3. Merge template with overrides
    const agentConfig = {
      name: overrides?.name || template.name,
      system_prompt: overrides?.systemPrompt || template.system_prompt,
      first_message: overrides?.firstMessage || template.first_message,
      voice_id: overrides?.voiceId || template.voice_id || 'EXAVITQu4vr4xnSDxMaL',
      language: overrides?.language || template.language || 'en',
      end_call_phrases: overrides?.endCallPhrases || template.end_call_phrases || [],
    };

    // 4. Create agent in ElevenLabs
    const createResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': this.elevenlabsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: agentConfig.name,
        conversation_config: {
          agent: {
            prompt: {
              prompt: agentConfig.system_prompt,
            },
            first_message: agentConfig.first_message,
            language: agentConfig.language,
          },
          tts: {
            voice_id: agentConfig.voice_id,
          },
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`ElevenLabs agent creation failed: ${errorText}`);
    }

    const agentData = await createResponse.json();
    const vendorAgentId = agentData.agent_id;

    // 5. Store in voice_agents table
    const { data: voiceAgent, error: insertError } = await this.supabase
      .from('voice_agents')
      .insert({
        tenant_id: tenantId,
        workspace_id: workspaceId,
        name: agentConfig.name,
        provider: 'elevenlabs',
        elevenlabs_agent_id: vendorAgentId,
        template_id: templateId,
        use_case: template.use_case,
        system_prompt: agentConfig.system_prompt,
        first_message: agentConfig.first_message,
        voice_id: agentConfig.voice_id,
        model: 'elevenlabs-conversational',
        config: {
          ...agentConfig,
          ...(overrides?.config || {}),
        },
        is_active: true,
      })
      .select('id')
      .single();

    if (insertError || !voiceAgent) {
      throw new Error(`Failed to store agent in database: ${insertError?.message}`);
    }

    return {
      vendorAgentId,
      revosAgentId: voiceAgent.id,
      provider: 'elevenlabs',
    };
  }

  async assignNumberToTenant(
    tenantId: string,
    phoneNumberE164OrPoolId: string
  ): Promise<AssignNumberResult> {
    // 1. Check if input is pool ID or E164
    const isE164 = phoneNumberE164OrPoolId.startsWith('+');
    
    let poolPhone;
    
    if (isE164) {
      // Find in pool by E164
      const { data, error } = await this.supabase
        .from('twilio_phone_pool')
        .select('*')
        .eq('phone_number_e164', phoneNumberE164OrPoolId)
        .eq('is_assigned', false)
        .single();
      
      if (error || !data) {
        throw new Error(`Phone number not available in pool: ${phoneNumberE164OrPoolId}`);
      }
      poolPhone = data;
    } else {
      // Find by pool ID
      const { data, error } = await this.supabase
        .from('twilio_phone_pool')
        .select('*')
        .eq('id', phoneNumberE164OrPoolId)
        .eq('is_assigned', false)
        .single();
      
      if (error || !data) {
        throw new Error(`Pool phone not available: ${phoneNumberE164OrPoolId}`);
      }
      poolPhone = data;
    }

    // 2. Get tenant workspace
    const { data: tenant, error: tenantError } = await this.supabase
      .from('tenants')
      .select('id, workspace_id:workspaces!inner(id)')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const workspaceId = (tenant as any).workspace_id?.[0]?.id || (tenant as any).workspace_id;

    // 3. Import number to ElevenLabs (if Twilio credentials available)
    let elevenlabsPhoneNumberId: string | undefined;
    
    if (this.twilioAccountSid && this.twilioAuthToken) {
      const importResponse = await fetch('https://api.elevenlabs.io/v1/convai/phone-numbers/import', {
        method: 'POST',
        headers: {
          'xi-api-key': this.elevenlabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: poolPhone.phone_number_e164,
          twilio_account_sid: this.twilioAccountSid,
          twilio_auth_token: this.twilioAuthToken,
        }),
      });

      if (importResponse.ok) {
        const importData = await importResponse.json();
        elevenlabsPhoneNumberId = importData.phone_number_id;
      }
    }

    // 4. Create tenant assignment
    const { data: assignment, error: assignError } = await this.supabase
      .from('tenant_phone_assignments')
      .insert({
        tenant_id: tenantId,
        workspace_id: workspaceId,
        pool_phone_id: poolPhone.id,
        elevenlabs_phone_number_id: elevenlabsPhoneNumberId,
        is_active: true,
      })
      .select('id')
      .single();

    if (assignError || !assignment) {
      throw new Error(`Failed to create phone assignment: ${assignError?.message}`);
    }

    // 5. Mark pool phone as assigned
    await this.supabase
      .from('twilio_phone_pool')
      .update({
        is_assigned: true,
        assigned_to_tenant_id: tenantId,
        assigned_at: new Date().toISOString(),
      })
      .eq('id', poolPhone.id);

    // 6. Create voice_phone_numbers record
    const { data: voiceNumber, error: numberError } = await this.supabase
      .from('voice_phone_numbers')
      .insert({
        tenant_id: tenantId,
        workspace_id: workspaceId,
        phone_number: poolPhone.phone_number_e164,
        provider: 'elevenlabs',
        twilio_sid: poolPhone.twilio_sid,
        elevenlabs_phone_number_id: elevenlabsPhoneNumberId,
        pool_assignment_id: assignment.id,
        friendly_name: poolPhone.friendly_name,
        is_active: true,
      })
      .select('id')
      .single();

    if (numberError || !voiceNumber) {
      throw new Error(`Failed to create voice_phone_numbers record: ${numberError?.message}`);
    }

    return {
      revosNumberId: voiceNumber.id,
      vendorNumberId: elevenlabsPhoneNumberId || poolPhone.twilio_sid,
      twilioSid: poolPhone.twilio_sid,
      phoneNumberE164: poolPhone.phone_number_e164,
    };
  }

  async attachAgentToNumber(
    revosAgentId: string,
    revosNumberId: string
  ): Promise<AttachResult> {
    // 1. Get agent details
    const { data: agent, error: agentError } = await this.supabase
      .from('voice_agents')
      .select('elevenlabs_agent_id')
      .eq('id', revosAgentId)
      .single();

    if (agentError || !agent || !agent.elevenlabs_agent_id) {
      throw new Error(`Agent not found or missing ElevenLabs ID: ${revosAgentId}`);
    }

    // 2. Get number details
    const { data: number, error: numberError } = await this.supabase
      .from('voice_phone_numbers')
      .select('elevenlabs_phone_number_id, phone_number')
      .eq('id', revosNumberId)
      .single();

    if (numberError || !number || !number.elevenlabs_phone_number_id) {
      throw new Error(`Phone number not found or not imported to ElevenLabs: ${revosNumberId}`);
    }

    // 3. Attach agent to number in ElevenLabs
    const attachResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/phone-numbers/${number.elevenlabs_phone_number_id}`,
      {
        method: 'PATCH',
        headers: {
          'xi-api-key': this.elevenlabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: agent.elevenlabs_agent_id,
        }),
      }
    );

    if (!attachResponse.ok) {
      const errorText = await attachResponse.text();
      throw new Error(`Failed to attach agent to number: ${errorText}`);
    }

    // 4. Update voice_phone_numbers record
    await this.supabase
      .from('voice_phone_numbers')
      .update({ voice_agent_id: revosAgentId })
      .eq('id', revosNumberId);

    return {
      success: true,
      message: `Agent ${revosAgentId} attached to number ${number.phone_number}`,
    };
  }

  async startCall(
    revosAgentId: string,
    revosNumberId: string,
    toE164: string,
    variables?: Record<string, any>
  ): Promise<StartCallResult> {
    // 1. Get agent and number details
    const { data: agent } = await this.supabase
      .from('voice_agents')
      .select('elevenlabs_agent_id, tenant_id, workspace_id, name')
      .eq('id', revosAgentId)
      .single();

    const { data: number } = await this.supabase
      .from('voice_phone_numbers')
      .select('phone_number, elevenlabs_phone_number_id')
      .eq('id', revosNumberId)
      .single();

    if (!agent || !agent.elevenlabs_agent_id) {
      throw new Error(`Agent not found: ${revosAgentId}`);
    }

    if (!number) {
      throw new Error(`Phone number not found: ${revosNumberId}`);
    }

    // 2. Make call via ElevenLabs
    const callResponse = await fetch('https://api.elevenlabs.io/v1/convai/conversations/phone', {
      method: 'POST',
      headers: {
        'xi-api-key': this.elevenlabsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agent.elevenlabs_agent_id,
        phone_number: toE164,
        from_number: number.phone_number,
        metadata: {
          revos_agent_id: revosAgentId,
          revos_number_id: revosNumberId,
          ...variables,
        },
      }),
    });

    if (!callResponse.ok) {
      const errorText = await callResponse.text();
      
      // Create failed call record
      const { data: callRecord } = await this.supabase
        .from('voice_call_records')
        .insert({
          tenant_id: agent.tenant_id,
          workspace_id: agent.workspace_id,
          voice_agent_id: revosAgentId,
          phone_number_id: revosNumberId,
          call_type: 'outbound',
          status: 'failed',
          customer_number: toE164,
          failure_reason: errorText,
        })
        .select('id')
        .single();

      return {
        vendorCallId: '',
        revosCallId: callRecord?.id || '',
        status: 'failed',
        message: errorText,
      };
    }

    const callData = await callResponse.json();
    const vendorCallId = callData.conversation_id || callData.call_id;

    // 3. Create call record
    const { data: callRecord, error: recordError } = await this.supabase
      .from('voice_call_records')
      .insert({
        tenant_id: agent.tenant_id,
        workspace_id: agent.workspace_id,
        voice_agent_id: revosAgentId,
        phone_number_id: revosNumberId,
        provider_call_id: vendorCallId,
        call_type: 'outbound',
        status: 'queued',
        customer_number: toE164,
        campaign_id: variables?.campaign_id,
        lead_id: variables?.lead_id,
      })
      .select('id')
      .single();

    if (recordError || !callRecord) {
      throw new Error(`Failed to create call record: ${recordError?.message}`);
    }

    return {
      vendorCallId,
      revosCallId: callRecord.id,
      status: 'initiated',
    };
  }

  async startBatch(campaignId: string): Promise<StartBatchResult> {
    // 1. Get campaign details
    const { data: campaign, error: campaignError } = await this.supabase
      .from('voice_campaigns')
      .select(`
        *,
        voice_agent:voice_agents!inner(id, elevenlabs_agent_id, tenant_id, workspace_id),
        phone_number:voice_phone_numbers!inner(id, phone_number)
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    // 2. Get target contacts (from campaign target_segment)
    // This would query leads based on campaign.target_segment criteria
    // For now, we'll use a simple query
    const { data: leads, error: leadsError } = await this.supabase
      .from('leads')
      .select('id, contact:crm_contacts!inner(id, phone)')
      .eq('workspace_id', (campaign as any).voice_agent.workspace_id)
      .not('contact.phone', 'is', null)
      .limit(campaign.total_contacts || 100);

    if (leadsError || !leads) {
      throw new Error(`Failed to fetch leads: ${leadsError?.message}`);
    }

    // 3. Queue calls for each lead
    let queuedCount = 0;
    const errors: string[] = [];

    for (const lead of leads) {
      try {
        const contact = (lead as any).contact;
        if (!contact?.phone) continue;

        await this.startCall(
          (campaign as any).voice_agent.id,
          (campaign as any).phone_number.id,
          contact.phone,
          {
            campaign_id: campaignId,
            lead_id: lead.id,
          }
        );
        queuedCount++;
      } catch (error) {
        errors.push(`Lead ${lead.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 4. Update campaign status
    await this.supabase
      .from('voice_campaigns')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        completed_calls: 0,
      })
      .eq('id', campaignId);

    return {
      revosBatchId: campaignId,
      campaignId,
      totalContacts: leads.length,
      queuedCalls: queuedCount,
    };
  }

  async ingestWebhook(providerEvent: any): Promise<NormalizedVoiceEvent[]> {
    const events: NormalizedVoiceEvent[] = [];

    // ElevenLabs webhook structure varies by event type
    const eventType = providerEvent.event_type || providerEvent.type;
    const conversationId = providerEvent.conversation_id;

    if (!conversationId) {
      throw new Error('Missing conversation_id in webhook payload');
    }

    // Find the call record by provider_call_id
    const { data: callRecord } = await this.supabase
      .from('voice_call_records')
      .select('*')
      .eq('provider_call_id', conversationId)
      .single();

    if (!callRecord) {
      console.warn(`Call record not found for conversation_id: ${conversationId}`);
      return events;
    }

    // Map ElevenLabs event to normalized format
    const payload: CallEventPayload = {
      call_id: callRecord.id,
      agent_id: callRecord.voice_agent_id,
      phone_number_id: callRecord.phone_number_id,
      lead_id: callRecord.lead_id,
      campaign_id: callRecord.campaign_id,
      call_type: callRecord.call_type,
      status: this.mapStatus(eventType, providerEvent.status),
      customer_number: callRecord.customer_number,
      customer_name: callRecord.customer_name,
      duration_seconds: providerEvent.duration_seconds,
      cost: providerEvent.cost,
      transcript: providerEvent.transcript,
      summary: providerEvent.summary,
      recording_url: providerEvent.recording_url,
      outcome: this.mapOutcome(providerEvent),
      failure_reason: providerEvent.failure_reason,
      analysis: providerEvent.analysis,
      started_at: providerEvent.started_at,
      ended_at: providerEvent.ended_at,
    };

    events.push({
      tenant_id: callRecord.tenant_id,
      feature: 'voice',
      provider: 'elevenlabs',
      object_type: 'call',
      object_id: callRecord.id,
      provider_object_id: conversationId,
      event_type: `voice.call.${eventType}`,
      occurred_at: providerEvent.timestamp || new Date().toISOString(),
      payload,
    });

    // Update call record
    await this.supabase
      .from('voice_call_records')
      .update({
        status: payload.status,
        duration_seconds: payload.duration_seconds,
        cost: payload.cost,
        transcript: payload.transcript,
        summary: payload.summary,
        recording_url: payload.recording_url,
        outcome: payload.outcome,
        failure_reason: payload.failure_reason,
        analysis: payload.analysis,
        started_at: payload.started_at,
        ended_at: payload.ended_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', callRecord.id);

    return events;
  }

  private mapStatus(eventType: string, vendorStatus?: string): CallEventPayload['status'] {
    const statusMap: Record<string, CallEventPayload['status']> = {
      'queued': 'queued',
      'ringing': 'ringing',
      'in_progress': 'in-progress',
      'completed': 'completed',
      'failed': 'failed',
      'no_answer': 'no-answer',
      'busy': 'busy',
    };

    return statusMap[eventType] || statusMap[vendorStatus || ''] || 'queued';
  }

  private mapOutcome(event: any): CallEventPayload['outcome'] | undefined {
    if (event.outcome) return event.outcome;
    
    if (event.status === 'completed' && event.transcript) {
      return 'connected';
    }
    if (event.status === 'no_answer') return 'no-answer';
    if (event.status === 'busy') return 'busy';
    
    return undefined;
  }
}
