# 🎯 Direct Integration Plan - Remove VAPI, Use ElevenLabs + OpenAI Directly

**Date:** 2026-01-08  
**Goal:** Cut out VAPI aggregator, connect directly to ElevenLabs and OpenAI

---

## 🎨 **New Architecture:**

### **Voice Calls:**
```
User triggers campaign
    ↓
Smart orchestration (OpenAI) decides which leads need calls
    ↓
ElevenLabs Conversational AI API
    • Creates agent on-the-fly OR
    • Uses pre-configured agent
    ↓
Makes actual phone call
    ↓
Returns transcript + outcome
    ↓
Stored in your database
```

### **Benefits:**
- ✅ **Lower cost** - No VAPI markup (they charge on top of ElevenLabs)
- ✅ **More control** - Direct API access
- ✅ **Better reliability** - One less service in the chain
- ✅ **Full features** - Access to all ElevenLabs capabilities

---

## 🔧 **Implementation Steps:**

### **Phase 1: ElevenLabs Direct Integration**

#### **1. Create Edge Function for ElevenLabs Calls**

```typescript
// supabase/functions/elevenlabs-make-call/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')

serve(async (req) => {
  try {
    const { agent_id, phone_number, lead_data } = await req.json()
    
    // Make call directly via ElevenLabs
    const response = await fetch('https://api.elevenlabs.io/v1/convai/conversations/phone', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_id: agent_id,
        to_phone_number: phone_number,
        metadata: {
          lead_id: lead_data.id,
          lead_name: lead_data.name
        }
      })
    })
    
    const data = await response.json()
    
    return new Response(JSON.stringify({
      success: true,
      conversation_id: data.conversation_id,
      status: 'initiated'
    }), {
      headers: { "Content-Type": "application/json" }
    })
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
```

#### **2. Update Orchestration to Use ElevenLabs**

```typescript
// In orchestrate-campaign function
if (lead.score >= 8 && hasPhone) {
  // High-value lead → ElevenLabs call
  await supabase.functions.invoke('elevenlabs-make-call', {
    body: {
      agent_id: ELEVENLABS_AGENT_ID,
      phone_number: lead.phone,
      lead_data: lead
    }
  })
}
```

---

### **Phase 2: Remove VAPI Dependencies**

#### **Files to Update:**
1. `src/pages/VoiceAgents.tsx` - Remove VAPI code
2. `supabase/functions/*` - Remove VAPI function calls
3. Environment variables - Remove VAPI keys (keep as optional backup)

#### **What to Keep:**
- ✅ Orchestration logic
- ✅ Lead qualification
- ✅ Smart routing
- ✅ UI components

#### **What to Replace:**
- ❌ VAPI assistant calls → ElevenLabs agent calls
- ❌ VAPI phone numbers → ElevenLabs phone numbers
- ❌ VAPI webhooks → ElevenLabs webhooks

---

### **Phase 3: Simplified Voice UI**

New Voice Agents page flow:

```
1. List ElevenLabs Agents (from API)
2. Configure agent settings
3. Send campaign → Direct ElevenLabs call
4. View call history (from ElevenLabs API)
5. Analytics (from ElevenLabs data)
```

---

## 💰 **Cost Comparison:**

### **With VAPI (Current):**
```
You → VAPI → ElevenLabs → Phone Call
Cost: $0.10-0.15/min (VAPI markup) + ElevenLabs fee
```

### **Direct (Proposed):**
```
You → ElevenLabs → Phone Call
Cost: ~$0.10/min (ElevenLabs only)
Savings: 30-50% per call
```

---

## 🚀 **Quick Start - Direct Integration:**

### **1. Get ElevenLabs Agent ID**

Go to: https://elevenlabs.io/app/conversational-ai

Create or get existing agent ID.

### **2. Test Direct Call**

```powershell
$ELEVENLABS_KEY = "your_key"
$AGENT_ID = "your_agent_id"

Invoke-RestMethod `
    -Uri "https://api.elevenlabs.io/v1/convai/conversations/phone" `
    -Method POST `
    -Headers @{
        "xi-api-key" = $ELEVENLABS_KEY
        "Content-Type" = "application/json"
    } `
    -Body (@{
        agent_id = $AGENT_ID
        to_phone_number = "+1234567890"
    } | ConvertTo-Json)
```

### **3. Integrate into Platform**

Use the orchestration system to call ElevenLabs directly.

---

## 📋 **Migration Checklist:**

- [ ] Create `elevenlabs-make-call` edge function
- [ ] Create `elevenlabs-list-agents` edge function
- [ ] Create `elevenlabs-call-history` edge function
- [ ] Update orchestration to use ElevenLabs
- [ ] Update Voice Agents UI to use ElevenLabs
- [ ] Test with real call
- [ ] Remove VAPI dependencies
- [ ] Update documentation

---

## 🎯 **Final Architecture:**

```
Campaign Trigger
    ↓
Smart Orchestration (OpenAI)
  • Qualifies lead
  • Determines: Call? Email? SMS?
    ↓
If Call → ElevenLabs API (Direct)
  • agent_id
  • phone_number
  • metadata
    ↓
Call Made → Results Returned
    ↓
Stored in Database
    ↓
Analytics Dashboard
```

**No VAPI in the chain!**

---

## ✅ **Advantages:**

1. **Cost:** 30-50% cheaper
2. **Speed:** One less hop = faster
3. **Reliability:** Fewer points of failure
4. **Control:** Direct access to all features
5. **Simpler:** Less to maintain

---

## 🔗 **Key APIs:**

### **ElevenLabs Conversational AI:**
- Docs: https://elevenlabs.io/docs/conversational-ai/overview
- Make calls: `/v1/convai/conversations/phone`
- List agents: `/v1/convai/agents`
- Get conversation: `/v1/convai/conversations/{id}`

### **OpenAI (for orchestration):**
- Already integrated ✅
- Used for routing logic

---

**Ready to implement direct integration?**

This will:
- ✅ Reduce costs significantly
- ✅ Simplify your stack
- ✅ Give you more control
- ✅ Remove VAPI complexity

*Last updated: 2026-01-08*
