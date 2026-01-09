# 🤖 CONFIGURE AI & VIDEO API KEYS - EXTENDED SETUP

**Status:** Needs Configuration  
**Date:** 2026-01-08  
**Project:** ddwqkkiqgjptguzoeohr

---

## 🎯 ADDITIONAL API KEYS NEEDED

### **1. GOOGLE AUTH (OAuth) - REQUIRED** ⭐

**What it does:** User authentication via Google  
**Where to get it:** https://console.cloud.google.com/

**Steps:**
1. Go to: https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable "Google+ API" and "OAuth Consent Screen"
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: Web application
6. Authorized redirect URIs:
   - `http://localhost:8081/auth/callback` (local)
   - `https://ddwqkkiqgjptguzoeohr.supabase.co/auth/v1/callback` (production)
7. Copy:
   - **Client ID**
   - **Client Secret**

**Cost:** Free

**Keys needed:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

---

### **2. HEYGEN (Video Generation) - OPTIONAL**

**What it does:** AI-powered video avatar generation  
**Where to get it:** https://app.heygen.com/

**Steps:**
1. Go to: https://app.heygen.com/
2. Sign up / Sign in
3. Go to Settings → API Keys
4. Click "Generate API Key"
5. Copy the API key

**Cost:** Starting at $24/month (Creator plan)

**Keys needed:**
- `HEYGEN_API_KEY`

---

### **3. GOOGLE GEMINI (All-in-One: Content, Images, Video, Music) - REQUIRED** ⭐

**What it does:** 
- ✅ **Gemini AI** - Content generation, chat, analysis
- ✅ **Imagen** - AI image generation
- ✅ **Veo** - AI video generation
- ✅ **Lyria** - AI music generation
- ✅ **Embeddings** - Text embeddings
- ✅ **Live API** - Real-time streaming
- ✅ **File API** - Large file uploads

**Where to get it:** https://aistudio.google.com/app/apikey

**Steps:**
1. Go to: https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Click "Get API Key" or "Create API Key"
4. Select existing project or create new one
5. Copy the API key

**Cost:** 
- Free tier: 15 requests/minute
- Gemini 2.5 Flash: $0.00025/1K characters (input), $0.00075/1K characters (output)
- Imagen: ~$0.01-0.04 per image
- Veo: Usage-based (currently in preview)

**Keys needed:**
- `GEMINI_API_KEY` (provides access to ALL features above)

**API Endpoints:**
- Content: `models/gemini-2.5-flash:generateContent`
- Images: `models/imagen-3.0-generate-001:predict`
- Video: `models/veo-001:predictLongRunning`
- Embeddings: `models/text-embedding-004:embedContent`

---

### **4. ELEVENLABS (AI Voice Agents & Appointment Calling) - REQUIRED** ⭐

**What it does:**
- ✅ **Agents Platform** - AI voice agents for inbound/outbound calls
- ✅ **Appointment Scheduling** - Automated booking for tenants
- ✅ **Text-to-Speech** - Ultra-low latency voice (~75ms with Flash v2.5)
- ✅ **Speech-to-Text** - Real-time transcription (~150ms with Scribe v2)
- ✅ **Voice Cloning** - Custom brand voices
- ✅ **Multi-speaker Dialogue** - Natural conversations
- ✅ **70+ Languages** - Global support

**Where to get it:** https://elevenlabs.io/

**Steps to get API Key:**
1. Go to: https://elevenlabs.io/
2. Sign up / Sign in
3. Go to Profile Settings → API Keys
4. Click "Create API Key"
5. Name it: "UbiGrowth Production"
6. Copy your API key

**Steps to set up Agents Platform:**
1. Navigate to: https://elevenlabs.io/app/agents
2. Click "Create Agent"
3. Configure agent for appointment scheduling:
   - Set greeting message
   - Define conversation flow
   - Add booking logic
4. Configure phone number settings:
   - **Inbound**: Get phone number from ElevenLabs
   - **Outbound**: Set caller ID and configure dialing
5. Copy your **Agent ID** for API integration
6. Test your agent in the dashboard

**Cost:**
- **Free Tier**: 10,000 characters/month
- **Starter**: $5/month (100K characters)
- **Creator**: $11/month (500K characters)
- **Pro**: $99/month (2M characters)
- **Agents Platform Calling**: Usage-based rates
  - Inbound/Outbound: ~$0.10-0.15/minute
  - Phone numbers: ~$1-5/month per number

