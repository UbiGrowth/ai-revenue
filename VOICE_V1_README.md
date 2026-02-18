# RevOS Voice v1 - ElevenLabs + Twilio Integration

Complete implementation of Voice v1 for the RevOS monorepo with ElevenLabs Conversational AI and native Twilio phone number management.

## 🎯 Overview

RevOS Voice v1 provides tenant-isolated voice calling capabilities with automatic campaign optimization powered by the Kernel orchestration layer.

### Key Features

- **Template-Based Agent Deployment** - Deploy voice agents from pre-built templates in seconds
- **Master Phone Pool** - Centralized Twilio phone number management with tenant assignments
- **ElevenLabs Native Integration** - Direct integration with ElevenLabs Conversational AI (no middleman)
- **Batch Campaign Orchestration** - Launch multi-contact voice campaigns with intelligent retry logic
- **Real-Time Webhooks** - Capture call outcomes, transcripts, and analytics
- **Kernel-Powered Optimization** - Automatic campaign optimization based on performance metrics
- **Multi-Tenant RLS** - Complete tenant isolation with Row-Level Security

## 📋 Non-Negotiables (Met)

✅ **Tenant-only model** - Voice v1 logic uses tenant_id for isolation (workspace_id required by existing schema for compatibility but not used in business logic)  
✅ **Reuse existing RevOS primitives** - Extended `kernel_events`, `voice_agents`, `voice_campaigns` tables  
✅ **Minimal delta** - Only 4 new tables + 7 edge functions added (extended 3 existing tables)  
✅ **Server-side secrets** - All API keys stored in Supabase env vars (never exposed to client)  
✅ **Multi-tenant hard isolation** - RLS policies on all tables with `user_belongs_to_tenant()`

### Note on Workspace Architecture

The existing RevOS schema (from Lovable import) requires `workspace_id` as NOT NULL on voice tables. Voice v1 honors this schema requirement by populating workspace_id when creating records, but:
- Business logic uses `tenant_id` for isolation
- RLS policies use `user_belongs_to_tenant(tenant_id)` for access control
- Queries filter on `tenant_id` not `workspace_id`
- This maintains compatibility with existing UI components while ensuring tenant-only isolation

## 🏗️ Architecture

### Data Flow

```
User (UI) → Edge Function → ElevenLabs API → Voice Call
                ↓                              ↓
         DB (voice_agents)              Twilio (PSTN)
                                              ↓
                                    Webhook → Edge Function
                                              ↓
                          kernel_events → kernel_decisions → kernel_actions
                                              ↓
                                    voice_usage_ledger + Campaign Update
```

### Database Schema

**New Tables:**
- `voice_agent_templates` - Catalog of reusable agent templates (4 seeded)
- `twilio_phone_pool` - Master phone pool (service-role only)
- `tenant_phone_assignments` - Tenant-to-phone mappings
- `voice_usage_ledger` - Voice minute tracking for billing

**Extended Tables:**
- `voice_agents` - Added `elevenlabs_agent_id`, `template_id`, `use_case`
- `voice_phone_numbers` - Added `twilio_sid`, `elevenlabs_phone_number_id`, `pool_assignment_id`
- `voice_call_records` - Enhanced with `outcome`, `analysis`, `transcript`, `summary`
- `voice_campaigns` - Enhanced with `call_schedule` for retry logic

**Reused Tables:**
- `kernel_events` - Voice events with type prefix `voice.*`
- `kernel_decisions` - Optimization decisions with policy `voice_campaign_optimization`
- `kernel_actions` - Executed optimization actions

### Edge Functions

1. **voice-deploy-template** - Deploy agent from template
2. **voice-assign-number** - Assign phone from master pool
3. **voice-import-number** - Import number to ElevenLabs with Twilio creds
4. **voice-attach-agent** - Attach agent to phone number
5. **voice-start-call** - Start single outbound call
6. **voice-start-batch** - Start batch campaign
7. **voice-webhook-post-call** - Handle ElevenLabs webhooks + trigger optimization

### Kernel Module

