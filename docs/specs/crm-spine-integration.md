# CRM + Analytics Spine Integration

All CMO actions flow through the unified CRM backbone. **NO ORPHANED DATA** - every event maps back to `campaign_id` and `tenant_id`.

## Core Tables

| Table | Purpose |
|-------|---------|
| `crm_contacts` | Customer/prospect contact records |
| `crm_leads` | Lead records linked to contacts and campaigns |
| `crm_activities` | All customer interactions (unified timeline) |
| `campaign_channel_stats_daily` | Daily aggregated metrics per channel |
| `email_events` | Raw email event log (for email channel) |

## Channel Integration Pattern

Every channel (email, SMS, voice, LinkedIn, landing pages) must follow this pattern:

```
1. Log raw event (channel-specific table if applicable)
2. Insert crm_activities
3. Update campaign_channel_stats_daily
4. Optionally trigger orchestrator for follow-up
```

### Landing Pages → `landing-form-submit`

```
landing-form-submit
├── crm_upsert_contact_and_lead() RPC
├── crm_activities INSERT (landing_form_submit)
└── cmo-kernel invoke (cmo_lead_router)
```

### Email → `email-webhook`

```
email-webhook
├── email_events INSERT (raw event)
├── crm_activities INSERT (email_reply, email_open, etc.)
├── upsert_campaign_daily_stat() RPC
├── outbound_sequence_runs UPDATE (pause on reply)
└── increment_campaign_reply_count() RPC
```

### Voice → `execute-voice-campaign`

```
execute-voice-campaign
├── crm_activities INSERT (voice_call)
├── campaign_metrics UPDATE
└── auto-score-lead invoke
```

## Activity Types

| Activity Type | Channel | Triggers |
|--------------|---------|----------|
| `landing_form_submit` | landing_page | Lead router, scoring |
| `email_sent` | email | - |
| `email_opened` | email | - |
| `email_clicked` | email | - |
| `email_replied` | email | Pause sequences, status update |
| `email_bounced` | email | - |
| `email_unsubscribed` | email | Pause sequences |
| `sms_sent` | sms | - |
| `sms_replied` | sms | Pause sequences |
| `voice_call_initiated` | voice | - |
| `voice_call_completed` | voice | - |
| `voice_meeting_booked` | voice | Pause sequences, qualify lead |
| `linkedin_message_sent` | linkedin | - |
| `linkedin_message_replied` | linkedin | Pause sequences |
| `meeting_booked` | any | Pause sequences, qualify lead |
| `status_change` | any | - |

## Stat Types for Analytics

| Stat Type | Description |
|-----------|-------------|
| `sends` | Messages sent |
| `deliveries` | Messages delivered |
| `opens` | Messages opened |
| `clicks` | Links clicked |
| `replies` | Responses received |
| `bounces` | Failed deliveries |
| `meetings_booked` | Meetings scheduled |

## Campaign Builder Output

When Campaign Builder generates assets, they are persisted to:

| Asset Type | Target Table |
|------------|--------------|
| Landing Pages | `cmo_content_assets` + `cmo_content_variants` |
| Email Sequences | `cmo_content_assets` |
| Voice Scripts | `cmo_content_assets` |
| Social Posts | `cmo_content_assets` |
| Automations | `automation_steps` |

All assets include:
- `tenant_id` (required)
- `workspace_id` (required)
- `campaign_id` (required for linkage)

## Adding New Channels

When adding a new channel (e.g., WhatsApp):

1. Create `whatsapp-webhook` edge function
2. Import from `_shared/crm-spine.ts`
3. Call `processChannelWebhook()` with appropriate params
4. Add activity types to `ACTIVITY_TYPES` in `crm-spine.ts`
5. Add stat mappings to `ACTIVITY_TO_STAT`
6. Register webhook URL in provider dashboard

## Shared Utilities

### `supabase/functions/_shared/crm-spine.ts`

```typescript
// Log activity to crm_activities
await logCrmActivity(supabase, {
  tenant_id,
  contact_id,
  lead_id,
  activity_type: 'email_replied',
  meta: { subject, snippet },
  new_status: 'contacted'
});

// Update daily stats
await updateDailyStats(supabase, {
  tenant_id,
  campaign_id,
  channel: 'email',
  stat_type: 'replies'
});

// Create contact and lead
await upsertContactAndLead(supabase, {
  tenant_id,
  email,
  first_name,
  source: 'landing_page:offer-page'
});

// Process webhook with all steps
await processChannelWebhook(supabase, {
  channel: 'email',
  activity_type: 'email_replied',
  tenant_id,
  campaign_id,
  contact_id,
  lead_id,
  meta: { subject, snippet },
  trigger_orchestrator: true,
  orchestrator_action: 'handle_reply'
});
```

## Kernel Integration

All channels can optionally trigger the orchestrator for follow-up actions:

```typescript
await supabase.functions.invoke('cmo-orchestrator', {
  body: {
    tenant_id,
    workspace_id,
    action: 'handle_reply',
    context: { campaign_id, lead_id },
    payload: { activity_type, meta }
  }
});
```

The orchestrator will route to the appropriate specialist agent (e.g., `email_reply_analyzer`) and determine next actions.
