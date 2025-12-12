/**
 * CRM + Analytics Spine Integration Layer
 * 
 * All CMO actions MUST flow through this unified backbone:
 * - crm_contacts
 * - crm_leads  
 * - crm_activities
 * - campaign_channel_stats_daily
 * - email_events (for email channel)
 * 
 * NO ORPHANED DATA - every event maps back to campaign_id and tenant_id
 */

/**
 * Supported channels that plug into the CRM spine
 */
export const CRM_CHANNELS = {
  email: 'email',
  sms: 'sms',
  voice: 'voice',
  linkedin: 'linkedin',
  landing_page: 'landing_page'
} as const;

export type CrmChannel = typeof CRM_CHANNELS[keyof typeof CRM_CHANNELS];

/**
 * Activity types logged to crm_activities
 */
export const ACTIVITY_TYPES = {
  // Landing pages
  landing_form_submit: 'landing_form_submit',
  
  // Email
  email_sent: 'email_sent',
  email_opened: 'email_opened',
  email_clicked: 'email_clicked',
  email_replied: 'email_replied',
  email_bounced: 'email_bounced',
  email_unsubscribed: 'email_unsubscribed',
  
  // SMS
  sms_sent: 'sms_sent',
  sms_delivered: 'sms_delivered',
  sms_replied: 'sms_replied',
  
  // Voice
  voice_call_initiated: 'voice_call_initiated',
  voice_call_completed: 'voice_call_completed',
  voice_call_no_answer: 'voice_call_no_answer',
  voice_meeting_booked: 'voice_meeting_booked',
  
  // LinkedIn
  linkedin_connection_sent: 'linkedin_connection_sent',
  linkedin_connection_accepted: 'linkedin_connection_accepted',
  linkedin_message_sent: 'linkedin_message_sent',
  linkedin_message_replied: 'linkedin_message_replied',
  
  // Status changes
  status_change: 'status_change',
  
  // Meetings
  meeting_booked: 'meeting_booked',
  meeting_completed: 'meeting_completed',
  meeting_no_show: 'meeting_no_show'
} as const;

export type ActivityType = typeof ACTIVITY_TYPES[keyof typeof ACTIVITY_TYPES];

/**
 * Stat types for campaign_channel_stats_daily
 */
export const STAT_TYPES = {
  sends: 'sends',
  deliveries: 'deliveries',
  opens: 'opens',
  clicks: 'clicks',
  replies: 'replies',
  bounces: 'bounces',
  meetings_booked: 'meetings_booked'
} as const;

export type StatType = typeof STAT_TYPES[keyof typeof STAT_TYPES];

/**
 * Maps activity types to stat types for analytics roll-up
 */
export const ACTIVITY_TO_STAT: Partial<Record<ActivityType, StatType>> = {
  email_sent: 'sends',
  email_opened: 'opens',
  email_clicked: 'clicks',
  email_replied: 'replies',
  email_bounced: 'bounces',
  sms_sent: 'sends',
  sms_delivered: 'deliveries',
  sms_replied: 'replies',
  linkedin_message_sent: 'sends',
  linkedin_message_replied: 'replies',
  voice_call_completed: 'sends',
  voice_meeting_booked: 'meetings_booked',
  meeting_booked: 'meetings_booked'
};

/**
 * CRM Spine integration interface for edge functions
 */
export interface CrmSpineContext {
  tenant_id: string;
  workspace_id: string;
  campaign_id?: string;
  contact_id?: string;
  lead_id?: string;
}

/**
 * Activity payload for logging
 */
export interface ActivityPayload {
  activity_type: ActivityType;
  contact_id: string;
  lead_id?: string;
  meta: Record<string, unknown>;
  new_status?: string;
}

/**
 * Channel event payload for webhooks
 */
export interface ChannelEventPayload {
  channel: CrmChannel;
  event_type: string;
  tenant_id: string;
  campaign_id?: string;
  contact_id?: string;
  lead_id?: string;
  provider_event_id?: string;
  raw_payload?: Record<string, unknown>;
}

/**
 * Campaign Builder output structure
 * All outputs MUST include campaign_id and tenant_id
 */
