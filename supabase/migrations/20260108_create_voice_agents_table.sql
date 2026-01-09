-- Create voice_agents table to track ElevenLabs agents per workspace
CREATE TABLE IF NOT EXISTS voice_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'elevenlabs',
  agent_id TEXT NOT NULL, -- ElevenLabs agent_id
  name TEXT NOT NULL,
  use_case TEXT, -- sales_outreach, customer_support, appointment_setting, lead_qualification
  config JSONB, -- Store agent configuration (first_message, system_prompt, voice_id, etc.)
  status TEXT DEFAULT 'active', -- active, inactive, deleted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Ensure workspace isolation
  CONSTRAINT unique_agent_per_workspace UNIQUE(workspace_id, agent_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_voice_agents_workspace ON voice_agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_voice_agents_status ON voice_agents(status);
CREATE INDEX IF NOT EXISTS idx_voice_agents_use_case ON voice_agents(use_case);

-- Enable RLS
ALTER TABLE voice_agents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see agents in their workspace
CREATE POLICY "Users can view their workspace agents"
  ON voice_agents
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can create agents in their workspace
CREATE POLICY "Users can create agents in their workspace"
  ON voice_agents
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update agents in their workspace
CREATE POLICY "Users can update agents in their workspace"
  ON voice_agents
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete agents in their workspace
CREATE POLICY "Users can delete agents in their workspace"
  ON voice_agents
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_voice_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER voice_agents_updated_at
  BEFORE UPDATE ON voice_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_agents_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON voice_agents TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
