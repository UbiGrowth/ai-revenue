# 🤖 OpenAI Agent Builder Guide - UbiGrowth Marketing Hub

**Date:** 2026-01-08  
**Project:** ddwqkkiqgjptguzoeohr

---

## 🎯 What is Agent Builder?

**Agent Builder** is OpenAI's visual workflow designer for creating multi-step AI agents. Think of it as a no-code/low-code way to build complex agent workflows that you can then deploy in your platform.

**Key Features:**
- ✅ **Visual Design** - Drag-and-drop nodes to build workflows
- ✅ **Live Testing** - Preview and debug with real data
- ✅ **Templates** - Start from pre-built patterns
- ✅ **Version Control** - Publish and manage workflow versions
- ✅ **Easy Deploy** - Export to ChatKit or download SDK code

**Access Agent Builder:** https://platform.openai.com/agent-builder

---

## 🏗️ Agent Workflows for Your Platform

Here are the key agent workflows you should build for your marketing platform:

### **1. Lead Qualification Agent**
**Purpose:** Automatically qualify and score incoming leads

**Workflow Steps:**
1. **Input Node** - Receive lead data (name, company, contact info)
2. **Data Enrichment Agent** - Look up company info, validate email
3. **Scoring Agent** - Analyze lead quality (1-10 score)
4. **Routing Node** - Route to appropriate follow-up:
   - High score (8-10) → Immediate outreach
   - Medium score (5-7) → Nurture campaign
   - Low score (1-4) → Generic drip campaign
5. **Output Node** - Return qualified lead with score and next action

**Template to Start:** "Customer Support Router"

---

### **2. Appointment Scheduling Agent**
**Purpose:** Handle appointment booking requests via chat or voice

**Workflow Steps:**
1. **Input Node** - Receive scheduling request
2. **Intent Detection Agent** - Understand what they want:
   - Book new appointment
   - Reschedule existing
   - Cancel appointment
3. **Availability Check Tool** - Query calendar for open slots
4. **Confirmation Agent** - Verify details with lead
5. **Booking Tool** - Create appointment in database
6. **Notification Agent** - Send confirmation email/SMS
7. **Output Node** - Return booking confirmation

**Template to Start:** "Task Handler"

---

### **3. Campaign Content Generator Agent**
**Purpose:** Generate personalized multi-channel campaign content

**Workflow Steps:**
1. **Input Node** - Campaign parameters (audience, product, tone, channels)
2. **Research Agent** - Analyze target audience data
3. **Email Content Agent** - Generate email subject + body
4. **SMS Content Agent** - Generate concise SMS version
5. **Social Media Agent** - Create social media posts
6. **Review Node** - Quality check all content
7. **Output Node** - Return complete campaign package

**Template to Start:** "Content Generation Pipeline"

---

### **4. Lead Nurture Agent**
**Purpose:** Intelligent multi-touch lead nurturing

**Workflow Steps:**
1. **Input Node** - Lead profile + engagement history
2. **Behavior Analysis Agent** - Analyze past interactions
3. **Content Selection Agent** - Choose relevant content
4. **Personalization Agent** - Customize message
5. **Channel Selection Node** - Pick best channel (email/SMS/call)
6. **Timing Optimizer Agent** - Determine optimal send time
7. **Scheduling Tool** - Queue message for delivery
8. **Output Node** - Return scheduled nurture action

**Template to Start:** "Homework Helper" (adapt for lead nurture)

---

### **5. Customer Support Agent**
**Purpose:** Handle tenant support questions about the platform

**Workflow Steps:**
1. **Input Node** - User question
2. **Intent Classification Agent** - Categorize question:
   - Campaign management
   - Lead tracking
   - Billing/subscription
   - Technical issue
3. **Knowledge Base Tool** - Search documentation
4. **Answer Generation Agent** - Craft helpful response
5. **Escalation Node** - If can't answer, route to human
6. **Output Node** - Return answer or escalation ticket

**Template to Start:** "Customer Support Router"

---

### **6. Data Enrichment Pipeline Agent**
**Purpose:** Enrich lead data from multiple sources