**voice-optimizer.ts** - Rules-based campaign optimization:
- **Stop-loss**: Pause campaign if failure rate >30%
- **Retry Windows**: Adjust calling hours if connect rate <20%
- **Agent Switch**: Recommend script changes if qualification rate <15%
- **Scale Up**: Increase volume if efficiency >30%

## 🚀 Deployment

### Prerequisites

1. **Supabase Project** with Service Role Key
2. **ElevenLabs Account** with API Key
3. **Twilio Account** (optional - for number import to ElevenLabs)

### Environment Variables

Set these in Supabase Edge Functions settings:

```bash
ELEVENLABS_API_KEY=sk_xxx...
TWILIO_ACCOUNT_SID=ACxxx...  # Optional
TWILIO_AUTH_TOKEN=xxx...     # Optional
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

### Database Migration

```bash
# Run the migration
supabase migration up 20260218190000_revos_voice_v1_schema.sql

# Verify templates were seeded
supabase db query "SELECT name, use_case FROM voice_agent_templates;"
```

### Deploy Edge Functions

```bash
# Deploy all voice functions
supabase functions deploy voice-deploy-template
supabase functions deploy voice-assign-number
supabase functions deploy voice-import-number
supabase functions deploy voice-attach-agent
supabase functions deploy voice-start-call
supabase functions deploy voice-start-batch
supabase functions deploy voice-webhook-post-call

# Verify deployment
supabase functions list
```

### UI Routes

The following routes are now available:
- `/voice-catalog` - Browse and deploy agent templates
- `/voice-agents` - Manage deployed agents, numbers, campaigns, and call history

## 📖 Usage

### 1. Deploy an Agent

**UI:** Navigate to `/voice-catalog` and click "Quick Deploy" on a template.

**API:**
```bash
curl -X POST "$SUPABASE_URL/functions/v1/voice-deploy-template" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "uuid-of-template",
    "tenant_id": "uuid-of-tenant",
    "overrides": {
      "name": "My Custom Agent",
      "first_message": "Hi! Custom greeting here."
    }
  }'
```

### 2. Assign a Phone Number

**API:**
```bash
curl -X POST "$SUPABASE_URL/functions/v1/voice-assign-number" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "uuid-of-tenant",
    "phone_number_e164_or_pool_id": "+15551234567"
  }'
```

### 3. Import Number to ElevenLabs

**API:**
```bash
curl -X POST "$SUPABASE_URL/functions/v1/voice-import-number" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "uuid-of-tenant",
    "voice_number_id": "uuid-of-voice-phone-number"
  }'
```

### 4. Attach Agent to Number

**API:**
```bash
curl -X POST "$SUPABASE_URL/functions/v1/voice-attach-agent" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "voice_agent_id": "uuid-of-agent",
    "voice_number_id": "uuid-of-number"
  }'
```

### 5. Start a Batch Campaign

**API:**
```bash
curl -X POST "$SUPABASE_URL/functions/v1/voice-start-batch" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "uuid-of-campaign"
  }'
```

### 6. Configure ElevenLabs Webhook

In your ElevenLabs dashboard, set the webhook URL to:
```
https://YOUR_PROJECT.supabase.co/functions/v1/voice-webhook-post-call
```

## 🧪 Testing

### Smoke Test

Run the comprehensive end-to-end smoke test:

```bash
psql $DATABASE_URL < voice_v1_smoke_test.sql
```

This test covers:
1. Template deployment
2. Number assignment
3. Batch campaign launch
4. Webhook processing
5. Kernel optimization
6. Usage tracking
7. Dashboard queries

### Manual Test Plan

1. **Deploy Template**
   - Go to `/voice-catalog`
   - Click "Quick Deploy" on "Sales Outreach Agent"
   - Verify agent appears in `/voice-agents`

2. **Assign Number**
   - Call `voice-assign-number` API with test number
   - Verify number appears in Voice Agents page

3. **Create Campaign**
   - Create a `voice_campaigns` record via SQL or UI
   - Link to deployed agent and assigned number
   - Set 5-10 test leads as targets

4. **Launch Batch**
   - Call `voice-start-batch` API with campaign ID
   - Verify calls are queued in `voice_call_records`

5. **Simulate Webhook**
   - Manually update a call record to "completed" with outcome data
   - Verify kernel event was created
   - Verify usage ledger entry was created

6. **Check Optimization**
   - Query `kernel_decisions` for voice optimization policy
   - Verify decision was made based on metrics

## 📊 Monitoring

### Key Metrics

Query campaign performance:
```sql
SELECT
  vc.name,
  COUNT(vcr.id) as total_calls,
  COUNT(CASE WHEN vcr.outcome = 'connected' THEN 1 END) as connected,
  COUNT(CASE WHEN vcr.outcome = 'qualified' THEN 1 END) as qualified,
  ROUND(AVG(vcr.duration_seconds)) as avg_duration,
  SUM(vcr.cost) as total_cost
