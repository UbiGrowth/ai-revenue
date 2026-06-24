-- ============================================
-- RevOS Voice v1 - Minimal DB Delta
-- ElevenLabs + Native Twilio Integration
-- ============================================

-- ============================================
-- 1. VOICE AGENT TEMPLATES (Catalog)
-- ============================================

CREATE TABLE IF NOT EXISTS public.voice_agent_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  use_case text NOT NULL, -- sales_outreach, customer_support, appointment_setting, lead_qualification
  provider text NOT NULL DEFAULT 'elevenlabs',
  
  -- Template configuration
  system_prompt text NOT NULL,
  first_message text NOT NULL,
  voice_id text, -- ElevenLabs voice ID
  language text DEFAULT 'en',
  end_call_phrases text[] DEFAULT ARRAY['goodbye', 'talk soon', 'have a great day'],
  
  -- Template metadata
  config jsonb DEFAULT '{}'::jsonb,
  is_public boolean DEFAULT true, -- Public templates available to all tenants
  created_by uuid REFERENCES auth.users(id),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_voice_agent_templates_use_case ON public.voice_agent_templates(use_case);
CREATE INDEX idx_voice_agent_templates_provider ON public.voice_agent_templates(provider);
CREATE INDEX idx_voice_agent_templates_public ON public.voice_agent_templates(is_public);

-- No RLS needed - templates are public catalog items (read-only for all authenticated users)
ALTER TABLE public.voice_agent_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public templates readable by authenticated users"
  ON public.voice_agent_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service role can insert/update templates
CREATE POLICY "Service role can manage templates"
  ON public.voice_agent_templates
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 2. TWILIO PHONE POOL (Master Pool)
-- Service-role only access
-- ============================================

CREATE TABLE IF NOT EXISTS public.twilio_phone_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_e164 text NOT NULL UNIQUE,
  twilio_sid text NOT NULL UNIQUE,
  
  -- Pool metadata
  country_code text NOT NULL, -- US, CA, GB, etc.
  capabilities jsonb DEFAULT '{"voice": true, "sms": false}'::jsonb,
  friendly_name text,
  
  -- Assignment tracking
  is_assigned boolean DEFAULT false,
  assigned_to_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  
  -- Provider tracking
  provider text DEFAULT 'twilio',
  provider_metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_twilio_phone_pool_assigned ON public.twilio_phone_pool(is_assigned);
CREATE INDEX idx_twilio_phone_pool_tenant ON public.twilio_phone_pool(assigned_to_tenant_id);
CREATE INDEX idx_twilio_phone_pool_country ON public.twilio_phone_pool(country_code);

-- RLS: Service role only (master pool)
ALTER TABLE public.twilio_phone_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to phone pool"
  ON public.twilio_phone_pool
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 3. TENANT PHONE ASSIGNMENTS
-- Maps tenants to their assigned phone numbers
-- ============================================

CREATE TABLE IF NOT EXISTS public.tenant_phone_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Phone pool reference
  pool_phone_id uuid NOT NULL REFERENCES public.twilio_phone_pool(id) ON DELETE RESTRICT,
  
  -- ElevenLabs integration
  elevenlabs_phone_number_id text, -- ElevenLabs phone number ID (if imported to ElevenLabs)
  
  -- Assignment metadata
  assigned_by uuid REFERENCES auth.users(id),
  assignment_purpose text, -- outbound_sales, inbound_support, etc.
  is_active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Tenant can have multiple numbers but each number assigned to only one tenant
  CONSTRAINT unique_tenant_pool_phone UNIQUE(tenant_id, pool_phone_id)
);

CREATE INDEX idx_tenant_phone_assignments_tenant ON public.tenant_phone_assignments(tenant_id);
CREATE INDEX idx_tenant_phone_assignments_workspace ON public.tenant_phone_assignments(workspace_id);
CREATE INDEX idx_tenant_phone_assignments_pool_phone ON public.tenant_phone_assignments(pool_phone_id);
CREATE INDEX idx_tenant_phone_assignments_active ON public.tenant_phone_assignments(is_active);

