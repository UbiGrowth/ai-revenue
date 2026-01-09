# 🤖 Zero-Config Voice Agents System

**Date:** 2026-01-08  
**Goal:** Automatically create ElevenLabs agents for customers - no manual setup required!

---

## 🎯 **The Problem We Solved:**

**Before:**
1. Customer signs up
2. Goes to Voice Agents page
3. Sees "No agents configured"
4. Has to manually create agents in ElevenLabs dashboard
5. Copy agent IDs back to your platform
6. **Too many steps!** 😓

**After (Zero-Config):**
1. Customer signs up
2. Goes to Voice Agents page
3. **Agents automatically created!** ✨
4. Ready to make calls immediately!
5. **Zero manual steps!** 🎉

---

## 🏗️ **How It Works:**

### **Architecture:**

```
Customer Opens Voice Agents Page
    ↓
Check: Does this workspace have agents?
    ↓
NO → Auto-create 3 default agents via ElevenLabs API
    ├── Sales Outreach Agent
    ├── Lead Qualifier Agent
    └── Appointment Setter Agent
    ↓
YES → Show existing agents
    ↓
Customer can start calling immediately!
```

### **Components:**

1. **`elevenlabs-create-agent`** - Creates a single agent with smart defaults
2. **`elevenlabs-auto-provision`** - Auto-creates 3 agents for new workspaces
3. **`voice_agents` table** - Tracks agents per workspace
4. **Voice Agents UI** - Automatically triggers provisioning on first load

---

## 📋 **Default Agents Created:**

### **1. Sales Outreach Agent**
```json
{
  "name": "[Customer Company] Sales Agent",
  "first_message": "Hi! I'm calling from [Company]. Do you have a quick moment to chat about how we can help your business?",
  "use_case": "sales_outreach",
  "goal": "Introduce value proposition, qualify lead, book meeting"
}
```

### **2. Lead Qualification Agent**
```json
{
  "name": "[Customer Company] Lead Qualifier",
  "first_message": "Hi! I'm calling from [Company]. I wanted to see if we might be a good fit. Do you have a moment?",
  "use_case": "lead_qualification",
  "goal": "Determine fit, ask qualifying questions, score lead"
}
```

### **3. Appointment Setting Agent**
```json
{
  "name": "[Customer Company] Appointment Setter",
  "first_message": "Hi! I'm calling from [Company] to help schedule your appointment. Is now a good time?",
  "use_case": "appointment_setting",
  "goal": "Confirm availability, find time slot, book appointment"
}
```

---

## 🎨 **Smart Personalization:**

### **Agents Are Customized Based On:**

1. **Workspace Name:**
   - Uses actual company name: "Acme Corp Sales Agent"
   - Not generic: ✅ Personal, ❌ Generic

2. **Brand Voice (if configured):**
   - Reads from `ai_settings_brand` table
   - Applies brand tone: "professional and friendly" vs "casual and fun"

3. **Industry (future):**
   - Can customize scripts for SaaS, Real Estate, etc.
   - Industry-specific qualification questions

4. **Use Case:**
   - Pre-configured templates for common scenarios
   - Optimized prompts for each goal

---

## 🔧 **API Endpoints:**

### **1. Create Single Agent**

```typescript
POST /functions/v1/elevenlabs-create-agent

Body:
{
  "workspace_id": "uuid",
  "name": "My Custom Agent",           // Optional - uses smart default
  "first_message": "Custom greeting",  // Optional - uses template
  "system_prompt": "Custom prompt",    // Optional - uses template
  "voice_id": "voice_id",              // Optional - uses default voice
  "use_case": "sales_outreach",        // Optional - default
  "language": "en"                     // Optional - default
}

Response:
{
  "success": true,
  "agent_id": "elevenlabs_agent_id",
  "name": "My Custom Agent",
  "message": "Agent created successfully"
}
```

### **2. Auto-Provision All Agents**

```typescript
POST /functions/v1/elevenlabs-auto-provision

Body:
{
  "workspace_id": "uuid"
}

Response:
{
  "success": true,
  "message": "Created 3 out of 3 agents",
  "agents": [
    { "agent_id": "...", "name": "Sales Agent", "use_case": "sales_outreach" },
    { "agent_id": "...", "name": "Lead Qualifier", "use_case": "lead_qualification" },
    { "agent_id": "...", "name": "Appointment Setter", "use_case": "appointment_setting" }
  ]
}
```

---

## 🎬 **Implementation Steps:**

### **Step 1: Deploy Functions & Migration**

```powershell
cd "C:\Users\bill\.cursor\ubigrowth-marketing-hub"

# Deploy new functions
supabase functions deploy elevenlabs-create-agent elevenlabs-auto-provision

# Run migration to create voice_agents table
supabase db push
```

### **Step 2: Update Voice Agents UI**

Add auto-provisioning on page load:

```typescript
// In VoiceAgents.tsx
useEffect(() => {
  if (workspaceId) {
    // Check if agents exist, auto-create if not
    autoProvisionAgents();
  }
}, [workspaceId]);

const autoProvisionAgents = async () => {
  const { data } = await supabase
    .from('voice_agents')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');
  
  if (!data || data.length === 0) {
    // No agents - auto-create them!
    await supabase.functions.invoke('elevenlabs-auto-provision', {
      body: { workspace_id: workspaceId }
    });
    
    // Refresh UI
    fetchAllData();
  }
};
```

### **Step 3: Test It!**

1. Open Voice Agents page as a new workspace
2. Watch agents auto-create in real-time
3. Agents appear instantly - ready to call!

