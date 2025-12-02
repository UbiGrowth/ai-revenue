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

    console.log('Fetching analytics from Vapi...');

    // Fetch calls to calculate analytics
    const callsResponse = await fetch('https://api.vapi.ai/call?limit=1000', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${vapiPrivateKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!callsResponse.ok) {
      const errorText = await callsResponse.text();
      console.error('Vapi API error:', callsResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Vapi API error` }),
        { status: callsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const calls = await callsResponse.json();

    // Calculate analytics
    const totalCalls = calls.length;
    const completedCalls = calls.filter((c: any) => c.status === 'ended').length;
    const totalCost = calls.reduce((sum: number, c: any) => sum + (c.cost || 0), 0);
    const totalDuration = calls.reduce((sum: number, c: any) => {
      if (c.endedAt && c.startedAt) {
        return sum + (new Date(c.endedAt).getTime() - new Date(c.startedAt).getTime()) / 1000;
      }
      return sum;
    }, 0);

    // Calls by type
    const callsByType = calls.reduce((acc: any, c: any) => {
      const type = c.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Calls by status
    const callsByStatus = calls.reduce((acc: any, c: any) => {
      const status = c.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Calls per day (last 30 days)
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const callsPerDay = calls
      .filter((c: any) => new Date(c.createdAt) > last30Days)
      .reduce((acc: any, c: any) => {
        const date = new Date(c.createdAt).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

    // Calls by assistant
    const callsByAssistant = calls.reduce((acc: any, c: any) => {
      const assistantId = c.assistantId || 'unknown';
      acc[assistantId] = (acc[assistantId] || 0) + 1;
      return acc;
    }, {});

    const analytics = {
      totalCalls,
      completedCalls,
      totalCost: Math.round(totalCost * 100) / 100,
      totalDurationSeconds: Math.round(totalDuration),
      totalDurationMinutes: Math.round(totalDuration / 60),
      averageCallDuration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
      callsByType,
      callsByStatus,
      callsPerDay,
      callsByAssistant,
    };

    console.log('Analytics calculated:', analytics);

    return new Response(
      JSON.stringify({ analytics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in vapi-analytics:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
