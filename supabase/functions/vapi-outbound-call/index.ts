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

    const { assistantId, phoneNumberId, customerNumber, customerName, leadId } = await req.json();

    if (!assistantId || !customerNumber) {
      return new Response(
        JSON.stringify({ error: 'assistantId and customerNumber are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Initiating outbound call to ${customerNumber} with assistant ${assistantId}`);

    // Build the call payload
    const callPayload: any = {
      assistantId,
      customer: {
        number: customerNumber,
        name: customerName || undefined,
      },
    };

    // Add phoneNumberId if provided
    if (phoneNumberId) {
      callPayload.phoneNumberId = phoneNumberId;
    }

    // Make the outbound call via Vapi API
    const response = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiPrivateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callPayload),
    });

    const responseText = await response.text();
    console.log('Vapi API response:', response.status, responseText);

    if (!response.ok) {
      let errorMessage = 'Failed to initiate call';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        errorMessage = responseText || errorMessage;
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, status: response.status }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callData = JSON.parse(responseText);
    console.log('Call initiated successfully:', callData.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        callId: callData.id,
        status: callData.status,
        message: `Call initiated to ${customerNumber}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in vapi-outbound-call:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
