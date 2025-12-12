-- Raw email events log from providers (Resend, SendGrid, etc.)
CREATE TABLE public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL, -- 'resend', 'sendgrid', etc.
  event_type text NOT NULL, -- 'sent','delivered','open','click','bounce','complaint','reply'
  provider_message_id text, -- outbound message id
  provider_thread_id text,  -- if available
  email_address text NOT NULL,
  campaign_id uuid NULL REFERENCES public.cmo_campaigns(id) ON DELETE SET NULL,
  lead_id uuid NULL REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  contact_id uuid NULL REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  sequence_run_id uuid NULL REFERENCES public.outbound_sequence_runs(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- RLS policies with tenant isolation pattern
CREATE POLICY "tenant_isolation" ON public.email_events
FOR ALL
USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
);

-- Indexes for efficient queries
CREATE INDEX idx_email_events_tenant_id ON public.email_events(tenant_id);
CREATE INDEX idx_email_events_campaign_id ON public.email_events(campaign_id);
CREATE INDEX idx_email_events_lead_id ON public.email_events(lead_id);
CREATE INDEX idx_email_events_email_address ON public.email_events(email_address);
CREATE INDEX idx_email_events_event_type ON public.email_events(event_type);
CREATE INDEX idx_email_events_occurred_at ON public.email_events(occurred_at DESC);
CREATE INDEX idx_email_events_provider_message_id ON public.email_events(provider_message_id);

-- Composite index for analytics queries
CREATE INDEX idx_email_events_campaign_type_date ON public.email_events(campaign_id, event_type, occurred_at DESC);