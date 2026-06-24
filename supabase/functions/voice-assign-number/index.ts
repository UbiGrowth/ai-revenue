/**
 * Assign Phone Number to Tenant
 * POST /api/voice/assign-number
 * 
 * Assigns a phone number from the master pool to a tenant
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const {
      tenant_id,
      phone_number_e164_or_pool_id,
      purpose = 'outbound_sales',
    } = await req.json();

    if (!tenant_id || !phone_number_e164_or_pool_id) {
      throw new Error('Missing required fields: tenant_id, phone_number_e164_or_pool_id');
    }

    // Verify user belongs to tenant
    const { data: userTenant, error: tenantCheckError } = await supabaseClient
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .single();

    if (tenantCheckError || !userTenant) {
      throw new Error('User does not belong to specified tenant');
    }

    // 1. Check if input is pool ID or E164
    const isE164 = phone_number_e164_or_pool_id.startsWith('+');
    
    let poolPhone;
    
    if (isE164) {
      // Find in pool by E164
      const { data, error } = await supabaseClient
        .from('twilio_phone_pool')
        .select('*')
        .eq('phone_number_e164', phone_number_e164_or_pool_id)
        .eq('is_assigned', false)
        .single();
      
      if (error || !data) {
        throw new Error(`Phone number not available in pool: ${phone_number_e164_or_pool_id}`);
      }
      poolPhone = data;
    } else {
      // Find by pool ID
      const { data, error } = await supabaseClient
        .from('twilio_phone_pool')
        .select('*')
        .eq('id', phone_number_e164_or_pool_id)
        .eq('is_assigned', false)
        .single();
      
      if (error || !data) {
        throw new Error(`Pool phone not available: ${phone_number_e164_or_pool_id}`);
      }
      poolPhone = data;
    }

    // 2. Get tenant workspace
    const { data: tenant, error: tenantError } = await supabaseClient
      .from('tenants')
      .select('id, workspaces!inner(id)')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Tenant not found: ${tenant_id}`);
    }

    const workspace = (tenant as any).workspaces;
    const workspaceId = Array.isArray(workspace) ? workspace[0]?.id : workspace?.id;

    // 3. Create tenant assignment
    const { data: assignment, error: assignError } = await supabaseClient
      .from('tenant_phone_assignments')
      .insert({
        tenant_id: tenant_id,
        workspace_id: workspaceId,
        pool_phone_id: poolPhone.id,
        assigned_by: user.id,
        assignment_purpose: purpose,
        is_active: true,
      })
      .select('*')
      .single();

    if (assignError || !assignment) {
      throw new Error(`Failed to create phone assignment: ${assignError?.message}`);
    }

    // 4. Mark pool phone as assigned
    await supabaseClient
      .from('twilio_phone_pool')
      .update({
        is_assigned: true,
        assigned_to_tenant_id: tenant_id,
        assigned_at: new Date().toISOString(),
      })
      .eq('id', poolPhone.id);

    // 5. Create voice_phone_numbers record
    const { data: voiceNumber, error: numberError } = await supabaseClient
      .from('voice_phone_numbers')
      .insert({
        tenant_id: tenant_id,
        workspace_id: workspaceId,
        phone_number: poolPhone.phone_number_e164,
        provider: 'twilio',
        twilio_sid: poolPhone.twilio_sid,
        pool_assignment_id: assignment.id,
        friendly_name: poolPhone.friendly_name,
        is_active: true,
      })
      .select('*')
      .single();

    if (numberError || !voiceNumber) {
      throw new Error(`Failed to create voice_phone_numbers record: ${numberError?.message}`);
    }

    console.log(`✅ Phone number assigned: ${voiceNumber.phone_number} -> Tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        assignment: assignment,
        voice_number: voiceNumber,
        phone_number: poolPhone.phone_number_e164,
        message: 'Phone number assigned successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error assigning phone number:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
