# RevOS Voice v1 - Deployment Checklist

Use this checklist when deploying Voice v1 to production.

## Pre-Deployment

### Environment Setup
- [ ] ElevenLabs API key obtained and stored securely
- [ ] Twilio Account SID obtained (if using Twilio integration)
- [ ] Twilio Auth Token obtained (if using Twilio integration)
- [ ] Supabase Service Role Key available

### Supabase Configuration
- [ ] Set `ELEVENLABS_API_KEY` in Supabase Edge Functions settings
- [ ] Set `TWILIO_ACCOUNT_SID` in Supabase Edge Functions settings (optional)
- [ ] Set `TWILIO_AUTH_TOKEN` in Supabase Edge Functions settings (optional)
- [ ] Set `SUPABASE_URL` in Supabase Edge Functions settings
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` in Supabase Edge Functions settings

## Database Migration

### Run Migration
```bash
supabase migration up 20260218190000_revos_voice_v1_schema.sql
```

### Verify Migration
- [ ] Tables created: `voice_agent_templates`, `twilio_phone_pool`, `tenant_phone_assignments`, `voice_usage_ledger`
- [ ] Columns added to `voice_agents`: `elevenlabs_agent_id`, `template_id`, `use_case`
- [ ] Columns added to `voice_phone_numbers`: `twilio_sid`, `elevenlabs_phone_number_id`, `pool_assignment_id`
- [ ] RLS policies enabled on all tables
- [ ] 4 templates seeded in `voice_agent_templates`

### Verify Templates
```sql
SELECT id, name, use_case, is_public 
FROM voice_agent_templates 
WHERE is_public = true;
```
Expected: 4 rows (sales_outreach, appointment_setting, lead_qualification, customer_support)

## Edge Functions Deployment

### Deploy Functions
```bash
supabase functions deploy voice-deploy-template
supabase functions deploy voice-assign-number
supabase functions deploy voice-import-number
supabase functions deploy voice-attach-agent
supabase functions deploy voice-start-call
supabase functions deploy voice-start-batch
supabase functions deploy voice-webhook-post-call
```

### Verify Deployment
```bash
supabase functions list
```

- [ ] `voice-deploy-template` deployed
- [ ] `voice-assign-number` deployed
- [ ] `voice-import-number` deployed
- [ ] `voice-attach-agent` deployed
- [ ] `voice-start-call` deployed
- [ ] `voice-start-batch` deployed
- [ ] `voice-webhook-post-call` deployed

## Phone Number Setup

### Add Numbers to Master Pool
**Note:** This requires service role access

```sql
INSERT INTO twilio_phone_pool (
  phone_number_e164,
  twilio_sid,
  country_code,
  friendly_name,
  is_assigned
) VALUES 
  ('+15551234567', 'PN_xxxxx', 'US', 'Main Business Line', false),
  ('+15559876543', 'PN_yyyyy', 'US', 'Sales Line', false);
```

### Verify Pool
```sql
SELECT phone_number_e164, country_code, is_assigned 
FROM twilio_phone_pool 
WHERE is_assigned = false;
```

- [ ] At least 1 phone number available in pool

## ElevenLabs Configuration

### Webhook Setup
1. [ ] Log into ElevenLabs dashboard
2. [ ] Navigate to Webhooks/Settings
3. [ ] Add webhook URL: `https://YOUR_PROJECT.supabase.co/functions/v1/voice-webhook-post-call`
4. [ ] Select events: Call started, Call ended, Call failed
5. [ ] Save configuration

### Test Connection
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/voice-webhook-post-call" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"test","conversation_id":"test-123"}'
```

- [ ] Webhook endpoint responds with 200 OK

## Smoke Test

### Run Test Suite
```bash
psql $DATABASE_URL < voice_v1_smoke_test.sql
```

### Verify Test Results
- [ ] Templates are queryable
- [ ] Phone numbers assignable
- [ ] Agents deployable
- [ ] Calls can be queued
- [ ] Webhook updates records
- [ ] Usage ledger tracks costs
- [ ] Kernel events emitted
- [ ] Optimization decisions logged

## UI Verification

### Access Voice Catalog
1. [ ] Navigate to `/voice-catalog`
2. [ ] Verify 4 templates visible
3. [ ] Click "Quick Deploy" on a template
4. [ ] Verify agent created successfully

### Access Voice Agents Page
1. [ ] Navigate to `/voice-agents`
2. [ ] Verify deployed agent appears
3. [ ] Test phone number assignment (if available)
4. [ ] Verify UI displays correctly

## Production Readiness

### Security Audit
- [ ] No API keys in client-side code
- [ ] No API keys in logs
- [ ] RLS enabled on all voice tables
- [ ] Service role used for privileged operations
- [ ] Webhook endpoint validates payloads

### Performance Check
- [ ] Database indexes created (check migration)
- [ ] Edge functions respond within 3 seconds
- [ ] No N+1 queries in batch operations

### Monitoring Setup
- [ ] Set up alerts for failed calls (>30% failure rate)
- [ ] Monitor usage ledger for unexpected costs
- [ ] Track kernel optimization decisions
- [ ] Monitor edge function errors

## Post-Deployment

### Initial Campaign Test
1. [ ] Create test campaign with 5 leads
2. [ ] Deploy agent from template
3. [ ] Assign phone number to tenant
4. [ ] Launch batch campaign
5. [ ] Verify calls are initiated
6. [ ] Check webhook events received
7. [ ] Verify usage tracking

### Documentation
- [ ] Share VOICE_V1_README.md with team
- [ ] Update internal wiki with deployment info
- [ ] Add voice feature to user documentation
- [ ] Train support team on voice features

### Rollback Plan
If issues occur:
1. Pause all active campaigns: `UPDATE voice_campaigns SET status = 'paused' WHERE status = 'running';`
2. Disable webhook in ElevenLabs dashboard
3. Roll back migration if needed: Contact DB admin
4. Investigate logs in Supabase Edge Functions

## Success Criteria

- [ ] Templates deployable via UI
- [ ] Phone numbers assignable to tenants
- [ ] Batch campaigns can be launched
- [ ] Calls are successfully initiated
- [ ] Webhooks process correctly
- [ ] Usage is tracked accurately
- [ ] Kernel optimization runs automatically
- [ ] No security vulnerabilities
- [ ] Performance meets SLA (< 3s response times)

## Sign-Off

- [ ] **Development Lead:** Implementation complete
- [ ] **QA Lead:** Testing complete
- [ ] **Security Lead:** Security audit passed
- [ ] **DevOps Lead:** Deployment successful
- [ ] **Product Lead:** Feature approved for production

---

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Version:** 1.0.0

## Troubleshooting

### Common Issues

**Issue:** Templates not showing in catalog  
**Solution:** Verify migration ran successfully and templates seeded

**Issue:** Cannot assign phone number  
**Solution:** Check that numbers exist in `twilio_phone_pool` with `is_assigned = false`

**Issue:** Calls not being made  
**Solution:** Verify ELEVENLABS_API_KEY is set correctly in edge function settings

**Issue:** Webhook not firing  
**Solution:** Check ElevenLabs dashboard webhook configuration matches deployed URL

**Issue:** Optimization not running  
**Solution:** Check `kernel_events` table for voice events, verify webhook is firing

## Support Contacts

- **ElevenLabs Support:** support@elevenlabs.io
- **Twilio Support:** https://support.twilio.com
- **Supabase Support:** https://supabase.com/support
- **RevOS Team:** [Internal Slack Channel]
