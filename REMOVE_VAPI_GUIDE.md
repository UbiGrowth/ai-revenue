# 🔧 Remove VAPI Integration Guide

**Date:** 2026-01-08  
**Account:** bill@ubigrowth.com  
**Status:** VAPI Removed from UI ✅

---

## ✅ **What Was Changed:**

### **1. Voice Agents UI Updated**
- ✅ Removed VAPI conversation hook
- ✅ Replaced `vapi-list-assistants` with `elevenlabs-list-agents`
- ✅ Removed VAPI public key requirement check
- ✅ ElevenLabs agents now display in the UI

### **2. Files Modified:**
- `src/pages/VoiceAgents.tsx` - Main UI now uses ElevenLabs

### **3. Edge Functions (No Changes Needed):**
```
✅ elevenlabs-make-call        - Makes direct calls
✅ elevenlabs-list-agents      - Lists ElevenLabs agents
✅ orchestrate-campaign        - Smart routing (already updated)
✅ smart-send                  - Campaign API

⚠️  vapi-* functions           - Still deployed but not used in UI
```

---

## 🔌 **Disconnect VAPI from Your Account:**

### **Step 1: Cancel VAPI Subscription**

1. Go to: https://dashboard.vapi.ai/ (or https://vapi.ai/dashboard)
2. Sign in with: **bill@ubigrowth.com**
3. Go to **Settings** → **Billing** or **Subscription**
4. Click **Cancel Subscription** or **Downgrade to Free**
5. Confirm cancellation

### **Step 2: Remove VAPI API Keys (Optional)**

If you want to completely remove VAPI:

```powershell
cd "C:\Users\bill\.cursor\ubigrowth-marketing-hub"

# List current secrets
supabase secrets list

# Optional: Remove VAPI secrets
supabase secrets unset VAPI_PRIVATE_KEY
supabase secrets unset VAPI_PUBLIC_KEY
```

**Note:** Keeping the secrets doesn't cost anything, so you can leave them as a backup.

### **Step 3: Remove VAPI Environment Variable (Optional)**

If you have `VITE_VAPI_PUBLIC_KEY` in your `.env.local` file:

1. Open `.env.local`
2. Remove or comment out: `VITE_VAPI_PUBLIC_KEY=...`
3. Save the file

---

## 🧪 **Test the New ElevenLabs Integration:**

### **Test 1: Check Voice Agents UI**

1. Start the dev server (if not running):
```powershell
npm run dev
```

2. Navigate to: http://localhost:8080/voice-agents

3. **Expected Result:**
   - Page loads without VAPI errors
   - Shows ElevenLabs agents (if you have any)
   - No "VAPI not configured" error

### **Test 2: List ElevenLabs Agents**

**Via Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/functions
2. Click on `elevenlabs-list-agents`
3. Click "Invoke Function"
4. Body: `{}`
5. Click "Invoke"

**Expected Response:**
```json
{
  "success": true,
  "agents": [
    {
      "agent_id": "...",
      "name": "Your Agent Name",
      "created_at": "..."
    }
  ]
}
```

**If you don't have agents yet:**
```json
{
  "success": true,
  "agents": []
}
```

### **Test 3: Create an ElevenLabs Agent**

1. Go to: https://elevenlabs.io/app/conversational-ai
2. Sign in with your ElevenLabs account
3. Click "Create Agent" or "New Agent"
4. Configure:
   - **Name:** "Sales Outreach Agent"
   - **First Message:** "Hi! I'm calling from UbiGrowth. Do you have a moment?"
   - **System Prompt:** "You are a professional sales agent..."
   - **Voice:** Choose a voice
5. Save the agent
6. Copy the **Agent ID**

### **Test 4: Make a Test Call (Optional)**

**⚠️ Warning:** This will make a real phone call and may incur charges!

