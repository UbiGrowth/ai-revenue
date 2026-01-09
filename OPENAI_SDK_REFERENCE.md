# 📚 OpenAI SDK Reference Guide - UbiGrowth Marketing Hub

**Date:** 2026-01-08  
**Project:** ddwqkkiqgjptguzoeohr

---

## 🎯 Quick Start - SDK Installation

### **For Supabase Edge Functions (Deno) - Recommended**

```typescript
// Import directly in your edge function
import OpenAI from "npm:openai@^4.20.1"

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})
```

### **For Local Testing (Node.js)**

```bash
npm install openai
```

```typescript
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})
```

### **For Python (if building ML pipelines)**

```bash
pip install openai
```

```python
from openai import OpenAI

client = OpenAI()  # Reads OPENAI_API_KEY from environment
```

---

## 🔑 Environment Setup

### **Windows PowerShell:**

```powershell
# Temporary (current session)
$env:OPENAI_API_KEY="sk-your_key_here"

# Permanent (all sessions)
setx OPENAI_API_KEY "sk-your_key_here"
```

### **macOS/Linux:**

```bash
# Temporary (current session)
export OPENAI_API_KEY="sk-your_key_here"

# Permanent (add to shell config)
echo 'export OPENAI_API_KEY="sk-your_key_here"' >> ~/.zshrc
source ~/.zshrc
```

### **Supabase Secrets:**

```powershell
cd "C:\Users\bill\.cursor\ubigrowth-marketing-hub"
supabase secrets set OPENAI_API_KEY="sk-your_key_here"
```

---

## 📖 SDK Usage Examples

### **1. Basic Chat Completion**

```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello!" }
  ]
})

console.log(completion.choices[0].message.content)
```

### **2. Structured JSON Output**

```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "user", content: "Extract: John Doe, john@example.com, Acme Corp" }
  ],
  response_format: { type: "json_object" }
})

const data = JSON.parse(completion.choices[0].message.content)
```

### **3. Streaming Responses**

```typescript
const stream = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "user", content: "Write a long story" }
  ],
  stream: true
})

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "")
}
```

### **4. Function Calling**

```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "user", content: "What's the weather in Boston?" }
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get the current weather in a location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city and state, e.g. San Francisco, CA"
            }
          },
          required: ["location"]
        }
      }
    }
  ]
})

const toolCall = completion.choices[0].message.tool_calls[0]
console.log(toolCall.function.name)  // "get_weather"
console.log(toolCall.function.arguments)  // '{"location":"Boston, MA"}'
```

### **5. Vision (Image Analysis)**

```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What's in this image?" },
        {
          type: "image_url",
          image_url: {
            url: "https://example.com/image.jpg"
          }
        }
      ]
    }
  ]
})
```

### **6. Embeddings (for Search)**

```typescript
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: "Your text here"
})

console.log(embedding.data[0].embedding)  // Array of 1536 numbers
```

---

## 🛠️ Useful OpenAI Tools & Repositories

### **1. Tiktoken - Token Counting**

Essential for managing costs and context limits.

**Installation:**
```bash
npm install tiktoken
```

**Usage:**
```typescript
import { encoding_for_model } from "tiktoken"

const encoding = encoding_for_model("gpt-4o-mini")
const tokens = encoding.encode("Hello, world!")
console.log(`Token count: ${tokens.length}`)
encoding.free()  // Clean up
```

**Why use it:**
- Accurately count tokens before API calls
- Manage context window (e.g., GPT-4o: 128K tokens)
- Estimate costs before processing

**Link:** https://github.com/openai/tiktoken

---

### **2. Simple Evals - Evaluation Library**

Test and evaluate your AI outputs.

**Installation:**
```bash
git clone https://github.com/openai/simple-evals
cd simple-evals
pip install -e .
```

**Use cases:**
- Evaluate agent performance
- A/B test prompts
- Quality assurance

**Link:** https://github.com/openai/simple-evals

---

### **3. Swarm - Agent Orchestration (Educational)**

Learn multi-agent patterns and coordination.

**Installation:**
```bash
pip install git+https://github.com/openai/swarm.git
```

**Use cases:**
- Multi-agent workflows
- Handoffs between specialized agents
- Educational reference

**Link:** https://github.com/openai/swarm

---

## 🔄 SDK Features by Platform

### **JavaScript/TypeScript SDK**

**Features:**
- ✅ Chat completions
- ✅ Streaming
- ✅ Function calling
- ✅ Vision
- ✅ Embeddings
- ✅ Image generation (DALL-E)
- ✅ Text-to-speech
- ✅ Speech-to-text (Whisper)
- ✅ Automatic retries
- ✅ Type safety

**GitHub:** https://github.com/openai/openai-node

---

### **Python SDK**

**Features:**
- ✅ All JavaScript features
- ✅ Better for ML pipelines
- ✅ Pandas integration
- ✅ Jupyter notebook support

**GitHub:** https://github.com/openai/openai-python

---

### **Other Official SDKs:**