**Workflow Steps:**
1. **Input Node** - Basic lead info (name, company, email)
2. **Email Validation Tool** - Verify email is valid
3. **Company Lookup Agent** - Get company details (size, industry, revenue)
4. **Social Profile Agent** - Find LinkedIn/Twitter profiles
5. **Contact Info Agent** - Find phone number
6. **Scoring Agent** - Calculate enrichment confidence score
7. **Database Update Tool** - Save enriched data
8. **Output Node** - Return complete lead profile

**Template to Start:** "Research Assistant"

---

## 🎨 How to Build an Agent Workflow

### **Step 1: Design in Agent Builder**

1. Go to https://platform.openai.com/agent-builder
2. Click "New Workflow" or choose a template
3. Drag nodes from the sidebar:
   - **Agent nodes** - AI reasoning and decision-making
   - **Tool nodes** - External API calls, database queries
   - **Control flow nodes** - Routing, conditionals, loops
   - **Input/Output nodes** - Data entry and exit points

4. Connect nodes by dragging between them
5. Configure each node:
   - Set instructions for agents
   - Define tool parameters
   - Specify input/output schemas

### **Step 2: Preview & Debug**

1. Click "Preview" in the top navigation
2. Enter test data
3. Watch the workflow execute step-by-step
4. Check node outputs and debug issues
5. Iterate until it works correctly

### **Step 3: Evaluate**

1. Click "Evaluate" in the top navigation
2. Run trace graders to assess performance:
   - Accuracy
   - Response quality
   - Completion rate
   - Latency
3. Optimize based on results

### **Step 4: Publish**

1. Click "Publish" to create a version
2. Your workflow gets an ID (e.g., `wkfl_abc123`)
3. This creates a snapshot you can deploy

### **Step 5: Deploy**

**Option A: ChatKit (Recommended)**
Embed the workflow as a chat interface:

```html
<!-- In your frontend -->
<script src="https://cdn.openai.com/chatkit/latest/chatkit.min.js"></script>
<script>
  ChatKit.init({
    apiKey: 'YOUR_OPENAI_API_KEY',
    workflowId: 'wkfl_abc123', // Your published workflow ID
    container: '#chat-container'
  });
</script>

<div id="chat-container"></div>
```

**Option B: SDK Code**
Download and customize:

```typescript
// Downloaded from Agent Builder
import { AgentsSDK } from '@openai/agents-sdk';

const agent = new AgentsSDK({
  apiKey: process.env.OPENAI_API_KEY,
  workflowId: 'wkfl_abc123'
});

const result = await agent.run({
  input: {
    leadName: 'John Doe',
    company: 'Acme Corp',
    email: 'john@acme.com'
  }
});

console.log(result);
```

---

## 🔧 Integration with Supabase

Here's how to integrate Agent Builder workflows into your Supabase backend:

### **Edge Function: Run Agent Workflow**

```typescript
// supabase/functions/run-agent-workflow/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

serve(async (req) => {
  try {
    const { workflow_id, input_data } = await req.json()
    
    // Run the published workflow
    const response = await fetch('https://api.openai.com/v1/workflows/runs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflow_id: workflow_id,
        input: input_data
      })
    })
    
    const result = await response.json()
    
    return new Response(
      JSON.stringify({ 
        run_id: result.id,
        status: result.status,
        output: result.output 
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

### **Example: Qualify Lead Using Agent**

```typescript
// In your application code
async function qualifyLead(leadData) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/run-agent-workflow`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workflow_id: 'wkfl_lead_qualification_v1',
        input_data: {
          name: leadData.name,
          company: leadData.company,
          email: leadData.email,
          source: leadData.source,
          notes: leadData.notes
        }
      })
    }
  )
  
  const result = await response.json()
  
  // Result contains:
  // - score (1-10)
  // - qualification_reason
  // - recommended_action
  // - next_steps
  
  return result.output
}
```

---

## 📊 Example Workflows

### **Lead Qualification Workflow (Visual)**

