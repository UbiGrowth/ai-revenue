/**
 * Module Health Check Utility
 * Automated verification for deployment readiness
 */

import { supabase } from '@/integrations/supabase/client';
import type { ExecModule } from '../types';
import { getModuleManifest, getExecModules } from '../index';

export interface HealthCheckResult {
  module: ExecModule;
  timestamp: string;
  checks: {
    manifest: CheckResult;
    tables: CheckResult;
    functions: CheckResult;
    agentRuns: CheckResult;
  };
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

export interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: Record<string, unknown>;
}

// Expected tables per module
const MODULE_TABLES: Record<ExecModule, string[]> = {
  ai_cmo: [
    'cmo_brand_profiles', 'cmo_icp_segments', 'cmo_offers',
    'cmo_marketing_plans', 'cmo_funnels', 'cmo_funnel_stages',
    'cmo_campaigns', 'cmo_campaign_channels', 'cmo_content_assets',
    'cmo_content_variants', 'cmo_calendar_events', 'cmo_metrics_snapshots',
    'cmo_weekly_summaries', 'cmo_recommendations'
  ],
  ai_cro: [
    'cro_targets', 'cro_forecasts', 'cro_deal_reviews', 'cro_recommendations'
  ],
  ai_cfo: [],
  ai_coo: []
};

/**
 * Check manifest registration
 */
function checkManifest(moduleId: ExecModule): CheckResult {
  const manifest = getModuleManifest(moduleId);
  
  if (!manifest) {
    return { status: 'fail', message: 'Manifest not registered' };
  }
  
  const status = (manifest as any)._status;
  if (status === 'planned') {
    return { 
      status: 'warn', 
      message: 'Module is planned, not active',
      details: { version: manifest.version, status }
    };
  }
  
  return { 
    status: 'pass', 
    message: 'Manifest registered and active',
    details: { 
      version: manifest.version, 
      modes: manifest.modes?.length || 0,
      agents: Object.keys(manifest.agents || {}).length
    }
  };
}

/**
 * Check database tables exist
 */
async function checkTables(moduleId: ExecModule): Promise<CheckResult> {
  const expectedTables = MODULE_TABLES[moduleId];
  
  if (expectedTables.length === 0) {
    return { status: 'warn', message: 'No tables defined for module' };
  }
  
  const missingTables: string[] = [];
  
  for (const table of expectedTables) {
    try {
      // Simple existence check - select 0 rows
      const { error } = await supabase
        .from(table as any)
        .select('id')
        .limit(0);
      
      if (error) {
        missingTables.push(table);
      }
    } catch {
      missingTables.push(table);
    }
  }
  
  if (missingTables.length === 0) {
    return { 
      status: 'pass', 
      message: `All ${expectedTables.length} tables exist`,
      details: { tables: expectedTables }
    };
  }
  
  if (missingTables.length < expectedTables.length / 2) {
    return {
      status: 'warn',
      message: `${missingTables.length} tables missing`,
      details: { missing: missingTables }
    };
  }
  
  return {
    status: 'fail',
    message: `${missingTables.length}/${expectedTables.length} tables missing`,
    details: { missing: missingTables }
  };
}

/**
 * Check edge functions are callable
 */
async function checkFunctions(moduleId: ExecModule): Promise<CheckResult> {
  const prefix = moduleId.replace('ai_', '');
  const kernelFunction = `${prefix}-kernel`;
  
  try {
    // Attempt to call kernel with dry_run
    const { error } = await supabase.functions.invoke(kernelFunction, {
      body: { mode: 'setup', tenant_id: 'health-check', workspace_id: 'health-check', payload: { dry_run: true } }
    });
    
    // 401/403 is expected without auth - function exists
    if (error?.message?.includes('401') || error?.message?.includes('403')) {
      return { status: 'pass', message: 'Kernel function deployed (auth required)' };
    }
    
    if (error) {
      return { 
        status: 'warn', 
        message: 'Kernel function returned error',
        details: { error: error.message }
      };
    }
    
    return { status: 'pass', message: 'Kernel function responding' };
  } catch (err) {
    return { 
      status: 'fail', 
      message: 'Kernel function not reachable',
      details: { error: err instanceof Error ? err.message : 'Unknown error' }
    };
  }
}