export interface CampaignBuilderOutput {
  campaign_id: string;
  tenant_id: string;
  workspace_id: string;
  
  // Assets created
  assets: {
    landing_pages?: Array<{
      id: string;
      url_slug: string;
      internal_name: string;
    }>;
    email_sequences?: Array<{
      id: string;
      name: string;
      step_count: number;
    }>;
    voice_scripts?: Array<{
      id: string;
      name: string;
      agent_id?: string;
    }>;
    social_posts?: Array<{
      id: string;
      platform: string;
    }>;
  };
  
  // Automations created
  automations: Array<{
    id: string;
    name: string;
    trigger: string;
    step_count: number;
  }>;
  
  // Summary for UI
  summary: {
    total_assets: number;
    total_automations: number;
    channels_activated: CrmChannel[];
  };
}

/**
 * Webhook handler output - what every channel webhook should return
 */
export interface WebhookHandlerOutput {
  success: boolean;
  activity_logged: boolean;
  stats_updated: boolean;
  orchestrator_triggered: boolean;
  contact_id?: string;
  lead_id?: string;
  errors?: string[];
}

/**
 * Standard webhook processing steps
 * Every channel webhook MUST follow this pattern:
 * 
 * 1. Log raw event (channel-specific table if applicable)
 * 2. Insert crm_activities
 * 3. Update campaign_channel_stats_daily
 * 4. Optionally trigger orchestrator for follow-up
 */
export const WEBHOOK_PROCESSING_STEPS = [
  'log_raw_event',
  'insert_crm_activity', 
  'update_daily_stats',
  'trigger_orchestrator'
] as const;

/**
 * Get the stat type to increment for a given activity
 */
export function getStatTypeForActivity(activityType: ActivityType): StatType | null {
  return ACTIVITY_TO_STAT[activityType] || null;
}

/**
 * Determine if an activity type should pause outbound sequences
 */
export function shouldPauseSequence(activityType: ActivityType): boolean {
  return [
    ACTIVITY_TYPES.email_replied,
    ACTIVITY_TYPES.sms_replied,
    ACTIVITY_TYPES.linkedin_message_replied,
    ACTIVITY_TYPES.voice_meeting_booked,
    ACTIVITY_TYPES.meeting_booked,
    ACTIVITY_TYPES.email_unsubscribed
  ].includes(activityType);
}

/**
 * Map channel + event to internal activity type
 */
export function mapToActivityType(channel: CrmChannel, eventType: string): ActivityType {
  const mapping: Record<string, Partial<Record<string, ActivityType>>> = {
    email: {
      sent: ACTIVITY_TYPES.email_sent,
      delivered: ACTIVITY_TYPES.email_sent,
      opened: ACTIVITY_TYPES.email_opened,
      clicked: ACTIVITY_TYPES.email_clicked,
      replied: ACTIVITY_TYPES.email_replied,
      bounced: ACTIVITY_TYPES.email_bounced,
      unsubscribed: ACTIVITY_TYPES.email_unsubscribed,
    },
    sms: {
      sent: ACTIVITY_TYPES.sms_sent,
      delivered: ACTIVITY_TYPES.sms_delivered,
      replied: ACTIVITY_TYPES.sms_replied,
    },
    voice: {
      initiated: ACTIVITY_TYPES.voice_call_initiated,
      completed: ACTIVITY_TYPES.voice_call_completed,
      no_answer: ACTIVITY_TYPES.voice_call_no_answer,
      meeting_booked: ACTIVITY_TYPES.voice_meeting_booked,
    },
    linkedin: {
      connection_sent: ACTIVITY_TYPES.linkedin_connection_sent,
      connection_accepted: ACTIVITY_TYPES.linkedin_connection_accepted,
      message_sent: ACTIVITY_TYPES.linkedin_message_sent,
      replied: ACTIVITY_TYPES.linkedin_message_replied,
    },
    landing_page: {
      form_submit: ACTIVITY_TYPES.landing_form_submit,
    }
  };

  return mapping[channel]?.[eventType] || ACTIVITY_TYPES.status_change;
}
