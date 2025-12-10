import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with user's JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user from JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = user.id;

    // Parse request body for leadId and status
    const body = await req.json();
    const { leadId, status } = body;

    if (!leadId) {
      return new Response(
        JSON.stringify({ error: 'Lead ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!status) {
      return new Response(
        JSON.stringify({ error: 'Status is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate status value
    const validStatuses = ['new', 'contacted', 'working', 'qualified', 'unqualified', 'converted', 'lost'];
    if (!validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the lead to get contact_id and verify ownership
    const { data: lead, error: leadError } = await supabase
      .from('crm_leads')
      .select('id, contact_id, status')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .single();

    if (leadError || !lead) {
      console.error('[ai-cmo-lead-status] Lead fetch error:', leadError);
      return new Response(
        JSON.stringify({ error: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const previousStatus = lead.status;

    // Update lead status
    const { error: updateError } = await supabase
      .from('crm_leads')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('[ai-cmo-lead-status] Lead update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update lead status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log activity for status change
    const { error: activityError } = await supabase
      .from('crm_activities')
      .insert({
        tenant_id: tenantId,
        contact_id: lead.contact_id,
        lead_id: leadId,
        activity_type: 'status_change',
        meta: {
          previous_status: previousStatus,
          new_status: status,
          source: 'manual_ui'
        }
      });

    if (activityError) {
      console.error('[ai-cmo-lead-status] Activity insert error:', activityError);
      // Don't fail the request if activity logging fails
    }

    console.log(`[ai-cmo-lead-status] Lead ${leadId} status updated: ${previousStatus} -> ${status}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        lead: { 
          id: leadId, 
          status,
          previousStatus 
        } 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ai-cmo-lead-status] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