---

## 💡 **Use Case Templates:**

### **Built-in Templates:**

```typescript
const USE_CASE_TEMPLATES = {
  sales_outreach: { ... },       // Cold calling, demos
  customer_support: { ... },     // Help desk, troubleshooting
  appointment_setting: { ... },  // Booking, scheduling
  lead_qualification: { ... },   // BANT, scoring
}
```

### **Add Custom Templates:**

```typescript
// In elevenlabs-create-agent/index.ts
collection_calls: {
  default_name: `${brandName} Collections Agent`,
  default_first_message: `Hi, this is [Name] from ${brandName} regarding your account. Do you have a moment?`,
  default_prompt: `You are a professional collections agent...`,
}
```

---

## 🔐 **Security & Workspace Isolation:**

### **Row-Level Security (RLS):**
```sql
-- Users can only see agents in their workspace
CREATE POLICY "Users can view their workspace agents"
  ON voice_agents FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );
```

### **Guaranteed Isolation:**
- ✅ Each workspace has separate agents
- ✅ Agents are tied to workspace_id
- ✅ RLS enforces access control
- ✅ Agent IDs are unique per workspace

---

## 📊 **Customer Experience:**

### **First Visit (No Agents):**
```
Loading... 
  → Checking for agents...
  → No agents found
  → Creating 3 default agents...
  → ✅ Agents ready!
Total time: ~3-5 seconds
```

### **Subsequent Visits:**
```
Loading...
  → Agents found
  → ✅ Display agents
Total time: ~500ms
```

---

## 🎯 **Benefits:**

1. **Zero Manual Setup** ✨
   - No ElevenLabs dashboard required
   - No agent ID copying
   - No configuration needed

2. **Instant Productivity** 🚀
   - Agents ready in seconds
   - Start calling immediately
   - No learning curve

3. **Smart Defaults** 🧠
   - Pre-optimized prompts
   - Professional voices
   - Industry best practices

4. **Fully Customizable** 🎨
   - Customers can edit later
   - Add more agents
   - Change voices/prompts

5. **Cost Efficient** 💰
   - Only create what's needed
   - No wasted agent slots
   - Scale per workspace

---

## 🔄 **Future Enhancements:**

### **Phase 2:**
- [ ] **AI-Generated Prompts** - Use OpenAI to generate custom prompts based on customer's industry
- [ ] **Voice Selection UI** - Let customers choose voice during onboarding
- [ ] **Multi-Language Support** - Auto-detect customer language preference
- [ ] **A/B Testing** - Create variant agents automatically
- [ ] **Performance Optimization** - Learn from call data, improve prompts

### **Phase 3:**
- [ ] **Agent Marketplace** - Pre-built agents for specific industries
- [ ] **Clone Best Performers** - Auto-clone high-performing agents
- [ ] **Voice Cloning** - Use customer's voice for agents
- [ ] **Dynamic Pricing** - Tiered agent capabilities

---

## 🧪 **Testing:**

### **Test Auto-Provisioning:**

```powershell
# Create test workspace
$workspaceId = "test-workspace-123"

# Trigger auto-provision
Invoke-RestMethod `
  -Uri "https://ddwqkkiqgjptguzoeohr.supabase.co/functions/v1/elevenlabs-auto-provision" `
  -Method POST `
  -Headers @{
    "Authorization" = "Bearer YOUR_TOKEN"
    "Content-Type" = "application/json"
  } `
  -Body (@{ workspace_id = $workspaceId } | ConvertTo-Json)

# Expected: 3 agents created
```

### **Test Single Agent Creation:**

```powershell
# Create custom agent
Invoke-RestMethod `
  -Uri "https://ddwqkkiqgjptguzoeohr.supabase.co/functions/v1/elevenlabs-create-agent" `
  -Method POST `
  -Headers @{
    "Authorization" = "Bearer YOUR_TOKEN"
    "Content-Type" = "application/json"
  } `
  -Body (@{
    workspace_id = $workspaceId
    name = "Custom Sales Agent"
    use_case = "sales_outreach"
  } | ConvertTo-Json)

# Expected: 1 agent created
```

---

## 📚 **Database Schema:**

```sql
voice_agents
  ├── id (UUID)
  ├── workspace_id (UUID) → workspaces
  ├── provider (TEXT) → 'elevenlabs'
  ├── agent_id (TEXT) → ElevenLabs agent ID
  ├── name (TEXT)
  ├── use_case (TEXT)
  ├── config (JSONB)
  ├── status (TEXT) → 'active', 'inactive', 'deleted'
  ├── created_at (TIMESTAMPTZ)
  └── updated_at (TIMESTAMPTZ)
```

---

## ✅ **Deployment Checklist:**

- [ ] Deploy `elevenlabs-create-agent` function
- [ ] Deploy `elevenlabs-auto-provision` function
- [ ] Run database migration (create `voice_agents` table)
- [ ] Update Voice Agents UI to trigger auto-provisioning
- [ ] Test with new workspace
- [ ] Test with existing workspace (should skip)
- [ ] Verify RLS policies
- [ ] Document for customers

---

## 🎉 **Result:**

**Your customers will never need to touch ElevenLabs!**

- ✅ Sign up
- ✅ Go to Voice Agents
- ✅ Agents are ready
- ✅ Start calling

**That's it!** Zero configuration, maximum simplicity.

---

*Last updated: 2026-01-08*  
*Status: Ready to deploy - Zero-config voice agents system*
