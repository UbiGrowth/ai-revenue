import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vapiPrivateKey = Deno.env.get('VAPI_PRIVATE_KEY');
    
    if (!vapiPrivateKey) {
      console.error('VAPI_PRIVATE_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'VAPI_PRIVATE_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching assistants from Vapi API...');

    // Fetch assistants from Vapi API
    const response = await fetch('https://api.vapi.ai/assistant', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${vapiPrivateKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vapi API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Vapi API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const assistants = await response.json();
    console.log(`Successfully fetched ${assistants.length} assistants`);

    // Return simplified assistant data
    const simplifiedAssistants = assistants.map((assistant: any) => ({
      id: assistant.id,
      name: assistant.name || 'Unnamed Assistant',
      firstMessage: assistant.firstMessage,
      model: assistant.model?.model || 'Unknown',
      voice: assistant.voice?.voiceId || assistant.voice?.voice || 'Default',
      createdAt: assistant.createdAt,
    }));

    return new Response(
      JSON.stringify({ assistants: simplifiedAssistants }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in vapi-list-assistants:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
