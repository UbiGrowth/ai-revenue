/**
 * Tenant Test Utility
 * Confirms each module runs independently under a single tenant
 */

import { runKernel, getExecModules, isModuleAvailable, getModuleManifest } from '../index';
import type { ExecModule, KernelRequest, KernelResponse } from '../types';

export interface TenantTestResult {
  module: ExecModule;
  available: boolean;
  status: 'active' | 'planned' | 'disabled';
  modes: string[];
  testResults: {
    mode: string;
    success: boolean;
    error?: string;
    duration_ms?: number;
  }[];
}

/**
 * Test a single module for a tenant
 */
export async function testModuleForTenant(
  moduleId: ExecModule,
  tenantId: string,
  workspaceId: string
): Promise<TenantTestResult> {
  const manifest = getModuleManifest(moduleId);
  const available = isModuleAvailable(moduleId);
  
  if (!manifest || !available) {
    return {
      module: moduleId,
      available: false,
      status: 'disabled',
      modes: [],
      testResults: [],
    };
  }

  const status = (manifest as any)._status || 'active';
  const modes = manifest.modes || [];
  const testResults: TenantTestResult['testResults'] = [];

  // Only run tests for active modules
  if (status === 'active') {
    for (const mode of modes) {
      try {
        const request: KernelRequest = {
          module: moduleId,
          mode: mode as any,
          tenant_id: tenantId,
          workspace_id: workspaceId,
          payload: { test: true, dry_run: true },
        };

        const response = await runKernel(request);
        testResults.push({
          mode,
          success: response.success,
          error: response.error,
          duration_ms: response.duration_ms,
        });
      } catch (err) {
        testResults.push({
          mode,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  }

  return {
    module: moduleId,
    available,
    status,
    modes,
    testResults,
  };
}

/**
 * Test all modules for a tenant
 */
export async function testAllModulesForTenant(
  tenantId: string,
  workspaceId: string
): Promise<TenantTestResult[]> {
  const modules = getExecModules();
  const results: TenantTestResult[] = [];

  for (const moduleId of modules) {
    const result = await testModuleForTenant(moduleId, tenantId, workspaceId);
    results.push(result);
  }

  return results;
}

/**
 * Quick health check for all modules (no execution, just registration)
 */
export function checkModuleHealth(): Record<ExecModule, { registered: boolean; status: string }> {
  const modules = getExecModules();
  const health: Record<string, { registered: boolean; status: string }> = {};

  for (const moduleId of modules) {
    const manifest = getModuleManifest(moduleId);
    health[moduleId] = {
      registered: !!manifest,
      status: manifest ? ((manifest as any)._status || 'active') : 'not_found',
    };
  }

  return health as Record<ExecModule, { registered: boolean; status: string }>;
}
