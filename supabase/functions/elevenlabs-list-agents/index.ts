// ElevenLabs Direct Integration - List Agents
// Gets agents directly from ElevenLabs API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')

if (!ELEVENLABS_API_KEY) {
  console.error('FATAL: ELEVENLABS_API_KEY not configured')
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      } 
    })
  }

  try {
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error: ELEVENLABS_API_KEY not configured' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    console.log('📋 Fetching ElevenLabs agents...')
    
    // Get agents from ElevenLabs
    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY!
      }
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error('ElevenLabs API error:', error)
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`)
    }
    
    const data = await response.json()
    
    // Transform to our format
    const agents = (data.agents || []).map((agent: any) => ({
      id: agent.agent_id,
      name: agent.name || 'Unnamed Agent',
      conversation_config: agent.conversation_config,
      platform_settings: agent.platform_settings,
      created_at: agent.created_at_unix
    }))
    
    console.log(`✅ Found ${agents.length} ElevenLabs agents`)
    
    return new Response(
      JSON.stringify({
        success: true,
        agents: agents,
        count: agents.length
      }),
      { 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
        },
        status: 200
      }
    )
    
  } catch (error) {
    console.error('❌ Failed to fetch agents:', error)
    return new Response(
      JSON.stringify({
        success: false,
        agents: [],
        error: error instanceof Error ? error.message : 'Failed to fetch agents'
      }),
      { 
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
        }
      }
    )
  }
})
