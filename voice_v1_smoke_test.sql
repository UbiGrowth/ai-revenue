-- ============================================
-- RevOS Voice v1 - End-to-End Smoke Test
-- ============================================
-- Test: Deploy template → Assign number → Batch call → Webhook → Kernel job → Dashboard update
-- Run this after deploying edge functions

-- ============================================
-- SETUP: Create test tenant/workspace
-- Note: workspace_id is required by existing schema for compatibility,
-- but Voice v1 business logic uses tenant_id for isolation
-- ============================================

-- Get or create test tenant (use your actual tenant_id)
DO $$
DECLARE
  test_tenant_id uuid := '00000000-0000-0000-0000-000000000001'; -- Replace with actual tenant_id
  test_workspace_id uuid;
BEGIN
  -- Get existing tenant or create new one
  SELECT id INTO test_tenant_id FROM tenants WHERE slug = 'voice-test' LIMIT 1;
  
  IF test_tenant_id IS NULL THEN
    INSERT INTO tenants (id, name, slug, status)
    VALUES (gen_random_uuid(), 'Voice Test Tenant', 'voice-test', 'active')
    RETURNING id INTO test_tenant_id;
  END IF;

  -- Get workspace for tenant
  SELECT id INTO test_workspace_id FROM workspaces WHERE name = 'Voice Test Workspace' LIMIT 1;
  
  IF test_workspace_id IS NULL THEN
    INSERT INTO workspaces (name, slug)
    VALUES ('Voice Test Workspace', 'voice-test-workspace')
    RETURNING id INTO test_workspace_id;
  END IF;

  RAISE NOTICE 'Test Tenant ID: %', test_tenant_id;
  RAISE NOTICE 'Test Workspace ID: %', test_workspace_id;
END $$;

-- ============================================
-- STEP 1: Verify Templates Exist
-- ============================================

SELECT 
  id,
  name,
  use_case,
  is_public
FROM voice_agent_templates
WHERE is_public = true
ORDER BY use_case;

-- Expected: 4 templates (sales_outreach, appointment_setting, lead_qualification, customer_support)

-- ============================================
-- STEP 2: Add Test Phone to Pool (Service Role Only)
-- ============================================

-- This would be done via admin interface or script
-- For testing, manually insert a test number
INSERT INTO twilio_phone_pool (
  phone_number_e164,
  twilio_sid,
  country_code,
  friendly_name,
  is_assigned
) VALUES (
  '+15555551234',
  'PN_test_mock_sid_12345',
  'US',
  'Test Voice Number',
  false
)
ON CONFLICT (phone_number_e164) DO NOTHING;

-- Verify pool has available numbers
SELECT 
  phone_number_e164,
  country_code,
  is_assigned,
  assigned_to_tenant_id
FROM twilio_phone_pool
WHERE is_assigned = false;

-- ============================================
-- STEP 3: Test Deploy Template API
-- ============================================

-- Call via HTTP (example using curl):
/*
curl -X POST "YOUR_SUPABASE_URL/functions/v1/voice-deploy-template" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "TEMPLATE_UUID_FROM_STEP_1",
    "tenant_id": "YOUR_TENANT_ID"
  }'
*/

-- Verify agent was created
SELECT 
  id,
  name,
  elevenlabs_agent_id,
  template_id,
  use_case,
  is_active,
  created_at
FROM voice_agents
WHERE template_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;

-- ============================================
-- STEP 4: Test Assign Number API
-- ============================================

-- Call via HTTP:
/*
curl -X POST "YOUR_SUPABASE_URL/functions/v1/voice-assign-number" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "YOUR_TENANT_ID",
    "phone_number_e164_or_pool_id": "+15555551234"
  }'
*/

-- Verify assignment
SELECT 
  tpa.id,
  tpa.tenant_id,
  tpp.phone_number_e164,
  tpp.is_assigned,
  vpn.id as voice_number_id,
  vpn.phone_number
FROM tenant_phone_assignments tpa
JOIN twilio_phone_pool tpp ON tpa.pool_phone_id = tpp.id
JOIN voice_phone_numbers vpn ON vpn.pool_assignment_id = tpa.id
WHERE tpa.is_active = true
ORDER BY tpa.created_at DESC
LIMIT 1;

-- ============================================
-- STEP 5: Create Test Campaign
-- ============================================

-- Create a test voice campaign
INSERT INTO voice_campaigns (
  tenant_id,
  workspace_id,
  voice_agent_id,
  phone_number_id,
  name,
  description,
  status,
  target_segment,
  total_contacts
)
SELECT
  va.tenant_id,
  va.workspace_id,
  va.id,
  vpn.id,
  'Smoke Test Campaign',
  'End-to-end smoke test for Voice v1',
  'draft',
  'test_leads',
  5