```
┌─────────────┐
│ Input Lead  │
│   Data      │
└──────┬──────┘
       │
       v
┌─────────────┐
│  Validate   │
│   Email     │ (Tool)
└──────┬──────┘
       │
       v
┌─────────────┐
│   Enrich    │
│  Company    │ (Agent)
└──────┬──────┘
       │
       v
┌─────────────┐
│   Score     │
│    Lead     │ (Agent)
└──────┬──────┘
       │
       v
┌─────────────┐
│  Route by   │
│    Score    │ (Conditional)
└──┬────┬────┬┘
   │    │    │
   v    v    v
High  Med  Low
   │    │    │
   v    v    v
┌─────────────┐
│   Output    │
│   Action    │
└─────────────┘
```

### **Appointment Scheduling Workflow (Visual)**

```
┌─────────────┐
│   User      │
│  Request    │
└──────┬──────┘
       │
       v
┌─────────────┐
│   Parse     │
│   Intent    │ (Agent)
└──────┬──────┘
       │
       v
┌─────────────┐
│   Check     │
│ Availability│ (Tool: Calendar API)
└──────┬──────┘
       │
       v
┌─────────────┐
│  Propose    │
│   Times     │ (Agent)
└──────┬──────┘
       │
       v
┌─────────────┐
│   Get       │
│Confirmation │ (Agent)
└──────┬──────┘
       │
       v
┌─────────────┐
│   Book      │
│Appointment  │ (Tool: Database)
└──────┬──────┘
       │
       v
┌─────────────┐
│    Send     │
│Confirmation │ (Tool: Email/SMS)
└──────┬──────┘
       │
       v
┌─────────────┐
│   Output    │
│   Success   │
└─────────────┘
```

---

## 💰 Cost Considerations

**Agent Builder is free to use**, but running workflows costs based on:

1. **Model calls** - Each agent node uses GPT-4o/GPT-4o-mini
2. **Tool calls** - Function calling overhead
3. **Input/Output tokens** - Data passed between nodes

**Typical Costs:**
- Simple workflow (3-5 nodes): ~$0.01-0.05 per run
- Complex workflow (10+ nodes): ~$0.10-0.30 per run

**Optimization Tips:**
- Use GPT-4o-mini for simple agent nodes
- Cache common responses
- Batch similar requests
- Set token limits on agents

---

## 🔒 Security & Safety

Agent Builder includes safety features:

1. **Input Validation** - Sanitize all inputs
2. **Output Filtering** - Block sensitive data
3. **Rate Limiting** - Prevent abuse
4. **Prompt Injection Protection** - Built-in safeguards
5. **Data Isolation** - Tenant data stays separate

**Best Practices:**
- Never pass raw user input directly to agents
- Validate all tool outputs before using
- Use structured outputs when possible
- Implement human-in-the-loop for critical actions
- Monitor agent behavior regularly

---

## 📚 Node Reference

**Agent Nodes:**
- **GPT Agent** - General reasoning and decision-making
- **Specialized Agent** - Task-specific agents (research, writing, analysis)

**Tool Nodes:**
- **HTTP Request** - Call external APIs
- **Database Query** - Query your Supabase database
- **File Upload** - Handle file attachments
- **Email/SMS** - Send notifications

**Control Flow:**
- **Conditional** - If/else routing
- **Loop** - Iterate over items
- **Parallel** - Run multiple branches simultaneously
- **Merge** - Combine results from multiple branches

**Data Nodes:**
- **Input** - Define workflow inputs
- **Output** - Define workflow outputs
- **Transform** - Map/filter/reduce data

---

## 🚀 Next Steps

1. **Explore Agent Builder:** https://platform.openai.com/agent-builder
2. **Start with a template** (Customer Support Router)
3. **Build your first workflow** (Lead Qualification)
4. **Test thoroughly** with real data
5. **Publish and deploy** to your platform
6. **Monitor and optimize** based on usage

---

## 📖 Useful Resources

- **Agent Builder:** https://platform.openai.com/agent-builder
- **ChatKit Docs:** https://platform.openai.com/docs/guides/chatkit
- **Agents SDK:** https://platform.openai.com/docs/guides/custom-chatkit
- **Node Reference:** https://platform.openai.com/docs/guides/node-reference
- **Safety Guide:** https://platform.openai.com/docs/guides/agent-builder-safety

---

*Generated: 2026-01-08*  
*Agent Builder Guide for UbiGrowth Marketing Hub*
