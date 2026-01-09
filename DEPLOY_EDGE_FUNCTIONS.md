# 🚀 DEPLOY EDGE FUNCTIONS - PHASE 3

**Status:** Ready to Deploy  
**Date:** 2026-01-08  
**Project:** ddwqkkiqgjptguzoeohr

---

## ✅ PREREQUISITES (ALL COMPLETE)

- ✅ SQL smoke tests passed
- ✅ UI tests passed (CRM, Leads, Campaigns all working)
- ✅ Database has 24,274 leads
- ✅ 32 active campaigns
- ✅ Dev server working (http://localhost:8081/)

---

## 📦 EDGE FUNCTIONS TO DEPLOY

### **Critical Functions (Deploy First):**

1. **`run-job-queue`** - Processes outbox for Email, SMS, Voicemail
2. **`cmo-campaign-orchestrate`** - Launches campaigns
3. **`campaign-schedule-outbox`** - Schedules messages
4. **`ai-cmo-autopilot-build`** - AI campaign builder

### **Supporting Functions:**

5. **`cmo-launch-campaign`** - Campaign launcher
6. **`crm-leads-list`** - CRM data fetcher
7. **`cmo-webhook-outbound`** - Webhook handler
8. **`execute-voice-campaign`** - Voice campaign executor
9. **`vapi-outbound-call`** - VAPI voice calls
10. **`process-scheduled-emails`** - Email processor

---

## 🔧 DEPLOYMENT COMMANDS

### **Option A: Deploy All at Once (Recommended)**

```powershell
cd "C:\Users\bill\.cursor\ubigrowth-marketing-hub"

# Deploy all functions
supabase functions deploy --no-verify-jwt

# This will deploy:
# ✅ All 10+ Edge Functions
# ✅ Set up function URLs
# ✅ Configure triggers
```

**Expected Output:**
```
Deploying function run-job-queue...
Function deployed: https://ddwqkkiqgjptguzoeohr.functions.supabase.co/run-job-queue

Deploying function cmo-campaign-orchestrate...
Function deployed: https://ddwqkkiqgjptguzoeohr.functions.supabase.co/cmo-campaign-orchestrate

... (8 more functions)

All functions deployed successfully!
```

---

### **Option B: Deploy One at a Time (If Issues)**

```powershell
cd "C:\Users\bill\.cursor\ubigrowth-marketing-hub"

# Deploy critical functions first
supabase functions deploy run-job-queue
supabase functions deploy cmo-campaign-orchestrate
supabase functions deploy campaign-schedule-outbox
supabase functions deploy ai-cmo-autopilot-build

# Then deploy supporting functions
supabase functions deploy cmo-launch-campaign
supabase functions deploy crm-leads-list
supabase functions deploy cmo-webhook-outbound
```

---

## 🔐 CONFIGURE API SECRETS (After Deployment)

Once functions are deployed, set environment secrets:

### **Email (Resend):**
```powershell
supabase secrets set RESEND_API_KEY="re_xxxxxxxxxxxx"
```

Get your key: https://resend.com/api-keys

---

### **SMS (Twilio):**
```powershell
supabase secrets set TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxx"
supabase secrets set TWILIO_AUTH_TOKEN="your_auth_token"
supabase secrets set TWILIO_FROM_NUMBER="+12345678900"
```

Get your credentials: https://console.twilio.com/

---

### **Voicemail/Voice (VAPI):**
```powershell
supabase secrets set VAPI_PRIVATE_KEY="your_vapi_private_key"
```

Get your key: https://vapi.ai/dashboard

---

### **Optional: ElevenLabs (Voice Quality):**
```powershell
supabase secrets set ELEVENLABS_API_KEY="your_elevenlabs_key"
```

Get your key: https://elevenlabs.io/

---

## ✅ VERIFY DEPLOYMENT

### **1. Check Function URLs:**
```powershell
supabase functions list
```

**Expected Output:**
```
Function Name                    Status    URL
run-job-queue                   deployed  https://...
cmo-campaign-orchestrate        deployed  https://...
campaign-schedule-outbox        deployed  https://...
... (8 more)
```

---

### **2. Test a Function:**

**In Supabase Dashboard:**
1. Go to: Edge Functions
2. Select `run-job-queue`
3. Click "Invoke"
4. Check logs for success

**Or via curl:**
```powershell
$url = "https://ddwqkkiqgjptguzoeohr.functions.supabase.co/run-job-queue"
curl -X POST $url -H "Content-Type: application/json" -d '{}'
```

---

### **3. Check Secrets Are Set:**

**In Supabase Dashboard:**
1. Go to: Project Settings → Edge Functions → Secrets
2. Verify you see:
   - RESEND_API_KEY
   - TWILIO_ACCOUNT_SID
   - TWILIO_AUTH_TOKEN
   - TWILIO_FROM_NUMBER
   - VAPI_PRIVATE_KEY

---

## 🚨 TROUBLESHOOTING

### **Error: "Not logged in"**
```powershell
supabase login
supabase link --project-ref ddwqkkiqgjptguzoeohr
```

---

### **Error: "Function not found"**
```powershell
# List functions directory
dir supabase\functions

# Make sure you're in the right directory
cd "C:\Users\bill\.cursor\ubigrowth-marketing-hub"
```

---

### **Error: "Deployment failed"**
```powershell
# Check function syntax
cd supabase\functions\run-job-queue
deno check index.ts

# Or skip verification
supabase functions deploy run-job-queue --no-verify-jwt
```

---

### **Error: "Secrets not set"**
```powershell
# List current secrets
supabase secrets list

# Set missing secrets one by one
supabase secrets set KEY_NAME="value"
```

---

## 🎯 SUCCESS CRITERIA

**Functions are deployed successfully when:**

1. ✅ All 10+ functions show "deployed" status
2. ✅ Each function has a public URL
3. ✅ Function logs show no errors
4. ✅ All API secrets are set
5. ✅ Test invocation succeeds

---

## 📋 POST-DEPLOYMENT CHECKLIST

After deployment:

- [ ] Run `supabase functions list` - all show "deployed"
- [ ] Check Supabase Dashboard → Edge Functions - all green
- [ ] Verify secrets in Project Settings → Secrets
- [ ] Test one function invocation
- [ ] Check function logs for errors
- [ ] Launch a test campaign from UI
- [ ] Verify outbox entries created
- [ ] Check email/SMS delivery

---

## 🚀 DEPLOYMENT TIMELINE

**Estimated Time:**
- Deploy functions: 5-10 minutes
- Configure secrets: 5 minutes
- Verify deployment: 5 minutes
- **Total: 15-20 minutes**

---

## 🎉 AFTER DEPLOYMENT

Once functions are deployed and secrets configured:

1. **Launch Test Campaign:**
   - Go to UI → Campaigns
   - Create new email campaign
   - Target 1 test lead (your own email)
   - Click "Run"
   - Check your inbox!

2. **Monitor Job Queue:**
   ```sql
   SELECT * FROM job_queue 
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```

3. **Monitor Outbox:**
   ```sql
   SELECT * FROM channel_outbox 
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```

4. **Ship to Production!** 🚀

---

*Generated: 2026-01-08*  
*Phase 3 Deployment Guide*

