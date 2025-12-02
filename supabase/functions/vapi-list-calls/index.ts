import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vapiPrivateKey = Deno.env.get('VAPI_PRIVATE_KEY');
    
    if (!vapiPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPI_PRIVATE_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { limit = 100, assistantId, callId } = await req.json().catch(() => ({}));

    let url = 'https://api.vapi.ai/call';
    const params = new URLSearchParams();
    
    if (limit) params.append('limit', String(limit));
    if (assistantId) params.append('assistantId', assistantId);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    // If specific callId, get that call's details
    if (callId) {
      url = `https://api.vapi.ai/call/${callId}`;
    }

    console.log('Fetching calls from Vapi:', url);

    const response = await fetch(url, {
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

    const calls = await response.json();
    console.log(`Successfully fetched ${Array.isArray(calls) ? calls.length : 1} calls`);

    // Simplify call data for frontend
    const simplifiedCalls = Array.isArray(calls) ? calls.map((call: any) => ({
      id: call.id,
      type: call.type,
      status: call.status,
      assistantId: call.assistantId,
      phoneNumberId: call.phoneNumberId,
      customer: call.customer,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      cost: call.cost,
      costBreakdown: call.costBreakdown,
      duration: call.endedAt && call.startedAt 
        ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
        : null,
      transcript: call.transcript,
      recordingUrl: call.recordingUrl,
      summary: call.summary,
      createdAt: call.createdAt,
    })) : calls;

    return new Response(
      JSON.stringify({ calls: simplifiedCalls }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in vapi-list-calls:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
