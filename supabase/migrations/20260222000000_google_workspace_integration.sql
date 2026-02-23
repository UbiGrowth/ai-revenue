-- Google Workspace Integration
-- Supports Gmail, Calendar, and Drive sync with AI-powered insights

-- OAuth connections table
CREATE TABLE IF NOT EXISTS google_workspace_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  google_email TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Gmail messages table
CREATE TABLE IF NOT EXISTS gmail_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  subject TEXT,
  from_email TEXT,
  from_name TEXT,
  to_emails TEXT[] DEFAULT ARRAY[]::TEXT[],
  cc_emails TEXT[] DEFAULT ARRAY[]::TEXT[],
  bcc_emails TEXT[] DEFAULT ARRAY[]::TEXT[],
  body_text TEXT,
  body_html TEXT,
  snippet TEXT,
  labels TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  has_attachments BOOLEAN NOT NULL DEFAULT false,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  received_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  analyzed_at TIMESTAMPTZ,
  ai_insights JSONB,
  ai_category TEXT,
  ai_sentiment TEXT,
  ai_priority_score INTEGER CHECK (ai_priority_score IS NULL OR (ai_priority_score >= 1 AND ai_priority_score <= 10)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, message_id)
);

-- Calendar events table
-- UNIQUE on (tenant_id, event_id, calendar_id) because the same event
-- can appear in multiple calendars (e.g. shared/delegated calendars).
CREATE TABLE IF NOT EXISTS google_calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  calendar_name TEXT,
  summary TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  organizer_email TEXT,
  organizer_name TEXT,
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  event_type TEXT,
  meeting_link TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_rules TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT,
  visibility TEXT,
  ai_attendee_count INTEGER NOT NULL DEFAULT 0,
  ai_external_attendees INTEGER NOT NULL DEFAULT 0,
  analyzed_at TIMESTAMPTZ,
  ai_insights JSONB,
  ai_category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, event_id, calendar_id)
);

-- Drive documents table
CREATE TABLE IF NOT EXISTS google_drive_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT,
  file_extension TEXT,
  web_view_link TEXT,
  download_url TEXT,
  folder_id TEXT,
  folder_path TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  content_preview TEXT,
  full_text_extracted TEXT,
  size_bytes BIGINT,
  created_time TIMESTAMPTZ,
  modified_time TIMESTAMPTZ,
  last_modified_by_email TEXT,
  owner_email TEXT,
  owner_name TEXT,
  shared_with JSONB NOT NULL DEFAULT '[]'::jsonb,
  document_type TEXT,
  analyzed_at TIMESTAMPTZ,
  ai_insights JSONB,
  ai_category TEXT,
  ai_key_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, file_id)
);

-- Sync jobs table
CREATE TABLE IF NOT EXISTS google_workspace_sync_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('gmail_sync', 'calendar_sync', 'drive_sync')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  sync_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  items_processed INTEGER NOT NULL DEFAULT 0,
  items_added INTEGER NOT NULL DEFAULT 0,
  items_updated INTEGER NOT NULL DEFAULT 0,
  items_failed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gmail_messages_tenant_received ON gmail_messages(tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_unread ON gmail_messages(tenant_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_gmail_messages_unanalyzed ON gmail_messages(tenant_id, analyzed_at) WHERE analyzed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gmail_messages_priority ON gmail_messages(tenant_id, ai_priority_score DESC) WHERE ai_priority_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_time ON google_calendar_events(tenant_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_unanalyzed ON google_calendar_events(tenant_id, analyzed_at) WHERE analyzed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_drive_documents_tenant_modified ON google_drive_documents(tenant_id, modified_time DESC);
CREATE INDEX IF NOT EXISTS idx_drive_documents_unanalyzed ON google_drive_documents(tenant_id, analyzed_at) WHERE analyzed_at IS NULL;
-- Full-text index: coalesce NULL to empty string to avoid index issues
CREATE INDEX IF NOT EXISTS idx_drive_documents_fulltext ON google_drive_documents USING gin(to_tsvector('english', COALESCE(full_text_extracted, '')));

CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_created ON google_workspace_sync_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON google_workspace_sync_jobs(status) WHERE status IN ('queued', 'running');

-- RLS Policies
ALTER TABLE google_workspace_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_drive_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_workspace_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their workspace connections"
  ON google_workspace_connections FOR ALL
  USING (tenant_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their workspace Gmail messages"
  ON gmail_messages FOR ALL
  USING (tenant_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their workspace calendar events"
  ON google_calendar_events FOR ALL
  USING (tenant_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their workspace drive documents"
  ON google_drive_documents FOR ALL
  USING (tenant_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their workspace sync jobs"
  ON google_workspace_sync_jobs FOR ALL
  USING (tenant_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- Triggers: mark new inserts for AI analysis
CREATE OR REPLACE FUNCTION mark_for_ai_analysis()
RETURNS TRIGGER AS $$
BEGIN
  NEW.analyzed_at := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gmail_mark_for_analysis
  BEFORE INSERT ON gmail_messages
  FOR EACH ROW EXECUTE FUNCTION mark_for_ai_analysis();

CREATE TRIGGER calendar_mark_for_analysis
  BEFORE INSERT ON google_calendar_events
  FOR EACH ROW EXECUTE FUNCTION mark_for_ai_analysis();

CREATE TRIGGER drive_mark_for_analysis
  BEFORE INSERT ON google_drive_documents
  FOR EACH ROW EXECUTE FUNCTION mark_for_ai_analysis();

-- Helper function to get token for a tenant (used by pg_cron jobs)
CREATE OR REPLACE FUNCTION refresh_google_token(p_tenant_id UUID)
RETURNS TABLE (access_token TEXT, expires_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT gwc.access_token, gwc.token_expires_at
  FROM google_workspace_connections gwc
  WHERE gwc.tenant_id = p_tenant_id AND gwc.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
