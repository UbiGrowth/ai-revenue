# Google Workspace Integration

Complete integration of Gmail, Google Calendar, and Google Drive with Claude AI-powered analysis for the UbiGrowth AI Revenue platform.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Frontend App   │────▶│ google-oauth │────▶│ Google APIs  │
│  (ubigrowth.ai) │     │ (Edge Func)  │     │  OAuth 2.0   │
└─────────────────┘     └──────────────┘     └─────────────┘
        │
        ├──▶ gmail-sync ──▶ Gmail API ──▶ gmail_messages table
        ├──▶ calendar-sync ──▶ Calendar API ──▶ google_calendar_events table
        ├──▶ drive-sync ──▶ Drive API ──▶ google_drive_documents table
        └──▶ ai-analyze-workspace ──▶ Claude API ──▶ AI insights stored in tables
```

## Edge Functions

### 1. `google-oauth`
Handles OAuth 2.0 authentication flow with Google.

**Actions:**
- `connect` - Generate OAuth URL for user authorization
- `callback` - Handle Google OAuth callback (GET, called by Google)
- `disconnect` - Deactivate Google connection
- `status` - Check connection status
- `refresh` - Manually refresh access token

**Example:**
```bash
# Start OAuth flow
curl -X POST "${SUPABASE_URL}/functions/v1/google-oauth" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"action": "connect", "tenant_id": "YOUR_TENANT_ID"}'

# Check status
curl -X POST "${SUPABASE_URL}/functions/v1/google-oauth" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"action": "status", "tenant_id": "YOUR_TENANT_ID"}'
```

### 2. `gmail-sync`
Syncs Gmail messages to the database.

**Parameters:**
- `tenant_id` (required) - Workspace tenant ID
- `max_results` (optional, default: 50, max: 200) - Number of messages to sync
- `label` (optional, default: "INBOX") - Gmail label to sync

**Example:**
```bash
curl -X POST "${SUPABASE_URL}/functions/v1/gmail-sync" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "YOUR_TENANT_ID", "max_results": 100}'
```

### 3. `calendar-sync`
Syncs Google Calendar events to the database.

**Parameters:**
- `tenant_id` (required) - Workspace tenant ID
- `time_min` (optional) - Start of date range (ISO 8601)
- `time_max` (optional) - End of date range (ISO 8601)
- `max_results` (optional, default: 100, max: 500) - Max events per calendar

**Example:**
```bash
curl -X POST "${SUPABASE_URL}/functions/v1/calendar-sync" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "YOUR_TENANT_ID", "time_min": "2026-01-01T00:00:00Z"}'
```

### 4. `drive-sync`
Syncs Google Drive documents to the database with optional text extraction.

**Parameters:**
- `tenant_id` (required) - Workspace tenant ID
- `max_results` (optional, default: 50, max: 200) - Number of files to sync
- `extract_text` (optional, default: true) - Extract text from Google Docs/Sheets/Slides
- `folder_id` (optional) - Sync specific folder only

**Example:**
```bash
curl -X POST "${SUPABASE_URL}/functions/v1/drive-sync" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "YOUR_TENANT_ID", "max_results": 50, "extract_text": true}'
```

### 5. `ai-analyze-workspace`
Runs Claude AI analysis on unanalyzed Gmail, Calendar, and Drive data.

**Parameters:**
- `tenant_id` (required) - Workspace tenant ID
- `data_type` (optional) - "gmail", "calendar", "drive", or "all" (default: "gmail")

**AI Analysis Outputs:**
- **Gmail**: Category, sentiment, priority score (1-10), revenue relevance
- **Calendar**: Meeting category, revenue relevance, quality score
- **Drive**: Document category, key topics, summary, business value score

**Example:**
```bash
curl -X POST "${SUPABASE_URL}/functions/v1/ai-analyze-workspace" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "YOUR_TENANT_ID", "data_type": "all"}'
```

## Database Tables

| Table | Description |
|-------|-------------|
| `google_workspace_connections` | OAuth tokens and connection status per tenant |
| `gmail_messages` | Synced email messages with AI analysis fields |
| `google_calendar_events` | Synced calendar events with attendee tracking |
| `google_drive_documents` | Synced documents with text extraction |
| `google_workspace_sync_jobs` | Job tracking for all sync operations |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude AI analysis | Yes |
| `SUPABASE_URL` | Supabase project URL (auto-populated) | Auto |
| `SUPABASE_ANON_KEY` | Supabase anonymous key (auto-populated) | Auto |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (auto-populated) | Auto |

## OAuth Scopes

The integration requests the following Google OAuth scopes:
- `gmail.readonly` - Read Gmail messages
- `gmail.send` - Send emails via Gmail
- `calendar.readonly` - Read calendar events
- `drive.readonly` - Read Drive files
- `userinfo.email` - Get user email address

## SQL Query Examples

```sql
-- High-priority unread emails
SELECT subject, from_email, ai_priority_score, ai_category, ai_sentiment
FROM gmail_messages
WHERE tenant_id = 'YOUR_TENANT_ID'
  AND is_read = false
  AND ai_priority_score >= 7
ORDER BY ai_priority_score DESC;

-- Upcoming external meetings
SELECT summary, start_time, ai_attendee_count, ai_external_attendees, ai_category
FROM google_calendar_events
WHERE tenant_id = 'YOUR_TENANT_ID'
  AND start_time > NOW()
  AND ai_external_attendees > 0
ORDER BY start_time;

-- Revenue-relevant documents
SELECT name, document_type, ai_summary, ai_category
FROM google_drive_documents
WHERE tenant_id = 'YOUR_TENANT_ID'
  AND ai_insights->>'revenue_relevance' IN ('high', 'medium')
ORDER BY modified_time DESC;

-- Sync job history
SELECT job_type, status, items_processed, items_added, items_failed, created_at
FROM google_workspace_sync_jobs
WHERE tenant_id = 'YOUR_TENANT_ID'
ORDER BY created_at DESC
LIMIT 20;
```
