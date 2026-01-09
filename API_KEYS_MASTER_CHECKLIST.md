# ✅ API KEYS MASTER CHECKLIST - UbiGrowth Marketing Hub

**Date:** 2026-01-08  
**Project:** ddwqkkiqgjptguzoeohr

---

## 📊 CURRENT STATUS

### ✅ **Phase 3 - Messaging APIs (COMPLETED)**
- [x] **Resend** - Email campaigns
- [x] **Twilio** - SMS campaigns  
- [x] **VAPI** - Voice/voicemail

### ⚠️ **Phase 4 - AI & Advanced Features (IN PROGRESS)**
- [ ] **Google Auth** - User authentication
- [ ] **Google Gemini** - Content, images, video, music
- [ ] **ElevenLabs** - AI voice calling & appointment scheduling
- [ ] **OpenAI GPT** - Content generation & AI assistance
- [ ] **Anthropic Claude** - Data analysis & recommendations
- [ ] **HeyGen** (Optional) - Video avatars

---

## 🎯 QUICK START - GET ALL API KEYS

| Service | Purpose | Get Key From | Priority |
|---------|---------|--------------|----------|
| **Google Auth** | User login | [Google Console](https://console.cloud.google.com/) | 🔴 Required |
| **Gemini** | AI everything | [AI Studio](https://aistudio.google.com/app/apikey) | 🔴 Required |
| **ElevenLabs** | Voice calling | [ElevenLabs](https://elevenlabs.io/) | 🔴 Required |
| **OpenAI** | Content AI | [OpenAI Platform](https://platform.openai.com/api-keys) | 🔴 Required |
| **Claude** | Data insights | [Anthropic Console](https://console.anthropic.com/) | 🔴 Required |
| **HeyGen** | Video avatars | [HeyGen Dashboard](https://app.heygen.com/) | 🟡 Optional |

---

## 🔧 SETUP COMMANDS (Copy & Paste)

Once you have all your API keys, run these commands:

```powershell
# Navigate to project
cd "C:\Users\bill\.cursor\ubigrowth-marketing-hub"

# === Phase 4 API Keys ===

# Google Auth
supabase secrets set GOOGLE_CLIENT_ID="your_google_client_id_here"
supabase secrets set GOOGLE_CLIENT_SECRET="your_google_client_secret_here"

# Google Gemini (includes Imagen, Veo, Lyria)
supabase secrets set GEMINI_API_KEY="your_gemini_key_here"

# ElevenLabs (Voice Agents & Calling)
supabase secrets set ELEVENLABS_API_KEY="your_elevenlabs_key_here"
supabase secrets set ELEVENLABS_AGENT_ID="your_agent_id_here"  # Optional

# OpenAI GPT (Content & AI Assistance)
supabase secrets set OPENAI_API_KEY="sk-your_openai_key_here"

# Anthropic Claude (Data Recommendations)
supabase secrets set ANTHROPIC_API_KEY="sk-ant-your_claude_key_here"

# HeyGen (Optional - Video Avatars)
supabase secrets set HEYGEN_API_KEY="your_heygen_key_here"

# === Verify All Secrets ===
supabase secrets list
```

---

## 📋 EXPECTED SECRETS LIST

After setup, `supabase secrets list` should show:

```
✅ RESEND_API_KEY=re_****
✅ TWILIO_ACCOUNT_SID=AC****
✅ TWILIO_AUTH_TOKEN=****
✅ TWILIO_FROM_NUMBER=+1234567890
✅ VAPI_PRIVATE_KEY=****

⚠️ GOOGLE_CLIENT_ID=****
⚠️ GOOGLE_CLIENT_SECRET=****
⚠️ GEMINI_API_KEY=****
⚠️ ELEVENLABS_API_KEY=****
⚠️ ELEVENLABS_AGENT_ID=**** (optional)
⚠️ OPENAI_API_KEY=sk-****
⚠️ ANTHROPIC_API_KEY=sk-ant-****
⚠️ HEYGEN_API_KEY=**** (optional)
```

---

## 🎨 WHAT EACH API DOES IN YOUR PLATFORM

### **1. Google Auth (OAuth)**
- **User Authentication:** Sign in with Google
- **Security:** Secure, trusted login
- **Setup Time:** 10 minutes

### **2. Google Gemini (All-in-One AI)**
Includes 5 services in 1 API key:
- **Content Generation:** Marketing copy, blog posts
- **Image Creation:** Promotional images (Imagen)
- **Video Generation:** Marketing videos (Veo)
- **Music Generation:** Background music (Lyria)
- **Embeddings:** Search and recommendations
- **Setup Time:** 5 minutes

### **3. ElevenLabs (Voice Calling)**
- **Outbound Calls:** AI agent calls leads to schedule appointments
- **Inbound Calls:** Leads can call to book automatically
- **Voice Quality:** Ultra-realistic, 70+ languages
- **Real-time:** ~75ms latency for natural conversation
- **Setup Time:** 20 minutes (including agent configuration)

### **4. OpenAI GPT (Content & AI)**
- **Campaign Content:** Auto-generate emails, SMS, social posts
- **Lead Intelligence:** Extract and structure lead data
- **AI Chat:** Support tenants with questions
- **Personalization:** Customize messages per lead
- **🆕 Agent Builder:** Visual workflow designer for complex agents
  - Lead qualification workflows
  - Appointment scheduling agents
  - Multi-step automation
- **Setup Time:** 5 minutes (API), 30-60 minutes (Agent workflows)

### **5. Anthropic Claude (Data Analysis)**
- **Lead Scoring:** Analyze and prioritize leads
- **Campaign Insights:** Analyze performance, suggest improvements
- **Recommendations:** Strategic insights from your data
- **Executive Summaries:** Generate reports for tenants
- **Setup Time:** 5 minutes

### **6. HeyGen (Optional - Video Avatars)**
- **Video Avatars:** Generate videos with AI presenters
- **Alternative:** Use Gemini Veo instead (included above)
- **Setup Time:** 15 minutes

---

## 💰 COST BREAKDOWN

### **Development/Testing (Low Usage)**
| Service | Monthly Cost |
|---------|--------------|
| Google Auth | Free |
| Gemini | Free tier (15 RPM) |
| ElevenLabs | $5-11/month |
| OpenAI | $5-20/month |
| Claude | $5-15/month |
| **TOTAL** | **$15-46/month** |

### **Production (Medium Usage)**
| Service | Monthly Cost |
|---------|--------------|
| Google Auth | Free |
| Gemini | $20-100/month |
| ElevenLabs | $99/month + $100-150/month calling |
| OpenAI | $50-200/month |
| Claude | $30-100/month |
| HeyGen (optional) | $24+/month |
| **TOTAL** | **$299-549/month** |

### **High Volume Production**
| Service | Monthly Cost |
|---------|--------------|
| Google Auth | Free |
| Gemini | $100-300/month |
| ElevenLabs | $99/month + $300-500/month calling |
| OpenAI | $200-500/month |
| Claude | $100-300/month |
| **TOTAL** | **$799-1,599/month** |

---

## 🧪 TESTING EACH API

### **1. Test Google Auth**
- Go to your app
- Click "Sign in with Google"
- Verify successful login

### **2. Test Gemini**
```powershell
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" `
  -H "x-goog-api-key: YOUR_GEMINI_KEY" `
  -H "Content-Type: application/json" `
  -d '{"contents":[{"parts":[{"text":"Write a marketing tagline"}]}]}'
```

### **3. Test ElevenLabs**
```powershell
curl "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM" `
  -H "xi-api-key: YOUR_ELEVENLABS_KEY" `
  -H "Content-Type: application/json" `
  -d '{"text":"Hello, this is a test.","model_id":"eleven_flash_v2_5"}' `
  --output test.mp3
```

### **4. Test OpenAI**
```powershell
curl "https://api.openai.com/v1/chat/completions" `
  -H "Authorization: Bearer YOUR_OPENAI_KEY" `
  -H "Content-Type: application/json" `
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}]}'
```

### **5. Test Claude**
```powershell
curl "https://api.anthropic.com/v1/messages" `
  -H "x-api-key: YOUR_CLAUDE_KEY" `
  -H "anthropic-version: 2023-06-01" `
  -H "Content-Type: application/json" `
  -d '{"model":"claude-sonnet-4-5","max_tokens":1024,"messages":[{"role":"user","content":"Hello!"}]}'
```

---

## 📚 DETAILED DOCUMENTATION

We've created comprehensive guides for each integration:

1. **CONFIGURE_API_KEYS.md** - Original messaging APIs (Phase 3) ✅
2. **CONFIGURE_AI_VIDEO_APIS.md** - AI & video APIs overview (Phase 4) ⚠️
3. **OPENAI_INTEGRATION_GUIDE.md** - OpenAI implementation examples 📖
4. **OPENAI_SDK_REFERENCE.md** - Complete SDK setup & usage guide 📚
5. **AGENT_BUILDER_GUIDE.md** - Build visual AI agent workflows 🤖
6. **API_KEYS_MASTER_CHECKLIST.md** - This file! ✅

---

## 🚀 RECOMMENDED SETUP ORDER

### **Step 1: Get All API Keys (30 minutes)**
1. Google Auth - 10 min
2. Gemini - 5 min
3. OpenAI - 5 min
4. Claude - 5 min
5. ElevenLabs - 20 min (includes agent setup)

### **Step 2: Set Secrets (5 minutes)**
Run the setup commands above

### **Step 3: Verify (5 minutes)**
```powershell
supabase secrets list
```

### **Step 4: Test Each Integration (20 minutes)**
Use the test commands above

### **Step 5: Deploy to Production**
Your platform is now fully powered by AI! 🎉

---

## ⚡ QUICK WINS - START HERE

If you want to see results fast, prioritize these:

1. **OpenAI (5 min)** - Generate your first campaign email
2. **Claude (5 min)** - Analyze your top 10 leads
3. **Gemini (5 min)** - Create promotional image
4. **ElevenLabs (20 min)** - Set up appointment calling

**Total time to first AI features: ~35 minutes**

---

## 🔗 USEFUL LINKS

### **API Keys & Setup**
- [Google Console](https://console.cloud.google.com/)
- [Google AI Studio](https://aistudio.google.com/app/apikey)
- [ElevenLabs Dashboard](https://elevenlabs.io/app)
- [ElevenLabs Agents](https://elevenlabs.io/app/agents)
- [OpenAI API Keys](https://platform.openai.com/api-keys)
- [Anthropic Console](https://console.anthropic.com/)

### **Documentation**
- [Gemini API Docs](https://ai.google.dev/docs)
- [ElevenLabs API Docs](https://elevenlabs.io/docs)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Claude API Docs](https://docs.anthropic.com/)

### **Billing & Usage**
- [Gemini Pricing](https://ai.google.dev/pricing)
- [ElevenLabs Pricing](https://elevenlabs.io/pricing)
- [OpenAI Pricing](https://openai.com/pricing)
- [Claude Pricing](https://www.anthropic.com/pricing)

---

## ❓ NEED HELP?

**Common Issues:**
1. **"Secret not found"** - Run `supabase link --project-ref ddwqkkiqgjptguzoeohr` first
2. **"Invalid API key"** - Check for spaces or incorrect format
3. **"Rate limit exceeded"** - You're on free tier, upgrade or wait

**Support Resources:**
- Supabase Discord: https://discord.supabase.com
- OpenAI Community: https://community.openai.com
- ElevenLabs Support: https://elevenlabs.io/support

---

## ✅ FINAL CHECKLIST

Before going to production:

- [ ] All API keys obtained
- [ ] All secrets set in Supabase
- [ ] `supabase secrets list` shows all keys
- [ ] Tested each API integration
- [ ] Set up billing alerts for each service
- [ ] Documented API usage limits
- [ ] Created backup API keys
- [ ] Reviewed security best practices

---

**🎉 You're ready to launch your AI-powered marketing platform!**

*Last Updated: 2026-01-08*  
*UbiGrowth Marketing Hub - API Configuration*
