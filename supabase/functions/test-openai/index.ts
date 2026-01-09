// Test OpenAI API integration
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import OpenAI from "npm:openai@^4.20.1"

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

serve(async (req) => {
  try {
    console.log("Testing OpenAI API...")
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant for the UbiGrowth Marketing Hub.'
        },
        {
          role: 'user',
          content: 'Write a short, professional marketing email (2-3 sentences) about our AI-powered lead generation platform.'
        }
      ],
      max_tokens: 150
    })
    
    const content = completion.choices[0].message.content
    const usage = completion.usage
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "✅ OpenAI API is working!",
        generated_content: content,
        tokens_used: usage,
        model: completion.model
      }, null, 2),
      { 
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    )
    
  } catch (error) {
    console.error("❌ Error:", error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }, null, 2),
      { 
        headers: { "Content-Type": "application/json" },
        status: 500
      }
    )
  }
})
