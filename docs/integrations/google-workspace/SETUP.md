# Google Workspace Integration Setup

## Prerequisites
1. Google Cloud Console account
2. Supabase project
3. Anthropic API key

## Step 1: Google Cloud Setup

1. Go to https://console.cloud.google.com/
2. Create or select your project
3. Enable APIs:
   - Gmail API
   - Google Calendar API
   - Google Drive API
4. Create OAuth 2.0 credentials:
   - Go to **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URI:
     ```
     https://<your-project>.supabase.co/functions/v1/google-oauth?action=callback
     ```
5. Copy **Client ID** and **Client Secret**

## Step 2: Supabase Environment Variables

Navigate to your Supabase project settings under Edge Functions configuration.

Add these environment variables:

```
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>
ANTHROPIC_API_KEY=<from-anthropic-console>
```

The following are auto-populated by Supabase (no action needed):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Step 3: Apply Database Migration

The migration file `supabase/migrations/20260222000000_google_workspace_integration.sql` creates all required tables, indexes, RLS policies, and triggers.

If using Supabase CLI:
```bash
supabase db push
```

Or apply manually via the Supabase SQL Editor.

## Step 4: Deploy Edge Functions

```bash
supabase functions deploy google-oauth
supabase functions deploy gmail-sync
supabase functions deploy calendar-sync
supabase functions deploy drive-sync
supabase functions deploy ai-analyze-workspace
```

## Step 5: Test the Integration

### Test OAuth flow
```bash
curl -X POST "https://<your-project>.supabase.co/functions/v1/google-oauth" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"action": "connect", "tenant_id": "<TENANT_ID>"}'
```

### Test Gmail sync
```bash
curl -X POST "https://<your-project>.supabase.co/functions/v1/gmail-sync" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "<TENANT_ID>", "max_results": 10}'
```

### Test AI analysis
```bash
curl -X POST "https://<your-project>.supabase.co/functions/v1/ai-analyze-workspace" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "<TENANT_ID>", "data_type": "all"}'
```

## Troubleshooting

**OAuth fails**: Check that the redirect URI matches exactly, including the `?action=callback` query parameter.

**Token refresh fails**: Verify `GOOGLE_CLIENT_SECRET` is correct and the refresh token hasn't been revoked.

**AI analysis fails**: Confirm `ANTHROPIC_API_KEY` is valid and has sufficient credits.

**No data synced**: Ensure the Google account has data in Gmail/Calendar/Drive and that the correct OAuth scopes were granted.
