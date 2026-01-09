# 🚀 Getting Started - UbiGrowth Marketing Hub

**Date:** 2026-01-08  
**Status:** ✅ All APIs Configured - Ready to Build!

---

## 🎉 **You're Ready to Go!**

All your API keys are configured and your first AI agent is deployed!

### ✅ **What's Deployed:**

1. **`test-openai`** - Test OpenAI API connection
2. **`qualify-lead`** - AI-powered lead qualification agent ⭐

---

## 🧪 **Test Your Lead Qualification Agent**

### **Quick Test:**

```powershell
# Run the test script
.\test-lead-qualification.ps1
```

This will test 3 different lead scenarios:
- ✅ High-quality enterprise lead (should score 8-10)
- ✅ Medium-quality startup lead (should score 5-7)
- ✅ Low-quality/incomplete lead (should score 1-4)

### **Or Test Manually:**

**Get your anon key from:**  
https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/settings/api

**Then use PowerShell:**

```powershell
$ANON_KEY = "your_anon_key_here"

$lead = @{
    name = "Jane Smith"
    company = "Tech Corp"
    email = "jane@techcorp.com"
    title = "Marketing Director"
    budget = "$25,000"
    timeline = "This quarter"
    notes = "Interested in our platform, has budget approved"
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "https://ddwqkkiqgjptguzoeohr.supabase.co/functions/v1/qualify-lead" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $ANON_KEY"
        "Content-Type" = "application/json"
    } `
    -Body $lead | ConvertTo-Json -Depth 5
```

---

## 📊 **What the Agent Returns:**

```json
{
  "success": true,
  "qualification": {
    "score": 8,
    "quality": "hot",
    "reasoning": "Strong signals: VP-level contact, clear budget, immediate timeline",
    "recommended_action": "immediate_outreach",
    "priority": "high",
    "next_steps": "Schedule discovery call within 24 hours",
    "estimated_value": "high",
    "signals": {
      "positive": ["Decision maker", "Budget approved", "Urgent timeline"],
      "negative": [],
      "missing": ["Company size", "Current solution"]
    }
  },
  "tokens_used": {
    "prompt_tokens": 234,
    "completion_tokens": 156,
    "total_tokens": 390
  }
}
```

---

## 🔗 **How to Use This in Your App:**

### **JavaScript/TypeScript:**

```typescript
async function qualifyLead(leadData) {
  const response = await fetch(
    'https://ddwqkkiqgjptguzoeohr.supabase.co/functions/v1/qualify-lead',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(leadData)
    }
  )
  
  const result = await response.json()
  
  // Route based on score
  if (result.qualification.score >= 8) {
    // High priority - immediate outreach
    await scheduleCall(leadData)
  } else if (result.qualification.score >= 5) {
    // Medium priority - nurture campaign
    await addToNurtureCampaign(leadData)
  } else {
    // Low priority - generic drip
    await addToDripCampaign(leadData)
  }
  
  return result
}
```

### **From Your Database Trigger:**

```sql
-- Automatically qualify new leads
CREATE OR REPLACE FUNCTION auto_qualify_new_lead()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the edge function
  PERFORM
    net.http_post(
      url := 'https://ddwqkkiqgjptguzoeohr.supabase.co/functions/v1/qualify-lead',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
      ),
      body := jsonb_build_object(
        'name', NEW.name,
        'email', NEW.email,
        'company', NEW.company,
        'notes', NEW.notes
      )
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on new lead insert
CREATE TRIGGER qualify_lead_on_insert
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_qualify_new_lead();
```

---

## 🚀 **What to Build Next:**

### **Option 1: Campaign Content Generator**
Generate personalized email/SMS content automatically.

**Deploy:**
```powershell
# Create the function (I have the code ready)
supabase functions deploy generate-campaign-content
```

### **Option 2: Appointment Scheduler Agent**
Build in Agent Builder: https://platform.openai.com/agent-builder

**Workflow:**
1. Parse scheduling request
2. Check calendar availability
3. Propose times
4. Confirm booking
5. Send notifications

### **Option 3: Voice Calling Setup**
Configure ElevenLabs for AI appointment calling.

**Steps:**
1. Go to https://elevenlabs.io/app/agents
2. Create appointment scheduling agent
3. Configure phone number
4. Test calls

### **Option 4: Lead Enrichment Pipeline**
Auto-enrich lead data from multiple sources.

**Features:**
- Email validation
- Company lookup
- Social profiles
- Contact info

---

## 📚 **Documentation Quick Links:**

| Guide | Purpose |
|-------|---------|
| [API_KEYS_MASTER_CHECKLIST.md](./API_KEYS_MASTER_CHECKLIST.md) | Complete setup overview |
| [OPENAI_SDK_REFERENCE.md](./OPENAI_SDK_REFERENCE.md) | SDK usage & examples |
| [AGENT_BUILDER_GUIDE.md](./AGENT_BUILDER_GUIDE.md) | Build visual workflows |
| [OPENAI_INTEGRATION_GUIDE.md](./OPENAI_INTEGRATION_GUIDE.md) | Implementation patterns |

---

## 🎯 **Next Steps:**

1. ✅ **Test the lead qualification agent** (`.\test-lead-qualification.ps1`)
2. 🏗️ **Integrate into your lead capture form**
3. 🤖 **Build an agent in Agent Builder**
4. 📧 **Deploy campaign content generator**
5. 📞 **Set up voice calling**

---

## 🆘 **Need Help?**

**Check Logs:**
- Dashboard: https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/functions
- Click on function → View Logs

**Common Issues:**
- **401 Unauthorized**: Check anon key from API settings
- **500 Error**: Check function logs in dashboard
- **Timeout**: Increase function timeout in settings

**Resources:**
- OpenAI Platform: https://platform.openai.com/
- Supabase Docs: https://supabase.com/docs
- Agent Builder: https://platform.openai.com/agent-builder

---

## 💰 **Cost Tracking:**

**Current Usage:**
- Lead qualification: ~$0.01-0.02 per lead
- 1,000 leads/month ≈ $10-20

**Monitor:**
- OpenAI: https://platform.openai.com/usage
- Supabase: https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/settings/billing

---

**🎉 Congratulations! Your AI-powered marketing platform is live!**

*Last updated: 2026-01-08*