FROM voice_agents va
CROSS JOIN voice_phone_numbers vpn
WHERE va.template_id IS NOT NULL
  AND vpn.phone_number = '+15555551234'
ORDER BY va.created_at DESC
LIMIT 1
RETURNING id, name, status;

-- ============================================
-- STEP 6: Create Test Leads
-- ============================================

-- Create test contacts
INSERT INTO crm_contacts (
  workspace_id,
  first_name,
  last_name,
  email,
  phone
)
SELECT
  vc.workspace_id,
  'Test',
  'Contact ' || generate_series,
  'test' || generate_series || '@example.com',
  '+1555555' || LPAD(generate_series::text, 4, '0')
FROM voice_campaigns vc
CROSS JOIN generate_series(1, 5)
WHERE vc.name = 'Smoke Test Campaign'
ON CONFLICT DO NOTHING;

-- Create test leads from contacts
INSERT INTO leads (
  workspace_id,
  tenant_id,
  contact_id,
  source,
  status,
  score
)
SELECT
  cc.workspace_id,
  vc.tenant_id,
  cc.id,
  'smoke_test',
  'new',
  8
FROM crm_contacts cc
CROSS JOIN voice_campaigns vc
WHERE cc.email LIKE 'test%@example.com'
  AND vc.name = 'Smoke Test Campaign'
ON CONFLICT DO NOTHING;

-- Verify test leads
SELECT 
  l.id,
  cc.first_name,
  cc.last_name,
  cc.phone,
  l.status
FROM leads l
JOIN crm_contacts cc ON l.contact_id = cc.id
WHERE l.source = 'smoke_test'
LIMIT 5;

-- ============================================
-- STEP 7: Test Start Batch API
-- ============================================

-- Get campaign ID
SELECT id, name FROM voice_campaigns WHERE name = 'Smoke Test Campaign';

-- Call via HTTP:
/*
curl -X POST "YOUR_SUPABASE_URL/functions/v1/voice-start-batch" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "CAMPAIGN_UUID_FROM_ABOVE"
  }'
*/

-- Verify calls were queued
SELECT 
  id,
  status,
  customer_number,
  lead_id,
  campaign_id,
  created_at
FROM voice_call_records
WHERE campaign_id IN (
  SELECT id FROM voice_campaigns WHERE name = 'Smoke Test Campaign'
)
ORDER BY created_at DESC;

-- ============================================
-- STEP 8: Simulate Webhook Post-Call Event
-- ============================================

-- In production, ElevenLabs would send this
-- For testing, manually update a call record to simulate completion
UPDATE voice_call_records
SET
  status = 'completed',
  outcome = 'qualified',
  duration_seconds = 180,
  cost = 0.30,
  transcript = 'Test conversation transcript...',
  summary = 'Lead was interested in the product',
  analysis = jsonb_build_object(
    'sentiment', 'positive',
    'intent', 'purchase',
    'qualification_score', 8
  ),
  started_at = now() - interval '3 minutes',
  ended_at = now(),
  updated_at = now()
WHERE id = (
  SELECT id FROM voice_call_records 
  WHERE campaign_id IN (SELECT id FROM voice_campaigns WHERE name = 'Smoke Test Campaign')
  ORDER BY created_at DESC
  LIMIT 1
);

-- ============================================
-- STEP 9: Verify Kernel Events Emitted
-- ============================================

-- Check for voice events in kernel
SELECT 
  id,
  type,
  source,
  entity_type,
  entity_id,
  payload_json->>'call_id' as call_id,
  payload_json->>'outcome' as outcome,
  occurred_at
FROM kernel_events
WHERE type LIKE 'voice.%'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- STEP 10: Verify Usage Ledger
-- ============================================

SELECT 
  id,
  call_id,
  campaign_id,
  usage_type,
  duration_seconds,
  cost_usd,
  phone_number_e164,
  customer_number_e164,
  usage_date,
  occurred_at
FROM voice_usage_ledger
WHERE campaign_id IN (
  SELECT id FROM voice_campaigns WHERE name = 'Smoke Test Campaign'
)
ORDER BY occurred_at DESC;

-- ============================================
-- STEP 11: Run Campaign Optimizer
-- ============================================

-- This would be triggered automatically by webhook
-- For testing, call it manually via edge function or directly

-- Check kernel decisions for voice optimization
SELECT 
  id,
  policy_name,
  decision_type,
  decision_json->>'campaign_id' as campaign_id,
  decision_json->>'decision' as decision,
  decision_json->>'reason' as reason,
  status,
  created_at