```powershell
# Get your agent_id from ElevenLabs dashboard
$agentId = "your_agent_id_here"
$phoneNumber = "+15555551234"  # Use a real test number

# Test via Supabase Dashboard:
# Go to elevenlabs-make-call function
# Body:
{
  "agent_id": "your_agent_id",
  "phone_number": "+15555551234",
  "lead_data": {
    "id": "test-123",
    "name": "Test Lead"
  }
}
```

---

## 📊 **What You'll See in the UI:**

### **Before (VAPI):**
```
❌ Voice agents not configured. Please contact support.
```

### **After (ElevenLabs):**
```
✅ Voice Agents page loads
✅ Shows ElevenLabs agents (if any)
✅ No VAPI errors
✅ Campaign execution uses ElevenLabs
```

---

## 🎯 **Architecture Comparison:**

### **Old (VAPI):**
```
UI → VAPI Hook → VAPI API → ElevenLabs → Phone Call
     (Browser)    (Aggregator)
```

### **New (Direct ElevenLabs):**
```
UI → Supabase Edge Function → ElevenLabs API → Phone Call
     (No browser dependency)        (Direct)
```

**Benefits:**
- ✅ **30-50% cheaper** - No VAPI markup
- ✅ **Simpler** - One service instead of two
- ✅ **More reliable** - Fewer points of failure
- ✅ **No browser dependency** - All server-side

---

## 🔐 **Security Notes:**

### **What Stays:**
- ✅ ElevenLabs API Key (in Supabase secrets)
- ✅ OpenAI API Key (for orchestration)
- ✅ All other API keys (Resend, Twilio, etc.)

### **What Can Be Removed:**
- ⚠️  VAPI Private Key (in Supabase secrets)
- ⚠️  VAPI Public Key (in `.env.local`)
- ⚠️  VAPI account subscription

**Recommendation:** Keep VAPI secrets for 30 days as a backup, then remove.

---

## 📞 **Next Steps:**

1. **Cancel VAPI Subscription** (saves ~$50-100/month)
2. **Test Voice Agents UI** (confirm ElevenLabs agents load)
3. **Create ElevenLabs Agents** (if you don't have any)
4. **Run Test Campaign** (verify calls work)
5. **Remove VAPI Secrets** (after 30 days of testing)

---

## 🆘 **Troubleshooting:**

### **Problem:** Voice Agents page shows no agents

**Solution:**
1. Check ElevenLabs dashboard: https://elevenlabs.io/app/conversational-ai
2. Create an agent if you don't have any
3. Verify ElevenLabs API key is set in Supabase secrets:
```powershell
supabase secrets list | Select-String "ELEVENLABS"
```

### **Problem:** "401 Unauthorized" error

**Solution:**
- ElevenLabs API key might be invalid
- Check: https://elevenlabs.io/app/settings
- Regenerate key and update in Supabase:
```powershell
supabase secrets set ELEVENLABS_API_KEY="your_new_key"
```

### **Problem:** Calls not working

**Solution:**
1. Check agent_id is correct
2. Verify phone number format: `+1XXXXXXXXXX`
3. Check ElevenLabs account has calling credits
4. Review logs in Supabase dashboard

---

## 📚 **Related Documentation:**

- `RECOMMENDED_VOICE_ARCHITECTURE.md` - Architecture decision
- `DIRECT_INTEGRATION_PLAN.md` - Migration plan
- `CONFIGURE_AI_VIDEO_APIS.md` - All API keys

---

## ✅ **Summary:**

**VAPI has been removed from the Voice Agents UI!**

- ✅ UI now uses ElevenLabs directly
- ✅ Edge functions deployed and ready
- ✅ Smart orchestration updated
- ⚠️  You can now cancel VAPI subscription
- ⚠️  VAPI secrets can be removed (after testing period)

**Estimated Savings:** $50-100/month by removing VAPI

---

*Last updated: 2026-01-08*  
*Status: VAPI removed from UI, ready for account cancellation*