-- RLS: Tenant-scoped access
ALTER TABLE public.tenant_phone_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant phone assignments"
  ON public.tenant_phone_assignments
  FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can create phone assignments for their tenant"
  ON public.tenant_phone_assignments
  FOR INSERT
  WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update their tenant phone assignments"
  ON public.tenant_phone_assignments
  FOR UPDATE
  USING (user_belongs_to_tenant(tenant_id));

-- ============================================
-- 4. UPDATE voice_agents TABLE
-- Add ElevenLabs specific fields
-- ============================================

-- Add elevenlabs_agent_id column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'voice_agents' AND column_name = 'elevenlabs_agent_id'
  ) THEN
    ALTER TABLE public.voice_agents 
    ADD COLUMN elevenlabs_agent_id text;
  END IF;
END $$;

-- Add template_id column for tracking template source
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'voice_agents' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE public.voice_agents 
    ADD COLUMN template_id uuid REFERENCES public.voice_agent_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add use_case column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'voice_agents' AND column_name = 'use_case'
  ) THEN
    ALTER TABLE public.voice_agents 
    ADD COLUMN use_case text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_voice_agents_elevenlabs_id ON public.voice_agents(elevenlabs_agent_id);
CREATE INDEX IF NOT EXISTS idx_voice_agents_template ON public.voice_agents(template_id);
CREATE INDEX IF NOT EXISTS idx_voice_agents_use_case ON public.voice_agents(use_case);

-- ============================================
-- 5. UPDATE voice_phone_numbers TABLE
-- Add Twilio + ElevenLabs fields
-- ============================================

-- Add twilio_sid
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'voice_phone_numbers' AND column_name = 'twilio_sid'
  ) THEN
    ALTER TABLE public.voice_phone_numbers 
    ADD COLUMN twilio_sid text;
  END IF;
END $$;

-- Add elevenlabs_phone_number_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'voice_phone_numbers' AND column_name = 'elevenlabs_phone_number_id'
  ) THEN
    ALTER TABLE public.voice_phone_numbers 
    ADD COLUMN elevenlabs_phone_number_id text;
  END IF;
END $$;

-- Add pool_assignment_id to link to master pool
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'voice_phone_numbers' AND column_name = 'pool_assignment_id'
  ) THEN
    ALTER TABLE public.voice_phone_numbers 
    ADD COLUMN pool_assignment_id uuid REFERENCES public.tenant_phone_assignments(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_voice_phone_numbers_twilio_sid ON public.voice_phone_numbers(twilio_sid);
CREATE INDEX IF NOT EXISTS idx_voice_phone_numbers_elevenlabs_id ON public.voice_phone_numbers(elevenlabs_phone_number_id);
CREATE INDEX IF NOT EXISTS idx_voice_phone_numbers_pool_assignment ON public.voice_phone_numbers(pool_assignment_id);

-- ============================================
-- 6. VOICE CALL EVENTS
-- Extend kernel_events with voice-specific event types
-- No new table needed - use existing kernel_events
-- ============================================

-- Document voice event types in comments
COMMENT ON TABLE public.kernel_events IS 
'Revenue OS Kernel events (normalized). 
Voice events use type prefixes: voice.call.*, voice.agent.*, voice.number.*
Examples: voice.call.started, voice.call.ended, voice.call.qualified';

-- ============================================
-- 7. USAGE LEDGER FOR VOICE MINUTES
-- ============================================

CREATE TABLE IF NOT EXISTS public.voice_usage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Call reference
  call_id uuid REFERENCES public.voice_call_records(id) ON DELETE SET NULL,
  campaign_id uuid,
  
  -- Usage details
  usage_type text NOT NULL DEFAULT 'outbound_call', -- outbound_call, inbound_call, transcription
  duration_seconds integer NOT NULL DEFAULT 0,
  cost_usd numeric(10, 4) NOT NULL DEFAULT 0.0,
  provider text NOT NULL DEFAULT 'elevenlabs',
  
  -- Metadata
  phone_number_e164 text,
  customer_number_e164 text,
  agent_id uuid REFERENCES public.voice_agents(id) ON DELETE SET NULL,
  
  -- Timestamps
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_voice_usage_tenant ON public.voice_usage_ledger(tenant_id);
CREATE INDEX idx_voice_usage_workspace ON public.voice_usage_ledger(workspace_id);
CREATE INDEX idx_voice_usage_call ON public.voice_usage_ledger(call_id);
CREATE INDEX idx_voice_usage_campaign ON public.voice_usage_ledger(campaign_id);
CREATE INDEX idx_voice_usage_date ON public.voice_usage_ledger(usage_date);
CREATE INDEX idx_voice_usage_tenant_date ON public.voice_usage_ledger(tenant_id, usage_date);

-- RLS: Tenant-scoped
ALTER TABLE public.voice_usage_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant usage"
  ON public.voice_usage_ledger
  FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));

