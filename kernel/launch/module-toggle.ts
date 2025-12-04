/**
 * Module Launch Toggle
 * Control visibility of each AI module for beta users
 */

import { supabase } from '@/integrations/supabase/client';
import type { ExecModule } from '../types';
import { getModuleManifest, getExecModules } from '../index';

export interface ModuleVisibility {
  module_id: ExecModule;
  enabled: boolean;
  beta_only: boolean;
  rollout_percentage: number;
}

export interface TenantModuleAccess {
  tenant_id: string;
  modules: ModuleVisibility[];
}

/**
 * Default module visibility settings
 */
export const DEFAULT_MODULE_VISIBILITY: Record<ExecModule, ModuleVisibility> = {
  ai_cmo: { module_id: 'ai_cmo', enabled: true, beta_only: false, rollout_percentage: 100 },
  ai_cro: { module_id: 'ai_cro', enabled: true, beta_only: false, rollout_percentage: 100 },
  ai_cfo: { module_id: 'ai_cfo', enabled: false, beta_only: true, rollout_percentage: 0 },
  ai_coo: { module_id: 'ai_coo', enabled: false, beta_only: true, rollout_percentage: 0 },
};

/**
 * Check if a module is enabled for a tenant
 */
export async function isModuleEnabledForTenant(
  moduleId: ExecModule,
  tenantId: string
): Promise<boolean> {
  // Check manifest status first
  const manifest = getModuleManifest(moduleId);
  if (!manifest) return false;
  
  const manifestStatus = (manifest as any)._status;
  if (manifestStatus === 'planned') return false;

  // Check tenant-specific override
  const { data } = await supabase
    .from('tenant_module_access')
    .select('enabled')
    .eq('tenant_id', tenantId)
    .eq('module_id', moduleId)
    .single();

  if (data) return data.enabled;

  // Fall back to default visibility
  return DEFAULT_MODULE_VISIBILITY[moduleId]?.enabled ?? false;
}

/**
 * Get all enabled modules for a tenant
 */
export async function getEnabledModulesForTenant(
  tenantId: string
): Promise<ExecModule[]> {
  const modules = getExecModules();
  const enabled: ExecModule[] = [];

  for (const moduleId of modules) {
    const isEnabled = await isModuleEnabledForTenant(moduleId, tenantId);
    if (isEnabled) enabled.push(moduleId);
  }

  return enabled;
}

/**
 * Toggle module for a tenant (admin function)
 */
export async function toggleModuleForTenant(
  moduleId: ExecModule,
  tenantId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('tenant_module_access')
      .upsert({
        tenant_id: tenantId,
        module_id: moduleId,
        enabled,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,module_id',
      });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Bulk enable modules for beta rollout
 */
export async function enableModulesForBeta(
  tenantIds: string[],
  moduleIds: ExecModule[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const tenantId of tenantIds) {
    for (const moduleId of moduleIds) {
      const result = await toggleModuleForTenant(moduleId, tenantId, true);
      if (result.success) success++;
      else failed++;
    }
  }

  return { success, failed };
}

/**
 * Get module visibility summary for dashboard
 */
export function getModuleVisibilitySummary(): {
  module: ExecModule;
  name: string;
  status: string;
  defaultEnabled: boolean;
}[] {
  return getExecModules().map(moduleId => {
    const manifest = getModuleManifest(moduleId);
    const visibility = DEFAULT_MODULE_VISIBILITY[moduleId];
    
    return {
      module: moduleId,
      name: manifest?.name || moduleId,
      status: (manifest as any)?._status || 'active',
      defaultEnabled: visibility?.enabled ?? false,
    };
  });
}
