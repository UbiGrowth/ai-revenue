# Google Workspace Integration

Complete Google Workspace integration for UbiGrowth AI Revenue platform with AI-powered insights via Claude.

## Overview

This integration connects Gmail, Google Calendar, and Google Drive to the UbiGrowth platform, syncing data and providing AI-powered analysis for revenue intelligence.

### Components

| Component | Edge Function | Description |
|-----------|--------------|-------------|
| OAuth | `google-oauth` | Handles OAuth 2.0 flow with Google (start + callback) |
| Gmail | `gmail-sync` | Syncs emails with parsing and metadata extraction |
| Calendar | `calendar-sync` | Syncs calendar events with attendee analysis |
| Drive | `drive-sync` | Syncs documents with text extraction |
| AI Analysis | `ai-analyze-workspace` | Analyzes synced data using Claude AI |

### Database Tables

| Table | Purpose |
|-------|---------|
| `google_workspace_connections` | OAuth tokens and connection state per tenant |
| `gmail_messages` | Synced email messages with AI analysis fields |
| `google_calendar_events` | Synced calendar events with AI categorization |
| `google_drive_documents` | Synced documents with extracted text and AI insights |
| `google_workspace_sync_jobs` | Sync job tracking and status monitoring |

## Setup

### 1. Google Cloud Console

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable these APIs:
   - Gmail API
   - Google Calendar API
   - Google Drive API
3. Create OAuth 2.0 credentials (Web application type)
4. Set the authorized redirect URI:
   ```
   https://<your-supabase-project>.supabase.co/functions/v1/google-oauth?action=callback
   ```

### 2. Environment Variables

Set these in the Supabase Dashboard under Edge Function settings:

| Variable | Source | Description |
|----------|--------|-------------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | OAuth 2.0 Client Secret |
| `ANTHROPIC_API_KEY` | Anthropic Console | API key for Claude AI analysis |

The following are automatically available in Supabase Edge Functions:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3. Database Migration

The migration file `20260222000000_google_workspace_integration.sql` creates all required tables, indexes, RLS policies, and triggers.

## API Reference

### Google OAuth (`google-oauth`)

**Start OAuth Flow**
```
POST /functions/v1/google-oauth
Authorization: Bearer <user-jwt>
Content-Type: application/json

{
  "tenantId": "uuid",
  "redirectUrl": "https://ubigrowth.ai/settings/integrations",
  "scopes": "optional custom scopes string"
}
```

Response:
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

**OAuth Callback** (handled automatically via redirect)
```
GET /functions/v1/google-oauth?action=callback&code=...&state=...
```

### Gmail Sync (`gmail-sync`)

```
POST /functions/v1/gmail-sync
Authorization: Bearer <user-jwt>
Content-Type: application/json

{
  "tenantId": "uuid",
  "maxResults": 50,
  "query": "is:unread"
}
```

Response:
```json
{
  "success": true,
  "job_id": "uuid",
  "items_processed": 50,
  "items_added": 48,
  "items_failed": 2
}
```

### Calendar Sync (`calendar-sync`)

```
POST /functions/v1/calendar-sync
Authorization: Bearer <user-jwt>
Content-Type: application/json

{
  "tenantId": "uuid",
  "calendarId": "primary",
  "timeMin": "2026-01-01T00:00:00Z",
  "timeMax": "2026-04-01T00:00:00Z",
  "maxResults": 100
}
```

### Drive Sync (`drive-sync`)

```
POST /functions/v1/drive-sync
Authorization: Bearer <user-jwt>
Content-Type: application/json

{
  "tenantId": "uuid",
  "folderId": "optional-folder-id",
  "maxResults": 100,
  "query": "optional search query"
}
```

### AI Analysis (`ai-analyze-workspace`)

```
POST /functions/v1/ai-analyze-workspace
Authorization: Bearer <user-jwt>
Content-Type: application/json

{
  "tenantId": "uuid",
  "type": "all",
  "batchSize": 10
}
```

The `type` parameter accepts: `"gmail"`, `"calendar"`, `"drive"`, or `"all"`.

Response:
```json
{
  "success": true,
  "results": {
    "gmail": { "analyzed": 10, "failed": 0 },
    "calendar": { "analyzed": 8, "failed": 1 },
    "drive": { "analyzed": 5, "failed": 0 }
  }
}
```

## AI Analysis Details

### Gmail Analysis
- **Category**: lead, customer, partner, support, billing, marketing, internal, spam, other
- **Sentiment**: positive, negative, neutral, urgent
- **Priority Score**: 1-100 (revenue generation priority)
- **Insights**: revenue signals, action items, key topics

### Calendar Analysis
- **Category**: sales_meeting, client_call, internal_meeting, demo, onboarding, review, planning, social, other
- **Insights**: revenue potential, client-facing flag, preparation notes

### Drive Analysis
- **Category**: proposal, contract, invoice, report, presentation, spreadsheet, template, meeting_notes, strategy, other
- **Insights**: revenue relevance, action items, stakeholders, document status

## Architecture

- **Multi-tenant**: All data is isolated by `tenant_id` with RLS policies
- **Token management**: Automatic refresh of expired Google OAuth tokens
- **Job tracking**: Every sync operation is tracked in `google_workspace_sync_jobs`
- **AI triggers**: New records automatically have `analyzed_at = NULL`, making them eligible for AI analysis
- **Text extraction**: Google Docs, Sheets, and Slides content is exported as text for AI analysis

## Security

- OAuth tokens are stored encrypted in the database
- RLS policies enforce workspace-level isolation
- Redirect URLs are validated against an allowlist
- Service role key is only used for token management operations
- User JWT is verified on every request