-- Only service role can insert usage records
CREATE POLICY "Service role can insert usage records"
  ON public.voice_usage_ledger
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 8. KERNEL JOB TRIGGERS
-- Add voice-specific job types to existing kernel architecture
-- ============================================

-- Document in kernel_decisions table
COMMENT ON TABLE public.kernel_decisions IS 
'Revenue OS Kernel decisions produced by policies.
Voice policies: voice_campaign_optimization, voice_quality_check, voice_retry_logic';

-- ============================================
-- 9. SEED DEFAULT TEMPLATES
-- ============================================

INSERT INTO public.voice_agent_templates (id, name, description, use_case, system_prompt, first_message, voice_id, is_public) VALUES
(
  gen_random_uuid(),
  'Sales Outreach Agent',
  'Professional sales representative for cold outreach and lead qualification',
  'sales_outreach',
  'You are a professional sales representative. Your tone is friendly, professional, and respectful of people''s time.

Your goal is to:
- Introduce your company and value proposition clearly
- Qualify the lead by understanding their needs and pain points
- Book a meeting or demo if they show interest
- Be respectful - if they''re not interested, politely end the call

Keep responses concise (2-3 sentences max). Ask one question at a time. Listen actively and respond naturally to their answers.',
  'Hi! I''m calling from [Company Name]. Do you have a quick moment to chat about how we can help your business?',
  'EXAVITQu4vr4xnSDxMaL',
  true
),
(
  gen_random_uuid(),
  'Appointment Setting Agent',
  'Efficient appointment scheduler for booking meetings and demos',
  'appointment_setting',
  'You are an appointment scheduling specialist. Your tone is friendly, efficient, and helpful.

Your goal is to:
- Confirm the prospect''s availability
- Find a suitable time slot that works for both parties
- Collect necessary information (email, company, role)
- Confirm appointment details clearly

Be efficient but friendly. Offer specific time options. Confirm details before ending the call.',
  'Hi! I''m calling to help schedule your appointment with [Company Name]. Is now a good time?',
  'EXAVITQu4vr4xnSDxMaL',
  true
),
(
  gen_random_uuid(),
  'Lead Qualification Agent',
  'Lead qualifier to score and prioritize prospects',
  'lead_qualification',
  'You are a lead qualification specialist. Your tone is conversational and consultative.

Your goal is to:
- Determine if the lead is a good fit for your solution
- Ask qualifying questions: budget, timeline, decision-making authority
- Score the lead as hot/warm/cold based on responses
- Pass qualified leads to sales team

Keep it conversational. Don''t sound scripted. Build rapport quickly.',
  'Hi! I''m calling from [Company Name]. I wanted to see if we might be a good fit to help with your [industry] needs. Do you have a moment?',
  'EXAVITQu4vr4xnSDxMaL',
  true
),
(
  gen_random_uuid(),
  'Customer Support Agent',
  'Helpful support agent for handling customer inquiries',
  'customer_support',
  'You are a customer support specialist. Your tone is empathetic, patient, and solution-oriented.

Your goal is to:
- Understand the customer''s issue or question
- Provide clear, actionable solutions
- Be empathetic and patient throughout
- Escalate to a human agent if the issue is complex

Keep responses clear and concise. Ask clarifying questions when needed.',
  'Hello! Thank you for calling [Company Name] support. How can I help you today?',
  'EXAVITQu4vr4xnSDxMaL',
  true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

COMMENT ON TABLE public.voice_agent_templates IS 'Catalog of reusable voice agent templates for quick deployment';
COMMENT ON TABLE public.twilio_phone_pool IS 'Master Twilio phone number pool - service role only access';
COMMENT ON TABLE public.tenant_phone_assignments IS 'Tenant-to-phone number assignments from master pool';
COMMENT ON TABLE public.voice_usage_ledger IS 'Voice usage tracking for billing and analytics';
