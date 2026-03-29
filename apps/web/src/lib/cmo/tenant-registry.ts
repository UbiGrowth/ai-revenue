// OS Tenant Registry - External tenant configuration for AI CMO

import { supabase } from "@/integrations/supabase/client";

export interface OSTenantConfig {
  id: string;
  slug: string;
  name: string;
  tenant_id: string;
  description?: string;
  is_active: boolean;
  config: {
    source: string;
    funnels?: string[];
    channels?: string[];
    integration_type: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Get all registered OS tenants
 */
export async function getOSTenants(): Promise<OSTenantConfig[]> {
  const { data, error } = await supabase
    .from("os_tenant_registry")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data as unknown as OSTenantConfig[];
}

/**
 * Get a specific OS tenant by slug
 */
export async function getOSTenantBySlug(slug: string): Promise<OSTenantConfig | null> {
  const { data, error } = await supabase
    .from("os_tenant_registry")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }
  return data as unknown as OSTenantConfig;
}

/**
 * Get a specific OS tenant by tenant_id
 */
export async function getOSTenantById(tenantId: string): Promise<OSTenantConfig | null> {
  const { data, error } = await supabase
    .from("os_tenant_registry")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }
  return data as unknown as OSTenantConfig;
}

/**
 * Check if a tenant is an external OS tenant
 */
export async function isExternalOSTenant(tenantId: string): Promise<boolean> {
  const tenant = await getOSTenantById(tenantId);
  return tenant !== null && tenant.config.source === "external_os";
}

/**
 * Get tenant campaigns with AI CMO designation
 */
export async function getOSTenantCampaigns(tenantId: string) {
  const { data, error } = await supabase
    .from("cmo_campaigns")
    .select(`
      *,
      channels:cmo_campaign_channels(*)
    `)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  
  // Mark campaigns as AI CMO driven based on description
  return data?.map(campaign => ({
    ...campaign,
    is_ai_cmo_driven: campaign.description?.includes("AI CMO Driven") ?? false
  }));
}

/**
 * Get tenant funnels
 */
export async function getOSTenantFunnels(tenantId: string) {
  const { data, error } = await supabase
    .from("cmo_funnels")
    .select(`
      *,
      stages:cmo_funnel_stages(*)
    `)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get tenant agent runs (execution logs)
 */
export async function getOSTenantAgentRuns(tenantId: string, limit = 50) {
  const { data, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Log an agent run for an OS tenant
 */
export async function logOSTenantAgentRun(
  tenantId: string,
  workspaceId: string,
  agent: string,
  mode: string,
  input: Record<string, unknown>,
  output?: Record<string, unknown>,
  status: "pending" | "running" | "completed" | "failed" = "pending"
) {
  const insertData = {
    tenant_id: tenantId,
    workspace_id: workspaceId,
    agent,
    mode,
    status,
    input,
    output: output ?? {}
  };
  
  const { data, error } = await supabase
    .from("agent_runs")
    .insert(insertData as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// First Touch Coaching specific constants
export const FTS_TENANT = {
  slug: "first-touch-coaching",
  name: "First Touch Coaching",
  tenant_id: "4161ee82-be97-4fa8-9017-5c40be3ebe19"
} as const;