FROM voice_campaigns vc
LEFT JOIN voice_call_records vcr ON vc.id = vcr.campaign_id
WHERE vc.tenant_id = 'YOUR_TENANT_ID'
GROUP BY vc.id, vc.name;
```

### Usage Tracking

```sql
SELECT
  DATE(usage_date) as date,
  COUNT(*) as calls,
  SUM(duration_seconds) / 60.0 as minutes,
  SUM(cost_usd) as cost
FROM voice_usage_ledger
WHERE tenant_id = 'YOUR_TENANT_ID'
GROUP BY DATE(usage_date)
ORDER BY date DESC;
```

### Kernel Decisions

```sql
SELECT
  decision_type,
  decision_json->>'reason' as reason,
  created_at
FROM kernel_decisions
WHERE tenant_id = 'YOUR_TENANT_ID'
  AND policy_name = 'voice_campaign_optimization'
ORDER BY created_at DESC
LIMIT 10;
```

## 🔒 Security

### RLS Policies

All voice tables have RLS enabled with tenant isolation:
```sql
user_belongs_to_tenant(tenant_id)
```

### Secret Management

- ✅ ElevenLabs API key stored in Supabase env vars (server-side only)
- ✅ Twilio credentials stored in Supabase env vars (server-side only)
- ✅ Master phone pool accessible only via service role
- ✅ Webhook endpoint validates payload structure
- ✅ All API endpoints require JWT authentication

### Audit Trail

All actions logged in:
- `kernel_events` - Event stream
- `kernel_decisions` - Policy decisions
- `kernel_actions` - Executed actions
- `voice_usage_ledger` - Usage tracking

## 📈 Optimization Rules

The kernel optimizer applies these rules automatically:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Failure rate | >30% | Pause campaign |
| Connect rate | <20% | Adjust retry windows |
| Qualification rate | <15% | Recommend agent switch |
| Efficiency | >30% | Recommend scale up |

## 🎛️ Configuration

### Template Customization

Modify agent templates in `voice_agent_templates` table:
```sql
UPDATE voice_agent_templates
SET 
  system_prompt = 'Your custom prompt...',
  first_message = 'Your custom greeting...'
WHERE id = 'template-uuid';
```

### Campaign Schedule

Configure retry windows in campaign:
```json
{
  "retry_windows": [
    {"start": "10:00", "end": "12:00", "timezone": "local"},
    {"start": "14:00", "end": "16:00", "timezone": "local"}
  ]
}
```

## 🐛 Troubleshooting

### Common Issues

**Problem:** ElevenLabs API key not configured  
**Solution:** Set `ELEVENLABS_API_KEY` in Supabase Edge Functions settings

**Problem:** Phone number not available in pool  
**Solution:** Insert numbers into `twilio_phone_pool` table (service role only)

**Problem:** Calls not being made  
**Solution:** Check that number has been imported to ElevenLabs and agent is attached

**Problem:** Webhook not firing  
**Solution:** Verify webhook URL in ElevenLabs dashboard matches your function URL

## 📚 API Reference

See detailed API documentation in each edge function file:
- `/supabase/functions/voice-*/index.ts`

## 🤝 Contributing

When extending Voice v1:
1. Maintain tenant isolation (all tables need RLS)
2. Log events to `kernel_events` for observability
3. Follow existing patterns in edge functions (CORS, error handling, auth)
4. Update smoke test when adding new features

## 📄 License

Part of the RevOS monorepo. See main repository LICENSE.

---

**Version:** 1.0.0  
**Last Updated:** 2026-02-18  
**Authors:** RevOS Team
