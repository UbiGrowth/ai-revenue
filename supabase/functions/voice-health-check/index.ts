// Voice Health Check
// Quick check of voice agent setup status
// Called automatically by UI on page load

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const VAPI_PRIVATE_KEY = Deno.env.get('VAPI_PRIVATE_KEY')
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      } 
    })
  }

  try {
    const health = {
      ready: false,
      providers: {
        vapi: { connected: false, agents: 0 },
        elevenlabs: { connected: false, agents: 0 },
        orchestration: { enabled: false }
      },
      capabilities: [] as string[],
      message: '',
      action_required: null as string | null
    }
    
    // Check VAPI
    if (VAPI_PRIVATE_KEY) {
      try {
        const vapiTest = await fetch('https://api.vapi.ai/assistant?limit=1', {
          headers: { 'Authorization': `Bearer ${VAPI_PRIVATE_KEY}` },
          signal: AbortSignal.timeout(3000) // 3s timeout
        })
        
        if (vapiTest.ok) {
          const data = await vapiTest.json()
          health.providers.vapi.connected = true
          health.providers.vapi.agents = Array.isArray(data) ? data.length : 0
          health.capabilities.push('VAPI voice calls')
          health.capabilities.push('VAPI voicemail drops')
        }
      } catch (e) {
        // Silent fail - not critical
      }
    }
    
    // Check ElevenLabs
    if (ELEVENLABS_API_KEY) {
      try {
        const elevenTest = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': ELEVENLABS_API_KEY },
          signal: AbortSignal.timeout(3000)
        })
        
        if (elevenTest.ok) {
          health.providers.elevenlabs.connected = true
          
          // Try to get agent count
          const agentsTest = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
            headers: { 'xi-api-key': ELEVENLABS_API_KEY },
            signal: AbortSignal.timeout(3000)
          })
          
          if (agentsTest.ok) {
            const agentsData = await agentsTest.json()
            health.providers.elevenlabs.agents = agentsData.agents?.length || 0
          }
          
          health.capabilities.push('ElevenLabs AI calls')
          health.capabilities.push('Interactive voice agents')
        }
      } catch (e) {
        // Silent fail
      }
    }
    
    // Check Orchestration
    if (OPENAI_API_KEY) {
      health.providers.orchestration.enabled = true
      health.capabilities.push('Smart routing')
      health.capabilities.push('Cost optimization')
      health.capabilities.push('Lead qualification')
    }
    
    // Determine overall status
    const hasVoiceProvider = health.providers.vapi.connected || health.providers.elevenlabs.connected
    const hasAgents = health.providers.vapi.agents > 0 || health.providers.elevenlabs.agents > 0
    const hasOrchestration = health.providers.orchestration.enabled
    
    if (hasVoiceProvider && hasOrchestration) {
      health.ready = true
      
      if (hasAgents) {
        health.message = '✅ Voice agents ready! Send campaigns anytime.'
      } else {
        health.message = '⚠️ Connected but no agents found. Creating default agent...'
        health.action_required = 'auto_create_agent'
      }
    } else {
      health.ready = false
      
      const missing = []
      if (!hasVoiceProvider) missing.push('voice provider (VAPI or ElevenLabs)')
      if (!hasOrchestration) missing.push('OpenAI for orchestration')
      
      health.message = `❌ Missing: ${missing.join(', ')}`
      health.action_required = 'configure_apis'
    }
    
    return new Response(
      JSON.stringify(health, null, 2),
      { 
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    )
    
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        ready: false,
        error: error.message 
      }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 500
      }
    )
  }
})
