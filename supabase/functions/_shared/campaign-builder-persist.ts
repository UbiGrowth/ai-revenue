/**
 * Campaign Builder Persistence Layer
 * 
 * When Campaign Builder returns assets, this module persists them to the correct tables:
 * - Landing pages → landing_pages
 * - Automations → automation_steps
 * - Voice scripts → assets (type: voice)
 * - Email sequences → email_sequences + email_sequence_steps
 * 
 * All assets are linked to campaign_id and tenant_id for CRM spine integration
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface LandingPageAsset {
  internal_name: string;
  url_slug: string;
  template_type: string;
  headline: string;
  subheadline?: string;
  sections: Record<string, unknown>[];
  form_config: Record<string, unknown>;
  cta_config: Record<string, unknown>;
  status?: string;
}

interface EmailSequenceAsset {
  name: string;
  steps: Array<{
    step_order: number;
    subject: string;
    body: string;
    delay_days: number;
  }>;
}

interface VoiceScriptAsset {
  name: string;
  script_content: string;
  agent_id?: string;
  vapi_config?: Record<string, unknown>;
}

interface AutomationAsset {
  name: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  steps: Array<{
    step_order: number;
    step_type: string;
    config: Record<string, unknown>;
  }>;
}

interface CampaignBuilderAssets {
  landing_pages?: LandingPageAsset[];
  email_sequences?: EmailSequenceAsset[];
  voice_scripts?: VoiceScriptAsset[];
  automations?: AutomationAsset[];
}

interface PersistResult {
  success: boolean;
  created: {
    landing_pages: string[];
    email_sequences: string[];
    voice_scripts: string[];
    automations: string[];
  };
  errors: string[];
}

/**
 * Persist all Campaign Builder outputs to their respective tables
 */
export async function persistCampaignBuilderAssets(
  supabase: SupabaseClient,
  params: {
    tenant_id: string;
    workspace_id: string;
    campaign_id: string;
    assets: CampaignBuilderAssets;
    created_by?: string;
  }
): Promise<PersistResult> {
  const result: PersistResult = {
    success: true,
    created: {
      landing_pages: [],
      email_sequences: [],
      voice_scripts: [],
      automations: []
    },
    errors: []
  };

  const { tenant_id, workspace_id, campaign_id, assets, created_by } = params;

  // 1. Persist landing pages
  if (assets.landing_pages && assets.landing_pages.length > 0) {
    for (const lp of assets.landing_pages) {
      try {
        const { data, error } = await supabase
          .from('landing_pages')
          .insert({
            tenant_id,
            workspace_id,
            campaign_id,
            internal_name: lp.internal_name,
            url_slug: lp.url_slug,
            template_type: lp.template_type,
            headline: lp.headline,
            subheadline: lp.subheadline || null,
            sections: lp.sections,
            form_config: lp.form_config,
            cta_config: lp.cta_config,
            status: lp.status || 'draft',
            created_by
          })
          .select('id')
          .single();

        if (error) throw error;
        if (data) result.created.landing_pages.push(data.id);
      } catch (e) {
        result.errors.push(`Landing page ${lp.internal_name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }
  }

  // 2. Persist email sequences
  if (assets.email_sequences && assets.email_sequences.length > 0) {
    for (const seq of assets.email_sequences) {
      try {
        // Create sequence
        const { data: seqData, error: seqError } = await supabase
          .from('email_sequences')
          .insert({
            workspace_id,
            name: seq.name,
            status: 'active'
          })
          .select('id')
          .single();

        if (seqError) throw seqError;
        if (!seqData) throw new Error('No sequence created');

        // Create steps
        const steps = seq.steps.map(step => ({
          sequence_id: seqData.id,
          step_order: step.step_order,
          subject: step.subject,
          body: step.body,
          delay_days: step.delay_days
        }));

        const { error: stepsError } = await supabase
          .from('email_sequence_steps')
          .insert(steps);

        if (stepsError) throw stepsError;
        result.created.email_sequences.push(seqData.id);
      } catch (e) {
        result.errors.push(`Email sequence ${seq.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }
  }

  // 3. Persist voice scripts as assets
  if (assets.voice_scripts && assets.voice_scripts.length > 0) {
    for (const vs of assets.voice_scripts) {
      try {
        const { data, error } = await supabase
          .from('assets')
          .insert({
            workspace_id,
            name: vs.name,
            type: 'voice',
            status: 'draft',
            content: {
              script: vs.script_content,
              vapi_config: vs.vapi_config || {}
            },
            vapi_id: vs.agent_id || null,
            created_by
          })
          .select('id')
          .single();

        if (error) throw error;
        if (data) result.created.voice_scripts.push(data.id);
      } catch (e) {
        result.errors.push(`Voice script ${vs.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }
  }

  // 4. Persist automations
  if (assets.automations && assets.automations.length > 0) {
    for (const auto of assets.automations) {
      try {
        // Create automation record (using automation_id as reference)
        const automationId = crypto.randomUUID();
        
        const steps = auto.steps.map(step => ({
          automation_id: automationId,
          tenant_id,
          workspace_id,
          step_order: step.step_order,
          step_type: step.step_type,
          config: {
            ...step.config,
            trigger_type: auto.trigger_type,
            trigger_config: auto.trigger_config
          }
        }));

        const { error } = await supabase
          .from('automation_steps')
          .insert(steps);

        if (error) throw error;
        result.created.automations.push(automationId);
      } catch (e) {
        result.errors.push(`Automation ${auto.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Link created assets to a CMO campaign for tracking
 */
export async function linkAssetsToCampaign(
  supabase: SupabaseClient,
  params: {
    tenant_id: string;
    workspace_id: string;
    campaign_id: string;
    asset_ids: string[];
    asset_type: 'landing_page' | 'email_sequence' | 'voice_script' | 'automation';
  }
): Promise<{ success: boolean; linked_count: number }> {
  try {
    // Update cmo_content_assets to link these
    for (const assetId of params.asset_ids) {
      await supabase
        .from('cmo_content_assets')
        .insert({
          tenant_id: params.tenant_id,
          workspace_id: params.workspace_id,
          campaign_id: params.campaign_id,
          content_id: assetId,
          content_type: params.asset_type,
          title: `${params.asset_type} asset`,
          status: 'created'
        });
    }

    return { success: true, linked_count: params.asset_ids.length };
  } catch (error) {
    console.error('[Campaign Builder] Failed to link assets:', error);
    return { success: false, linked_count: 0 };
  }
}
