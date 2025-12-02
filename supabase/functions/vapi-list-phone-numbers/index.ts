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
      console.error('VAPI_PRIVATE_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'VAPI_PRIVATE_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching phone numbers from Vapi API...');

    const response = await fetch('https://api.vapi.ai/phone-number', {
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

    const phoneNumbers = await response.json();
    console.log(`Successfully fetched ${phoneNumbers.length} phone numbers`);

    const simplifiedNumbers = phoneNumbers.map((num: any) => ({
      id: num.id,
      number: num.number,
      name: num.name || num.number,
      provider: num.provider,
      createdAt: num.createdAt,
    }));

    return new Response(
      JSON.stringify({ phoneNumbers: simplifiedNumbers }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in vapi-list-phone-numbers:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