| Language | Status | Link |
|----------|--------|------|
| **.NET/C#** | Official | [GitHub](https://github.com/openai/openai-dotnet) |
| **Java** | Beta | [GitHub](https://github.com/openai/openai-java) |
| **Go** | Beta | [GitHub](https://github.com/openai/openai-go) |

---

## 💡 SDK Best Practices

### **1. Error Handling**

```typescript
try {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello" }]
  })
} catch (error) {
  if (error instanceof OpenAI.APIError) {
    console.error(`OpenAI API error: ${error.status} - ${error.message}`)
  } else {
    console.error(`Unexpected error: ${error}`)
  }
}
```

### **2. Automatic Retries**

The SDK automatically retries on certain errors:

```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,  // Default is 2
  timeout: 30000  // 30 seconds
})
```

### **3. Custom Headers**

```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: {
    'X-Custom-Header': 'your-value'
  }
})
```

### **4. Prompt Caching (Cost Optimization)**

```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content: "Long system prompt that rarely changes..."
      // This gets cached automatically!
    },
    {
      role: "user",
      content: "Variable user input"
    }
  ]
})
```

---

## 📊 Token Management

### **Model Context Windows:**

| Model | Context Window | Cost (Input/Output per 1M tokens) |
|-------|----------------|-----------------------------------|
| **gpt-4o** | 128K tokens | $2.50 / $10 |
| **gpt-4o-mini** | 128K tokens | $0.15 / $0.60 |
| **gpt-4-turbo** | 128K tokens | $10 / $30 |
| **gpt-3.5-turbo** | 16K tokens | $0.50 / $1.50 |

### **Rough Token Estimates:**

- 1 token ≈ 4 characters in English
- 1 token ≈ ¾ of a word
- 100 tokens ≈ 75 words
- 1,000 tokens ≈ 750 words

### **Calculate Tokens:**

```typescript
import { encoding_for_model } from "tiktoken"

function countTokens(text: string, model = "gpt-4o-mini") {
  const encoding = encoding_for_model(model)
  const tokens = encoding.encode(text)
  const count = tokens.length
  encoding.free()
  return count
}

// Usage
const prompt = "Write a marketing email..."
const tokenCount = countTokens(prompt)
console.log(`This prompt uses ${tokenCount} tokens`)
```

---

## 🔒 Security Best Practices

### **1. Never Expose API Keys**

```typescript
// ❌ BAD - Never do this!
const openai = new OpenAI({
  apiKey: "sk-abc123..."  // Hardcoded!
})

// ✅ GOOD - Use environment variables
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})
```

### **2. Use Edge Functions (Server-Side)**

```typescript
// ✅ GOOD - Call OpenAI from Supabase Edge Function
// supabase/functions/my-function/index.ts
import OpenAI from "npm:openai@^4.20.1"

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

// Client calls your edge function, not OpenAI directly
```

### **3. Rate Limiting**

```typescript
// Implement rate limiting in your edge functions
const rateLimiter = new Map()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = rateLimiter.get(userId)
  
  if (userLimit && now - userLimit < 60000) {
    return false  // Less than 1 minute since last call
  }
  
  rateLimiter.set(userId, now)
  return true
}
```

---

## 🧪 Testing & Development

### **Local Testing Script:**

```typescript
// test-openai.ts
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

async function testAPI() {
  try {
    console.log("Testing OpenAI API...")
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: "Say 'API is working!'" }
      ]
    })
    
    console.log("✅ Success!")
    console.log("Response:", completion.choices[0].message.content)
    console.log("Tokens used:", completion.usage)
    
  } catch (error) {
    console.error("❌ Error:", error.message)
  }
}

testAPI()
```

Run with:
```bash
OPENAI_API_KEY=sk-your-key node test-openai.ts
```

---

## 📚 Additional Resources

### **Official Documentation:**
- API Reference: https://platform.openai.com/docs/api-reference
- SDK Guide: https://platform.openai.com/docs/libraries
- Best Practices: https://platform.openai.com/docs/guides/production-best-practices

### **GitHub Repositories:**
- JavaScript SDK: https://github.com/openai/openai-node
- Python SDK: https://github.com/openai/openai-python
- Tiktoken: https://github.com/openai/tiktoken
- Simple Evals: https://github.com/openai/simple-evals
- Swarm: https://github.com/openai/swarm

### **Community:**
- OpenAI Community Forum: https://community.openai.com
- Discord: https://discord.gg/openai

---

## 🚀 Quick Reference

### **Basic Chat:**
```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }]
})
```

### **JSON Mode:**
```typescript
response_format: { type: "json_object" }
```

### **Streaming:**
```typescript
stream: true
```

### **Function Calling:**
```typescript
tools: [{ type: "function", function: {...} }]
```

### **Count Tokens:**
```typescript
import { encoding_for_model } from "tiktoken"
const enc = encoding_for_model("gpt-4o-mini")
const tokens = enc.encode(text)
console.log(tokens.length)
enc.free()
```

---

*Generated: 2026-01-08*  
*OpenAI SDK Reference Guide for UbiGrowth Marketing Hub*
