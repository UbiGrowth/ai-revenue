# 🔧 Voice Setup Troubleshooting

**Issue:** Browser fails when checking voice setup

---

## ✅ **Fixed!**

I've updated the system to handle browser calls properly:

1. ✅ Added CORS handling to edge function
2. ✅ Improved error handling in React hook
3. ✅ Added graceful fallback UI
4. ✅ Better console logging for debugging

---

## 🧪 **Verify It's Working:**

### **1. Check Browser Console**

Open your Voice Agents page and check the browser console (F12):

**Good:**
```
Voice health check successful
{
  ready: true,
  providers: { vapi: {...}, elevenlabs: {...} }
}
```

**If Error:**
```
Voice health check error: [details here]
```

### **2. Test the Function Directly**

Open browser console and run:

```javascript
const { data, error } = await window.supabase.functions.invoke('voice-health-check', {
  body: {}
})
console.log('Result:', data, error)
```

---

## 🔍 **Common Issues & Fixes:**

### **Issue 1: "Function not found"**
**Cause:** Function not deployed or URL wrong

**Fix:**
```powershell
supabase functions deploy voice-health-check
```

### **Issue 2: "CORS error"**
**Cause:** Missing CORS headers

**Fix:** Already fixed! Function now handles CORS properly.

### **Issue 3: "Timeout"**
**Cause:** Function taking too long (checking external APIs)

**What Happens:**
- Function has 3-second timeouts for each provider check
- If VAPI/ElevenLabs don't respond, it skips them
- Shows what IS working

**No action needed** - function handles timeouts gracefully

### **Issue 4: "No data returned"**
**Cause:** Function error on server

**Fix:**
1. Check function logs:
   ```
   https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/functions
   ```
2. Click `voice-health-check` → View Logs
3. Look for errors

---

## 🎯 **Expected Behavior:**

### **When Page Loads:**

```
1. Component mounts
2. useVoiceSetup hook runs
3. Calls voice-health-check function (2-3 sec)
4. Shows result:
   ✅ "Voice agents ready!" OR
   ⚠️ "Unable to check voice setup"
```

### **If Function Fails:**

Component shows:
```
⚠️ Voice Setup Status
Unable to check voice setup. 
Check console for details.

[Try Again] [Check Functions →]
```

**This is safe** - UI still works, just shows error state

---

## 🔑 **Understanding the Architecture:**

```
Browser (Frontend)
    ↓
Calls: supabase.functions.invoke('voice-health-check')
    ↓
Supabase Edge Function (Server)
  • Has access to VAPI_PRIVATE_KEY
  • Has access to ELEVENLABS_API_KEY
  • Checks each provider
  • Returns status
    ↓
Browser receives result
    ↓
Shows in UI
```

**Why this works:**
- Secrets stay on server ✅
- Browser only gets status ✅
- No security issues ✅

---

## 🛠️ **Manual Testing:**

### **Test 1: Health Check Function**

```powershell
# PowerShell
$ANON_KEY = "your_anon_key_here"

Invoke-RestMethod `
    -Uri "https://ddwqkkiqgjptguzoeohr.supabase.co/functions/v1/voice-health-check" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $ANON_KEY"
        "Content-Type" = "application/json"
    } `
    -Body '{}'
```

**Expected Response:**
```json
{
  "ready": true,
  "providers": {
    "vapi": { "connected": true, "agents": 1 },
    "elevenlabs": { "connected": false, "agents": 0 },
    "orchestration": { "enabled": true }
  },
  "capabilities": [
    "VAPI voice calls",
    "VAPI voicemail drops",
    "Smart routing",
    "Cost optimization"
  ],
  "message": "✅ Voice agents ready! Send campaigns anytime."
}
```

### **Test 2: From Browser Console**

```javascript
// In your browser console on the Voice Agents page:
const { data, error } = await window.supabase.functions.invoke('voice-health-check', {
  body: {}
})

if (error) {
  console.error('Error:', error)
} else {
  console.log('Success:', data)
  console.log('Ready:', data.ready)
  console.log('Providers:', data.providers)
  console.log('Message:', data.message)
}
```

---

## 📊 **What Gets Checked:**

The function checks (with 3-second timeouts):

1. **VAPI:**
   - Calls: `https://api.vapi.ai/assistant?limit=1`
   - Needs: `VAPI_PRIVATE_KEY` secret
   - Returns: Connection status + agent count

2. **ElevenLabs:**
   - Calls: `https://api.elevenlabs.io/v1/user`
   - Needs: `ELEVENLABS_API_KEY` secret
   - Returns: Connection status + agent count

3. **Orchestration:**
   - Checks: If `OPENAI_API_KEY` exists
   - Returns: Enabled status

**If any fail:** Skips silently, shows what works

---

## ✅ **Verification Checklist:**

After refresh, you should see:

- [ ] Component loads (not stuck on "Detecting...")
- [ ] Shows either success card OR error message
- [ ] Console shows "Voice health check..." logs
- [ ] No CORS errors in console
- [ ] "Refresh" button works

---

## 🆘 **Still Having Issues?**

### **Check These:**

1. **Are functions deployed?**
   ```powershell
   supabase functions list
   ```
   Should show: `voice-health-check`

2. **Are secrets set?**
   ```powershell
   supabase secrets list
   ```
   Should show: `VAPI_PRIVATE_KEY`, `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`

3. **Can you access the function?**
   Check: https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/functions
   Click: `voice-health-check` → Should show "Deployed"

4. **Check function logs:**
   In dashboard → Functions → voice-health-check → Logs
   Look for: Errors, timeouts, or success messages

---

## 🎯 **What Should Happen Now:**

1. **Refresh your Voice Agents page**
2. **Wait 2-3 seconds** (checking providers)
3. **See result:**
   - ✅ Success: Shows providers, capabilities, "Ready!" message
   - ⚠️ Partial: Shows what's working, warns about missing providers
   - ❌ Error: Shows error message with "Try Again" button

**Either way, UI doesn't break!** It shows a helpful message.

---

*Last updated: 2026-01-08*