FROM kernel_decisions
WHERE policy_name = 'voice_campaign_optimization'
ORDER BY created_at DESC
LIMIT 5;

-- Check kernel actions
SELECT 
  ka.id,
  ka.action_type,
  ka.action_json->>'campaign_id' as campaign_id,
  ka.action_json->>'decision' as decision,
  ka.status,
  ka.executed_at
FROM kernel_actions ka
JOIN kernel_decisions kd ON ka.decision_id = kd.id
WHERE kd.policy_name = 'voice_campaign_optimization'
ORDER BY ka.created_at DESC
LIMIT 5;

-- ============================================
-- STEP 12: Verify Campaign Metrics
-- ============================================

-- Calculate campaign performance
WITH campaign_metrics AS (
  SELECT
    vc.id,
    vc.name,
    vc.status,
    COUNT(vcr.id) as total_calls,
    COUNT(CASE WHEN vcr.status = 'completed' THEN 1 END) as completed_calls,
    COUNT(CASE WHEN vcr.outcome = 'connected' THEN 1 END) as connected_calls,
    COUNT(CASE WHEN vcr.outcome = 'qualified' THEN 1 END) as qualified_calls,
    AVG(vcr.duration_seconds) as avg_duration,
    SUM(vcr.cost) as total_cost,
    ROUND(
      COUNT(CASE WHEN vcr.outcome = 'connected' THEN 1 END)::numeric / 
      NULLIF(COUNT(vcr.id), 0) * 100, 
      2
    ) as connect_rate_pct,
    ROUND(
      COUNT(CASE WHEN vcr.outcome = 'qualified' THEN 1 END)::numeric / 
      NULLIF(COUNT(CASE WHEN vcr.outcome = 'connected' THEN 1 END), 0) * 100, 
      2
    ) as qualification_rate_pct
  FROM voice_campaigns vc
  LEFT JOIN voice_call_records vcr ON vc.id = vcr.campaign_id
  WHERE vc.name = 'Smoke Test Campaign'
  GROUP BY vc.id, vc.name, vc.status
)
SELECT * FROM campaign_metrics;

-- ============================================
-- STEP 13: Dashboard View Query
-- ============================================

-- This query simulates what the UI dashboard would show
SELECT
  vc.id,
  vc.name,
  vc.status,
  va.name as agent_name,
  vpn.phone_number,
  vc.total_contacts,
  vc.completed_calls,
  vc.successful_calls,
  vc.started_at,
  (
    SELECT COUNT(*) 
    FROM voice_call_records vcr 
    WHERE vcr.campaign_id = vc.id
  ) as calls_made,
  (
    SELECT COUNT(*) 
    FROM voice_call_records vcr 
    WHERE vcr.campaign_id = vc.id 
    AND vcr.outcome = 'qualified'
  ) as qualified_leads,
  (
    SELECT SUM(duration_seconds) 
    FROM voice_call_records vcr 
    WHERE vcr.campaign_id = vc.id
  ) as total_talk_time_seconds,
  (
    SELECT SUM(cost) 
    FROM voice_call_records vcr 
    WHERE vcr.campaign_id = vc.id
  ) as total_cost
FROM voice_campaigns vc
LEFT JOIN voice_agents va ON vc.voice_agent_id = va.id
LEFT JOIN voice_phone_numbers vpn ON vc.phone_number_id = vpn.id
WHERE vc.name = 'Smoke Test Campaign';

-- ============================================
-- CLEANUP (Optional)
-- ============================================

-- Uncomment to clean up test data:

-- DELETE FROM voice_call_records WHERE campaign_id IN (
--   SELECT id FROM voice_campaigns WHERE name = 'Smoke Test Campaign'
-- );
-- 
-- DELETE FROM voice_campaigns WHERE name = 'Smoke Test Campaign';
-- 
-- DELETE FROM leads WHERE source = 'smoke_test';
-- 
-- DELETE FROM crm_contacts WHERE email LIKE 'test%@example.com';

-- ============================================
-- SMOKE TEST CHECKLIST
-- ============================================

/*
✓ Templates exist and are queryable
✓ Phone pool has available numbers
✓ Deploy template creates agent with ElevenLabs mapping
✓ Assign number creates tenant assignment and voice_phone_numbers record
✓ Batch start queues calls for leads
✓ Call records are created with proper status
✓ Webhook updates call records and emits events
✓ Usage ledger tracks call costs
✓ Kernel optimizer creates decisions and actions
✓ Campaign metrics calculate correctly
✓ Dashboard queries return complete data
*/
