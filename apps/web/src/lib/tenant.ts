/**
 * Tenant Context Utilities
 * Centralized tenant resolution for all API calls
 */

import { supabase } from "@/integrations/supabase/client";

export interface TenantContext {
  tenantId: string;
  userId: string;
  workspaceId?: string;
}

/**
 * Requires a tenant_id from multiple sources in priority order.
 * Throws a clear error if no tenant can be resolved.
 */
export function requireTenantId(input: {
  campaignTenantId?: string | null;
  activeTenantId?: string | null;
  routeTenantId?: string | null;
  workspaceId?: string | null;
}): string {
  const tenantId =
    input.campaignTenantId ||
    input.activeTenantId ||
    input.routeTenantId ||
    input.workspaceId;

  if (!tenantId) {
    throw new Error(
      "No Tenant: Unable to determine tenant context. Please select a workspace or ensure you have tenant access."
    );
  }

  return tenantId;
}

/**
 * Gets the current user's tenant context from the database.
 * Returns null values instead of throwing if tenant not found.
 */
export async function getTenantContextSafe(): Promise<{
  userId: string | null;
  tenantId: string | null;
  workspaceId: string | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { userId: null, tenantId: null, workspaceId: null };
    }

    // Get user's primary tenant
    const { data: userTenant } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Get user's default workspace
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    // Tenant ID can come from user_tenants or fall back to user.id
    const tenantId = userTenant?.tenant_id || user.id;

    return {
      userId: user.id,
      tenantId,
      workspaceId: workspace?.id || null,
    };
  } catch (error) {
    console.error("Error getting tenant context:", error);
    return { userId: null, tenantId: null, workspaceId: null };
  }
}

/**
 * Gets the current user's tenant context from the database.
 * Throws if user is not authenticated or has no tenant.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Get user's primary tenant
  const { data: userTenant } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Get user's default workspace
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  // Tenant ID can come from user_tenants or fall back to user.id
  const tenantId = userTenant?.tenant_id || user.id;

  if (!tenantId) {
    throw new Error(
      "No Tenant: Unable to determine tenant context. Please contact support."
    );
  }

  return {
    userId: user.id,
    tenantId,
    workspaceId: workspace?.id,
  };
}

/**
 * Validates that a campaign belongs to the specified tenant.
 */
export async function validateCampaignTenant(
  campaignId: string,
  tenantId: string
): Promise<boolean> {
  const { data: campaign, error } = await supabase
    .from("cmo_campaigns")
    .select("tenant_id")
    .eq("id", campaignId)
    .single();

  if (error || !campaign) {
    return false;
  }

  return campaign.tenant_id === tenantId;
}
