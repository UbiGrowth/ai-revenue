/**
 * RevOS Voice Provider Adapter Interface
 * Abstracts ElevenLabs + Twilio integration for Kernel orchestration
 */

export interface VoiceProviderAdapter {
  /**
   * Provision an agent from a template
   * @returns vendorAgentId and revosAgentId
   */
  provisionAgentFromTemplate(
    tenantId: string,
    templateId: string,
    overrides?: AgentOverrides
  ): Promise<ProvisionAgentResult>;

  /**
   * Assign a phone number to a tenant from the master pool
   * @returns revosNumberId and vendorNumberId
   */
  assignNumberToTenant(
    tenantId: string,
    phoneNumberE164OrPoolId: string
  ): Promise<AssignNumberResult>;

  /**
   * Attach an agent to a phone number
   */
  attachAgentToNumber(
    revosAgentId: string,
    revosNumberId: string
  ): Promise<AttachResult>;

  /**
   * Start a single outbound call
   */
  startCall(
    revosAgentId: string,
    revosNumberId: string,
    toE164: string,
    variables?: Record<string, any>
  ): Promise<StartCallResult>;

  /**
   * Start a batch campaign
   */
  startBatch(campaignId: string): Promise<StartBatchResult>;

  /**
   * Ingest and normalize webhook events from provider
   */
  ingestWebhook(providerEvent: any): Promise<NormalizedVoiceEvent[]>;
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AgentOverrides {
  name?: string;
  systemPrompt?: string;
  firstMessage?: string;
  voiceId?: string;
  language?: string;
  endCallPhrases?: string[];
  config?: Record<string, any>;
}

export interface ProvisionAgentResult {
  vendorAgentId: string;
  revosAgentId: string;
  provider: 'elevenlabs';
}

export interface AssignNumberResult {
  revosNumberId: string;
  vendorNumberId: string;
  twilioSid?: string;
  phoneNumberE164: string;
}

export interface AttachResult {
  success: boolean;
  message?: string;
}

export interface StartCallResult {
  vendorCallId: string;
  revosCallId: string;
  status: 'queued' | 'initiated' | 'failed';
  message?: string;
}

export interface StartBatchResult {
  vendorBatchId?: string;
  revosBatchId: string;
  campaignId: string;
  totalContacts: number;
  queuedCalls: number;
}

/**
 * Normalized event shape consumed by the Kernel
 * Used for cross-provider consistency
 */
export interface NormalizedVoiceEvent {
  tenant_id: string;
  feature: 'voice';
  provider: 'elevenlabs' | 'twilio';
  object_type: 'call' | 'agent' | 'number' | 'batch';
  object_id: string; // RevOS internal ID
  provider_object_id: string; // Vendor's ID
  event_type: string; // e.g., 'call.started', 'call.ended', 'call.failed'
  occurred_at: string; // ISO 8601 timestamp
  payload: CallEventPayload | AgentEventPayload | NumberEventPayload;
}

export interface CallEventPayload {
  call_id: string;
  agent_id?: string;
  phone_number_id?: string;
  lead_id?: string;
  campaign_id?: string;
  call_type: 'inbound' | 'outbound';
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'no-answer' | 'busy';
  customer_number?: string;
  customer_name?: string;
  duration_seconds?: number;
  cost?: number;
  transcript?: string;
  summary?: string;
  recording_url?: string;
  outcome?: 'connected' | 'no-answer' | 'voicemail' | 'busy' | 'qualified' | 'not-interested' | 'callback-requested';
  failure_reason?: string;
  analysis?: {
    sentiment?: string;
    intent?: string;
    next_action?: string;
    qualification_score?: number;
  };
  started_at?: string;
  ended_at?: string;
}

export interface AgentEventPayload {
  agent_id: string;
  name: string;
  status: 'active' | 'inactive' | 'deleted';
  config?: Record<string, any>;
}

export interface NumberEventPayload {
  phone_number_id: string;
  phone_number: string;
  status: 'active' | 'inactive' | 'released';
  friendly_name?: string;
}
