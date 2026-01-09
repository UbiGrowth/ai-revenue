# 🤖 OpenAI GPT Integration Guide - UbiGrowth Marketing Hub

**Date:** 2026-01-08  
**Project:** ddwqkkiqgjptguzoeohr

---

## 🎯 Use Cases for OpenAI in Your Platform

### **1. Campaign Content Generation**
Auto-generate personalized email, SMS, and social media content for campaigns.

### **2. Lead Intelligence**
Extract structured data from unstructured lead information, score leads, and suggest actions.

### **3. AI Chat Assistant**
Provide real-time support to tenants and answer questions about the platform.

### **4. Dynamic Personalization**
Customize messaging for each lead based on their profile and behavior.

### **5. Sentiment Analysis**
Analyze lead responses and engagement to optimize follow-up strategies.

### **6. Agent Workflows (NEW!)** ⭐
Build multi-step agents using **Agent Builder**:
- Lead qualification workflows
- Appointment scheduling agents
- Campaign automation agents
- Customer support agents
- Data enrichment pipelines

---

## 📦 SDK Installation & Setup

### **For Supabase Edge Functions (Deno)**

Supabase uses Deno, so you can import the OpenAI SDK directly:

```typescript
import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts"
```

**Or use npm specifier (recommended):**

```typescript
import OpenAI from "npm:openai@^4.20.1"
```

### **For Local Development (Node.js/TypeScript)**

If testing locally with Node.js:

```bash
npm install openai
```

Then import:

```typescript
import OpenAI from "openai"
```

### **Environment Variable Setup**

```powershell
# Windows PowerShell
$env:OPENAI_API_KEY="sk-your_key_here"

# Or set permanently
setx OPENAI_API_KEY "sk-your_key_here"
```

```bash
# macOS/Linux
export OPENAI_API_KEY="sk-your_key_here"

# Add to ~/.zshrc or ~/.bashrc for permanence
echo 'export OPENAI_API_KEY="sk-your_key_here"' >> ~/.zshrc
```

---

## 🔧 Implementation Examples

### **1. Campaign Content Generator (Edge Function)**

```typescript
// supabase/functions/generate-campaign-content/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import OpenAI from "npm:openai@^4.20.1"

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

serve(async (req) => {
  try {
    const { campaign_type, target_audience, product, tone } = await req.json()
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert marketing copywriter specializing in B2B campaigns.'
        },
        {
          role: 'user',
          content: `Generate ${campaign_type} content for ${target_audience} about ${product}. Tone: ${tone}. Include subject line and body (max 150 words).`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
    
    return new Response(
      JSON.stringify({ 
        content: completion.choices[0].message.content,
        usage: completion.usage 
      }),
      { headers: { "Content-Type": "application/json" } }
    )
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
```

**Usage:**
```javascript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/generate-campaign-content`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      campaign_type: 'email',
      target_audience: 'SaaS founders',
      product: 'Marketing automation platform',
      tone: 'professional and friendly'
    })
  }
)

const { content } = await response.json()
```

---

### **2. Lead Data Extraction with Structured Output**

```typescript
// supabase/functions/extract-lead-data/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import OpenAI from "npm:openai@^4.20.1"

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

serve(async (req) => {
  try {
    const { raw_lead_info } = await req.json()
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Extract structured data from lead information. Return valid JSON with fields: name, company, title, email, phone, interest_level (1-10), budget_range, timeline.'
        },
        {
          role: 'user',
          content: raw_lead_info
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    })
    
    const leadData = JSON.parse(completion.choices[0].message.content)
    
    return new Response(
      JSON.stringify({ lead: leadData, usage: completion.usage }),
      { headers: { "Content-Type": "application/json" } }
    )
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
```

**Usage:**
```javascript
const rawInfo = "John Doe from Acme Corp reached out. He's the VP of Sales, email: john@acme.com, mentioned they have $10k/month budget and want to start in Q2. Very interested!"

const response = await fetch(
  `${SUPABASE_URL}/functions/v1/extract-lead-data`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw_lead_info: rawInfo })
  }
)

const { lead } = await response.json()
// Returns: { name: "John Doe", company: "Acme Corp", title: "VP of Sales", ... }
```

---

### **3. Personalized Message Generator**

```typescript
// supabase/functions/personalize-message/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import OpenAI from "npm:openai@^4.20.1"

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

serve(async (req) => {
  try {
    const { lead_profile, message_template, previous_interactions } = await req.json()
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a personalization expert. Customize the message template based on the lead profile and interaction history. Keep the core message but make it personal and relevant.'
        },
        {
          role: 'user',
          content: `
Lead Profile: ${JSON.stringify(lead_profile)}
Previous Interactions: ${JSON.stringify(previous_interactions)}
Template: ${message_template}

Create a personalized version that:
1. References their specific situation
2. Addresses their pain points
3. Includes relevant details from their profile
4. Maintains professional tone
`
        }
      ],
      temperature: 0.8,
      max_tokens: 400
    })
    
    return new Response(
      JSON.stringify({ 
        personalized_message: completion.choices[0].message.content,
        usage: completion.usage 
      }),
      { headers: { "Content-Type": "application/json" } }
    )
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
```

---

### **4. AI Chat Assistant for Tenants**

```typescript
// supabase/functions/chat-assistant/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import OpenAI from "npm:openai@^4.20.1"

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