/**
 * Check agent runs for recent activity
 */
async function checkAgentRuns(moduleId: ExecModule): Promise<CheckResult> {
  const prefix = moduleId.replace('ai_', '');
  
  try {
    const { data, error } = await supabase
      .from('agent_runs')
      .select('status, created_at')
      .like('agent', `${prefix}-%`)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      return { status: 'warn', message: 'Could not query agent_runs', details: { error: error.message } };
    }
    
    if (!data || data.length === 0) {
      return { status: 'warn', message: 'No agent runs in last 24h' };
    }
    
    const total = data.length;
    const completed = data.filter(r => r.status === 'completed').length;
    const errors = data.filter(r => r.status === 'error').length;
    const successRate = Math.round((completed / total) * 100);
    
    if (successRate >= 95) {
      return { 
        status: 'pass', 
        message: `${successRate}% success rate (${total} runs)`,
        details: { total, completed, errors, successRate }
      };
    }
    
    if (successRate >= 80) {
      return {
        status: 'warn',
        message: `${successRate}% success rate - degraded`,
        details: { total, completed, errors, successRate }
      };
    }
    
    return {
      status: 'fail',
      message: `${successRate}% success rate - critical`,
      details: { total, completed, errors, successRate }
    };
  } catch {
    return { status: 'warn', message: 'Agent runs check failed' };
  }
}

/**
 * Run full health check for a module
 */
export async function runModuleHealthCheck(moduleId: ExecModule): Promise<HealthCheckResult> {
  const manifest = checkManifest(moduleId);
  const tables = await checkTables(moduleId);
  const functions = await checkFunctions(moduleId);
  const agentRuns = await checkAgentRuns(moduleId);
  
  const checks = { manifest, tables, functions, agentRuns };
  
  // Determine overall health
  const statuses = Object.values(checks).map(c => c.status);
  let overall: 'healthy' | 'degraded' | 'unhealthy';
  
  if (statuses.every(s => s === 'pass')) {
    overall = 'healthy';
  } else if (statuses.some(s => s === 'fail')) {
    overall = 'unhealthy';
  } else {
    overall = 'degraded';
  }
  
  return {
    module: moduleId,
    timestamp: new Date().toISOString(),
    checks,
    overall
  };
}

/**
 * Run health check for all active modules
 */
export async function runAllModuleHealthChecks(): Promise<HealthCheckResult[]> {
  const modules = getExecModules();
  const results: HealthCheckResult[] = [];
  
  for (const moduleId of modules) {
    const result = await runModuleHealthCheck(moduleId);
    results.push(result);
  }
  
  return results;
}

/**
 * Get health summary for dashboard
 */
export async function getHealthSummary(): Promise<{
  timestamp: string;
  modules: { id: ExecModule; status: string; successRate?: number }[];
  overall: 'healthy' | 'degraded' | 'unhealthy';
}> {
  const results = await runAllModuleHealthChecks();
  
  const modules = results.map(r => ({
    id: r.module,
    status: r.overall,
    successRate: (r.checks.agentRuns.details as any)?.successRate
  }));
  
  const overallStatuses = results.map(r => r.overall);
  let overall: 'healthy' | 'degraded' | 'unhealthy';
  
  if (overallStatuses.every(s => s === 'healthy')) {
    overall = 'healthy';
  } else if (overallStatuses.some(s => s === 'unhealthy')) {
    overall = 'unhealthy';
  } else {
    overall = 'degraded';
  }
  
  return {
    timestamp: new Date().toISOString(),
    modules,
    overall
  };
}
