/**
 * Deploy Voice Agent from Template
 * POST /api/voice/deploy-template
 * 
 * Creates a new voice agent for a tenant from a template
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
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured');
    }

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
      template_id,
      tenant_id,
      overrides = {},
    } = await req.json();

    if (!template_id || !tenant_id) {
      throw new Error('Missing required fields: template_id, tenant_id');
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

    // 1. Fetch template
    const { data: template, error: templateError } = await supabaseClient
      .from('voice_agent_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      throw new Error(`Template not found: ${template_id}`);
    }

    // 2. Get tenant workspace
    const { data: tenant, error: tenantError } = await supabaseClient
      .from('tenants')
      .select('id, name, workspaces!inner(id)')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Tenant not found: ${tenant_id}`);
    }

    const workspace = (tenant as any).workspaces;
    const workspaceId = Array.isArray(workspace) ? workspace[0]?.id : workspace?.id;
    
    if (!workspaceId) {
      throw new Error(`No workspace found for tenant: ${tenant_id}`);
    }

    // 3. Merge template with overrides
    const agentConfig = {
      name: overrides.name || template.name,
      system_prompt: overrides.system_prompt || template.system_prompt,
      first_message: overrides.first_message || template.first_message,
      voice_id: overrides.voice_id || template.voice_id || 'EXAVITQu4vr4xnSDxMaL',
      language: overrides.language || template.language || 'en',
      end_call_phrases: overrides.end_call_phrases || template.end_call_phrases || [],
    };

    // 4. Create agent in ElevenLabs
    const createResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: agentConfig.name,
        conversation_config: {
          agent: {
            prompt: {
              prompt: agentConfig.system_prompt,
            },
            first_message: agentConfig.first_message,
            language: agentConfig.language,
          },
          tts: {
            voice_id: agentConfig.voice_id,
          },
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`ElevenLabs agent creation failed: ${errorText}`);
    }

    const agentData = await createResponse.json();
    const vendorAgentId = agentData.agent_id;

    // 5. Store in voice_agents table
    const { data: voiceAgent, error: insertError } = await supabaseClient
      .from('voice_agents')
      .insert({
        tenant_id: tenant_id,
        workspace_id: workspaceId,
        name: agentConfig.name,
        provider: 'elevenlabs',
        elevenlabs_agent_id: vendorAgentId,
        template_id: template_id,
        use_case: template.use_case,
        system_prompt: agentConfig.system_prompt,
        first_message: agentConfig.first_message,
        voice_id: agentConfig.voice_id,
        model: 'elevenlabs-conversational',
        config: {
          ...agentConfig,
          ...(overrides.config || {}),
        },
        is_active: true,
      })
      .select('*')
      .single();

    if (insertError || !voiceAgent) {
      throw new Error(`Failed to store agent in database: ${insertError?.message}`);
    }

    console.log(`✅ Agent deployed: ${voiceAgent.id} (ElevenLabs: ${vendorAgentId})`);

    return new Response(
      JSON.stringify({
        success: true,
        agent: voiceAgent,
        vendor_agent_id: vendorAgentId,
        message: 'Agent deployed successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error deploying agent:', error);
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