serve(async (req) => {
  try {
    const { user_message, conversation_history, user_context } = await req.json()
    
    const messages = [
      {
        role: 'system',
        content: `You are a helpful assistant for the UbiGrowth Marketing Hub platform. 
        
Available features:
- Campaign management (email, SMS, voice)
- Lead tracking and scoring
- Appointment scheduling
- Analytics and reporting

User context: ${JSON.stringify(user_context)}

Provide helpful, accurate answers about the platform. If you don't know, say so.`
      },
      ...conversation_history,
      {
        role: 'user',
        content: user_message
      }
    ]
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    })
    
    return new Response(
      JSON.stringify({ 
        assistant_message: completion.choices[0].message.content,
        usage: completion.usage 
      }),
      { headers: { "Content-Type": "application/json" } }
    )
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
```

---

### **5. Batch Content Generation (Cost Optimization)**

For generating multiple pieces of content at once (like 100 email variations), use OpenAI's Batch API for **50% cost reduction**:

```typescript
// supabase/functions/batch-generate-content/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

serve(async (req) => {
  try {
    const { leads } = await req.json()
    
    // Create batch requests
    const batchRequests = leads.map((lead, idx) => ({
      custom_id: `lead-${lead.id}`,
      method: "POST",
      url: "/v1/chat/completions",
      body: {
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `Write a personalized email for ${lead.name} at ${lead.company} about our ${lead.interest} solution.`
        }],
        max_tokens: 300
      }
    }))
    
    // Submit batch
    const response = await fetch('https://api.openai.com/v1/batches', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input_file_id: await uploadBatchFile(batchRequests),
        endpoint: "/v1/chat/completions",
        completion_window: "24h"
      })
    })
    
    const batch = await response.json()
    
    return new Response(
      JSON.stringify({ batch_id: batch.id, status: batch.status }),
      { headers: { "Content-Type": "application/json" } }
    )
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
```

**Cost Savings:**
- Regular: $0.15/1M input tokens
- Batch API: **$0.075/1M input tokens** (50% off!)

---

## 💰 Cost Optimization Strategies

### **1. Choose the Right Model**

| Model | Cost | Best For |
|-------|------|----------|
| **gpt-4o-mini** | $0.15/$0.60 per 1M tokens | ⭐ Most tasks (recommended) |
| **gpt-4o** | $2.50/$10 per 1M tokens | Complex reasoning |
| **gpt-3.5-turbo** | $0.50/$1.50 per 1M tokens | Simple, fast tasks |

**Recommendation:** Start with `gpt-4o-mini` for 99% of use cases.

### **2. Use Prompt Caching**

Cache system prompts to reduce costs by up to 50%:

```typescript
{
  model: 'gpt-4o-mini',
  messages: [
    {
      role: 'system',
      content: 'Your long system prompt here...'  // This gets cached!
    },
    {
      role: 'user',
      content: 'Variable user content'
    }
  ]
}
```

### **3. Use Batch API for Bulk Operations**

50% cost reduction for non-real-time tasks:
- Generating 100+ email variations
- Bulk lead scoring
- Nightly data enrichment

### **4. Set Token Limits**

Control costs with `max_tokens`:

```typescript
{
  model: 'gpt-4o-mini',
  messages: [...],
  max_tokens: 150  // Limit response length
}
```

### **5. Use Streaming for Better UX**

Stream responses to show progress:

```typescript
{
  model: 'gpt-4o-mini',
  messages: [...],
  stream: true  // Stream response chunks
}
```

---

## 📊 Cost Estimation Examples

### **Scenario 1: Campaign Content Generation**
- 1,000 emails/month
- ~300 tokens per email (input + output)
- Model: gpt-4o-mini
- **Cost: ~$0.23/month**

### **Scenario 2: AI Chat Assistant**
- 5,000 conversations/month
- ~500 tokens per conversation
- Model: gpt-4o-mini
- **Cost: ~$0.375/month**

### **Scenario 3: Lead Intelligence (Batch)**
- 10,000 leads/month analyzed
- ~200 tokens per lead
- Using Batch API (50% off)
- **Cost: ~$0.15/month**

**Total estimated: ~$0.76/month for all three!**

---

## 🔒 Security Best Practices

1. **Never expose API key in client-side code**
2. **Use Supabase Edge Functions** for all OpenAI calls
3. **Implement rate limiting** to prevent abuse
4. **Set up usage alerts** in OpenAI dashboard
5. **Use environment variables** for API keys

---

## 🧪 Testing

### **Test in Supabase SQL:**

```sql
-- Test content generation
SELECT extensions.http_post(
  'https://api.openai.com/v1/chat/completions',
  jsonb_build_object(
    'model', 'gpt-4o-mini',
    'messages', jsonb_build_array(
      jsonb_build_object(
        'role', 'user',
        'content', 'Write a short marketing email about our new feature'
      )
    ),
    'max_tokens', 200
  ),
  'application/json',
  ARRAY[
    ('Authorization', 'Bearer ' || current_setting('app.settings.openai_api_key', true))::http_header
  ]
);
```

---

## 📚 Useful Resources

**OpenAI Documentation:**
- API Reference: https://platform.openai.com/docs/api-reference
- Best Practices: https://platform.openai.com/docs/guides/production-best-practices
- Model Pricing: https://openai.com/pricing

**Dashboard Links:**
- API Keys: https://platform.openai.com/api-keys
- Usage Tracking: https://platform.openai.com/usage
- Rate Limits: https://platform.openai.com/account/rate-limits

---

## 🚀 Next Steps

1. ✅ Get your OpenAI API key
2. ✅ Set it in Supabase secrets
3. ✅ Deploy one of the edge functions above
4. ✅ Test with your first campaign
5. ✅ Monitor usage and optimize

---

*Generated: 2026-01-08*  
*OpenAI Integration Guide for UbiGrowth Marketing Hub*