**Best Models for Real-Time Calling:**
- **Eleven Flash v2.5** - Ultra-low latency (~75ms) - Best for calls
- **Eleven Turbo v2.5** - High quality, low latency (~250-300ms)
- **Scribe v2 Realtime** - Real-time speech recognition (~150ms)

**Keys needed:**
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID` (optional, if using pre-configured agents)

**Integration with your platform:**
- Use ElevenLabs API to initiate outbound calls to leads
- Set up webhook to receive inbound call events
- Parse conversation data to create appointments
- Store call recordings and transcripts

---

### **5. OPENAI GPT (Content & AI Assistance) - REQUIRED** ⭐

**What it does:**
- ✅ **Content Generation** - Marketing copy, email campaigns, social posts
- ✅ **AI Assistance** - Chat support, lead qualification
- ✅ **Code Generation** - Frontend UI, automation scripts
- ✅ **Structured Outputs** - JSON data extraction
- ✅ **Function Calling** - Tool use and API integration
- ✅ **Vision** - Image analysis and description

**Where to get it:** https://platform.openai.com/api-keys

**Steps:**
1. Go to: https://platform.openai.com/api-keys
2. Sign in (or create account)
3. Click "Create new secret key"
4. Name it: "UbiGrowth Production"
5. Copy the key (starts with `sk-`)
6. Set up billing: https://platform.openai.com/account/billing

**Recommended Models:**
- **GPT-4o** - Best for complex reasoning and multimodal tasks
- **GPT-4o-mini** - Fast, cost-effective for most tasks (recommended for dev)
- **GPT-4 Turbo** - High intelligence, large context window

**Cost:** 
- **GPT-4o**: $2.50/1M input tokens, $10/1M output tokens
- **GPT-4o-mini**: $0.15/1M input tokens, $0.60/1M output tokens (⭐ Best value)
- **GPT-4 Turbo**: $10/1M input tokens, $30/1M output tokens

**Keys needed:**
- `OPENAI_API_KEY`

**Use Cases in Your Platform:**
1. **Campaign Content Generation** - Auto-generate email/SMS copy
2. **Lead Enrichment** - Extract structured data from lead info
3. **AI Chat Assistant** - Answer tenant questions
4. **Dynamic Personalization** - Customize messages per lead
5. **Sentiment Analysis** - Analyze lead engagement

---

### **6. ANTHROPIC CLAUDE (Data Recommendations) - REQUIRED** ⭐

**What it does:** AI-powered data analysis and recommendations  
**Where to get it:** https://console.anthropic.com/

**Steps:**
1. Go to: https://console.anthropic.com/
2. Sign up / Sign in
3. Go to Settings → API Keys
4. Click "Create Key"
5. Name it: "UbiGrowth Production"
6. Copy the key (starts with `sk-ant-`)

**Cost:**
- Claude 3.5 Sonnet: $3/1M input tokens, $15/1M output tokens
- Claude 3 Haiku: $0.25/1M input tokens, $1.25/1M output tokens

**Keys needed:**
- `ANTHROPIC_API_KEY`

---

## 🔧 SET API KEYS VIA COMMAND LINE

Once you have the keys, run these commands:

### **Google Auth:**
```powershell
cd "C:\Users\bill\.cursor\ubigrowth-marketing-hub"
supabase secrets set GOOGLE_CLIENT_ID="your_client_id_here"
supabase secrets set GOOGLE_CLIENT_SECRET="your_client_secret_here"
```

### **HeyGen (Video Avatars - Optional):**
```powershell
supabase secrets set HEYGEN_API_KEY="your_heygen_key_here"
```

### **Google Gemini (Content + Images + Video + Music):**
```powershell
supabase secrets set GEMINI_API_KEY="your_gemini_key_here"
```

### **ElevenLabs (AI Voice Agents & Calling):**
```powershell
supabase secrets set ELEVENLABS_API_KEY="your_elevenlabs_key_here"
supabase secrets set ELEVENLABS_AGENT_ID="your_agent_id_here"  # Optional
```

### **OpenAI GPT (Content & AI):**
```powershell
supabase secrets set OPENAI_API_KEY="sk-your_openai_key_here"
```

### **Anthropic Claude (Recommendations):**
```powershell
supabase secrets set ANTHROPIC_API_KEY="sk-ant-your_claude_key_here"
```

---

## 🌐 SET API KEYS VIA DASHBOARD (Alternative)

If command line doesn't work:

1. Go to: https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/settings/functions
2. Click "Secrets" or "Environment Variables"
3. Add each key manually:
   - Click "Add new secret"
   - Name: `OPENAI_API_KEY` (for example)
   - Value: `sk-your_key_here`
   - Click "Save"
4. Repeat for all keys

---

## ✅ VERIFY ALL KEYS ARE SET

### **Via Command Line:**
```powershell
supabase secrets list
```

**Expected output should include:**
```
RESEND_API_KEY=re_****
TWILIO_ACCOUNT_SID=AC****
TWILIO_AUTH_TOKEN=****
TWILIO_FROM_NUMBER=+1234567890
VAPI_PRIVATE_KEY=**** (optional, if keeping for voicemail drops)
ELEVENLABS_API_KEY=****
ELEVENLABS_AGENT_ID=**** (optional)
GOOGLE_CLIENT_ID=****
GOOGLE_CLIENT_SECRET=****
HEYGEN_API_KEY=**** (optional)
GEMINI_API_KEY=**** (includes Imagen, Veo, Lyria)
OPENAI_API_KEY=sk-****
ANTHROPIC_API_KEY=sk-ant-****
```

---

## 🧪 TEST API INTEGRATIONS

### **Test Google Auth:**
1. Go to your app login page
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Verify successful login

### **Test Gemini Content Generation:**
```sql
-- Test text generation
SELECT extensions.http_post(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
  '{"contents":[{"parts":[{"text":"Write a short marketing email"}]}]}',
  'application/json',
  ARRAY[('x-goog-api-key', current_setting('app.settings.gemini_api_key', true))]
);
```

### **Test Gemini Image Generation (Imagen):**
```sql
-- Test image generation
SELECT extensions.http_post(
  'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict',
  '{"instances":[{"prompt":"A professional business meeting"}],"parameters":{"sampleCount":1}}',
  'application/json',
  ARRAY[('x-goog-api-key', current_setting('app.settings.gemini_api_key', true))]
);
```

### **Test Gemini Video Generation (Veo):**
```sql
-- Test video generation (returns operation ID for long-running task)
SELECT extensions.http_post(
  'https://generativelanguage.googleapis.com/v1beta/models/veo-001:predictLongRunning',
  '{"instances":[{"prompt":"A timelapse of a city at sunset"}]}',
  'application/json',
  ARRAY[('x-goog-api-key', current_setting('app.settings.gemini_api_key', true))]
);
```

### **Test OpenAI GPT:**

**Basic Chat Completion:**
```sql
-- Test basic chat
SELECT extensions.http_post(
  'https://api.openai.com/v1/chat/completions',
  '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}]}',
  'application/json',
  ARRAY[('Authorization', 'Bearer ' || current_setting('app.settings.openai_api_key', true))]
);
```

**Content Generation for Campaign:**
```sql
-- Generate email content
SELECT extensions.http_post(
  'https://api.openai.com/v1/chat/completions',
  '{
    "model":"gpt-4o-mini",
    "messages":[{
      "role":"user",
      "content":"Write a professional follow-up email for a lead who downloaded our whitepaper about marketing automation. Keep it under 150 words."
    }]
  }',
  'application/json',
  ARRAY[('Authorization', 'Bearer ' || current_setting('app.settings.openai_api_key', true))]
);
```

**Structured Output (JSON):**
```sql
-- Extract structured lead data
SELECT extensions.http_post(
  'https://api.openai.com/v1/chat/completions',
  '{
    "model":"gpt-4o-mini",
    "messages":[{
      "role":"user",
      "content":"Extract: John Doe, VP of Sales at Acme Corp, interested in our Pro plan, budget $5k/month"
    }],
    "response_format": {"type": "json_object"}
  }',
  'application/json',
  ARRAY[('Authorization', 'Bearer ' || current_setting('app.settings.openai_api_key', true))]
);
```

### **Test Claude:**
```sql
-- Create test function call
SELECT extensions.http_post(
  'https://api.anthropic.com/v1/messages',
  '{"model":"claude-3-5-sonnet-20241022","max_tokens":1024,"messages":[{"role":"user","content":"Hello!"}]}',
  'application/json',
  ARRAY[
    ('x-api-key', current_setting('app.settings.anthropic_api_key', true)),
    ('anthropic-version', '2023-06-01')
  ]
);
```

### **Test ElevenLabs Text-to-Speech:**
```sql
-- Test TTS generation
SELECT extensions.http_post(
  'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',  -- Default voice ID
  '{"text":"Hello! This is a test of ElevenLabs voice for appointment scheduling.","model_id":"eleven_flash_v2_5"}',
  'application/json',
  ARRAY[
    ('xi-api-key', current_setting('app.settings.elevenlabs_api_key', true))
  ]
);
```

### **Test ElevenLabs Agent (via Dashboard):**
1. Go to: https://elevenlabs.io/app/agents
2. Open your agent
3. Click "Test Agent"
4. Have a conversation to test appointment scheduling flow
5. Check conversation logs and transcripts

---

## 📋 COMPLETE API KEY CHECKLIST

**Phase 3 - Original (Messaging):**
- [x] Resend (Email)
- [x] Twilio (SMS)
- [x] VAPI (Voice)

**Phase 4 - Extended (AI & Video):**
- [ ] Google Auth (OAuth)
- [ ] Google Gemini (Content + Images + Video + Music - All-in-One!)
- [ ] ElevenLabs (AI Voice Agents + Appointment Calling)
- [ ] HeyGen (Optional: Video avatars)
- [ ] OpenAI GPT (AI assistance)
- [ ] Anthropic Claude (Data recommendations)

---

## 💰 ESTIMATED MONTHLY COSTS

**Minimum (Development):**
- Google Auth: Free
- Gemini: Free tier (15 RPM)
- ElevenLabs: $5-11/month + minimal call testing
- OpenAI GPT-4o-mini: ~$5-20/month
- Claude 3 Haiku: ~$5-15/month
- **Total: ~$20-51/month**

**Full Production with Voice Calling:**
- Google Auth: Free
- Gemini (Content + Images + Video): ~$20-100/month
- **ElevenLabs (Voice Agents)**: $99/month + calling costs
  - Voice calling: ~$0.10-0.15/minute
  - Example: 1,000 minutes/month = ~$100-150/month
- HeyGen (optional): $24+/month
- OpenAI GPT-4o: ~$50-200/month
- Claude 3.5 Sonnet: ~$30-100/month
- **Total: ~$300-650/month** (depending on call volume and usage)

---

## 🔒 SECURITY BEST PRACTICES

1. **Never commit API keys to git**
2. **Use environment variables only**
3. **Rotate keys every 90 days**
4. **Set up usage alerts:**
   - OpenAI: https://platform.openai.com/account/billing/limits
   - Anthropic: https://console.anthropic.com/settings/limits
   - Google: https://console.cloud.google.com/billing/budgets
5. **Use rate limiting in your edge functions**
6. **Monitor API usage regularly**

---

## 🚨 TROUBLESHOOTING

### **Google Auth not working:**
- Check redirect URIs match exactly
- Verify OAuth consent screen is configured
- Check Supabase Auth settings

### **AI API errors:**
- Verify API key format (OpenAI: `sk-`, Claude: `sk-ant-`)
- Check billing is enabled (OpenAI & Claude require payment method)
- Verify rate limits aren't exceeded
- Check API endpoint URLs are correct

### **Video API errors:**
- HeyGen: Verify subscription is active
- Google Veo: May need to request beta access
- Check video generation quotas

---

## 📚 USEFUL LINKS

**Google:**
- Cloud Console: https://console.cloud.google.com/
- AI Studio: https://aistudio.google.com/
- Gemini API Docs: https://ai.google.dev/docs

**OpenAI:**
- API Keys: https://platform.openai.com/api-keys
- Documentation: https://platform.openai.com/docs
- Usage Dashboard: https://platform.openai.com/usage

**Anthropic:**
- Console: https://console.anthropic.com/
- Documentation: https://docs.anthropic.com/
- Claude Models: https://docs.anthropic.com/claude/docs/models-overview

**ElevenLabs:**
- Dashboard: https://elevenlabs.io/app
- Agents Platform: https://elevenlabs.io/app/agents
- API Documentation: https://elevenlabs.io/docs
- Voice Library: https://elevenlabs.io/app/voice-library

**HeyGen:**
- Dashboard: https://app.heygen.com/
- API Docs: https://docs.heygen.com/

---

*Generated: 2026-01-08*  
*Extended AI & Video API Configuration Guide*
