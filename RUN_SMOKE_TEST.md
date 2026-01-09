# Run Platform Smoke Test

## Quick Start

```powershell
# Set environment variables
$env:VITE_SUPABASE_URL = "https://ddwqkkiqgjptguzoeohr.supabase.co"
$env:VITE_SUPABASE_PUBLISHABLE_KEY = "your-anon-key"

# Run test
.\smoke-test-platform.ps1 -Email "your@email.com" -Password "your-password"
```

## Expected: All 4 PASS

```
✓ ALL 4 FLOWS PASSED
Platform is stable on new database
```

## If Any FAIL

1. Check function logs:
```bash
supabase functions logs ai-chat --project-ref ddwqkkiqgjptguzoeohr
supabase functions logs cmo-campaign-builder --project-ref ddwqkkiqgjptguzoeohr
```

2. Verify OPENAI_API_KEY is set:
```bash
supabase secrets list --project-ref ddwqkkiqgjptguzoeohr
```

3. Check deployment status:
```bash
supabase functions list --project-ref ddwqkkiqgjptguzoeohr
```

## What Gets Tested

1. **Auth + Tenant Resolution** - JWT → workspace_id + tenant_id
2. **AI Chat (Quick Actions)** - Streaming OpenAI response with auth
3. **Onboarding Assistant** - Streaming OpenAI response with auth
4. **Campaign Create** - Full autopilot campaign generation via OpenAI

## Files Changed

- `supabase/functions/ai-chat/index.ts` - Auth validation
- `supabase/functions/cmo-campaign-builder/index.ts` - OpenAI migration
- `src/components/WelcomeModal.tsx` - JWT auth (already fixed)
- `supabase/functions/onboarding-assistant/index.ts` - OpenAI (already fixed)

## Deployment

All functions deployed to project `ddwqkkiqgjptguzoeohr`:
- ✅ ai-chat
- ✅ cmo-campaign-builder  
- ✅ onboarding-assistant
- ✅ cmo-kernel (no changes)

Ready to test!
