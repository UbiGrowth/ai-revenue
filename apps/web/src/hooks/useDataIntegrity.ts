/**
 * Data Integrity Hook
 * 
 * STRICT RULES ENFORCED:
 * 1. If demo_mode = false, dashboards must only query live tenant data
 * 2. Demo/seeded data must never be shown in live mode
 * 3. If Stripe is not connected, revenue = 0 and ROI = "—"
 * 4. If analytics providers (GA/Meta/LinkedIn) are not connected, impressions and clicks = 0
 * 5. Every query must be filtered by tenant_id AND data_mode
 * 6. If no events exist, return empty states — never synthetic numbers
 * 
 * Hard fail if demo data leaks into live mode.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

export interface IntegrationStatus {
  stripe: boolean;
  googleAnalytics: boolean;
  metaAds: boolean;
  linkedInAds: boolean;
  email: boolean;
}

export interface DataIntegrityContext {
  tenantId: string | null;
  workspaceId: string | null;
  metricsMode: "real" | "demo";
  integrations: IntegrationStatus;
  loading: boolean;
  error: string | null;
  
  // SINGLE SOURCE OF TRUTH: Dashboard readiness
  // When false: No KPI math, no conversion rates, no win/loss, no ROI - show placeholders only
  canShowLiveMetrics: boolean;
  
  // Enforcement helpers (derived from canShowLiveMetrics + provider status)
  shouldShowRevenue: boolean;
  shouldShowImpressions: boolean;
  isLiveMode: boolean;
  isDemoMode: boolean;
  
  // Safe data formatters
  formatRevenue: (value: number) => string;
  formatROI: (value: number) => string;
  formatImpressions: (value: number) => number;
  formatClicks: (value: number) => number;
  
  // Query filter helper
  getTenantFilter: () => { tenant_id: string } | null;
  
  // Guard function - throws if demo data leaks into live mode
  guardDemoLeak: (responseMetaDataMode?: string) => void;
  
  // Refresh function
  refresh: () => Promise<void>;
}

const DEFAULT_INTEGRATIONS: IntegrationStatus = {
  stripe: false,
  googleAnalytics: false,
  metaAds: false,
  linkedInAds: false,
  email: false,
};

export function useDataIntegrity(): DataIntegrityContext {
  const {
    workspaceId,
    workspace,
    demoMode,
    stripeConnected,
    analyticsConnected,
    isLoading: workspaceLoading,
  } = useWorkspaceContext();

  const tenantId = workspace?.tenant_id ?? null;
  const metricsMode: "real" | "demo" = demoMode ? "demo" : "real";
  const [integrations, setIntegrations] = useState<IntegrationStatus>(DEFAULT_INTEGRATIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrityContext = useCallback(async () => {
    try {
      if (workspaceLoading) {
        setLoading(true);
        return;
      }

      setLoading(true);
      setError(null);

      // No workspace selected => return clean empty state (force user selection elsewhere)
      if (!workspaceId) {
        setIntegrations(DEFAULT_INTEGRATIONS);
        return;
      }

      // Check integrations scoped to the ACTIVE workspace only
      const integrationStatus: IntegrationStatus = { ...DEFAULT_INTEGRATIONS };

      // Use centralized WorkspaceContext as the source of truth for provider connectivity
      integrationStatus.stripe = stripeConnected === true;
      integrationStatus.googleAnalytics = analyticsConnected === true;

      // Check social/analytics integrations
      if (workspaceId) {
        const { data: socialIntegrations } = await supabase
          .from("social_integrations")
          .select("platform, is_active")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true);

        for (const integration of socialIntegrations || []) {
          if (integration.platform === "meta" || integration.platform === "facebook") {
            integrationStatus.metaAds = true;
          } else if (integration.platform === "linkedin") {
            integrationStatus.linkedInAds = true;
          }
        }
      }

      // Check email connection
      const { data: emailSettingsArr } = await supabase
        .from("ai_settings_email")
        .select("is_connected")
        .eq("tenant_id", workspaceId)
        .limit(1);

      const emailSettings = emailSettingsArr?.[0];
      
      integrationStatus.email = emailSettings?.is_connected === true;

      setIntegrations(integrationStatus);
    } catch (err) {
      console.error("[useDataIntegrity] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, workspaceLoading, stripeConnected, analyticsConnected]);

  useEffect(() => {
    fetchIntegrityContext();
  }, [fetchIntegrityContext]);

  // Computed properties
  const isLiveMode = metricsMode === "real";
  const isDemoMode = metricsMode === "demo";
  
  // SINGLE SOURCE OF TRUTH: Dashboard readiness
  // When false: No KPI math, no conversion rates, no win/loss, no ROI - show placeholders only
  // True when: demo mode is ON, or when in live mode with at least one provider connected
  const hasAnyProvider = integrations.stripe || 
    integrations.googleAnalytics || 
    integrations.metaAds || 
    integrations.linkedInAds ||
    integrations.email;
  const canShowLiveMetrics = isDemoMode || (isLiveMode && hasAnyProvider);
  
  // RULE 3: If Stripe is not connected, revenue = 0
  const shouldShowRevenue = isDemoMode || integrations.stripe;
  
  // RULE 4: If analytics providers not connected, impressions/clicks = 0
  const shouldShowImpressions = isDemoMode || 
    integrations.googleAnalytics || 
    integrations.metaAds || 
    integrations.linkedInAds;

  // Safe formatters that enforce rules
  const formatRevenue = useCallback((value: number): string => {
    // RULE 3: If Stripe not connected in live mode, return 0
    if (isLiveMode && !integrations.stripe) {
      return "$0.00";
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  }, [isLiveMode, integrations.stripe]);

  const formatROI = useCallback((value: number): string => {
    // RULE 3: If Stripe not connected in live mode, return "—"
    if (isLiveMode && !integrations.stripe) {
      return "—";
    }
    return `${value.toFixed(1)}%`;
  }, [isLiveMode, integrations.stripe]);

  const formatImpressions = useCallback((value: number): number => {
    // RULE 4: If no analytics providers connected in live mode, return 0
    if (isLiveMode && !shouldShowImpressions) {
      return 0;
    }
    return value;
  }, [isLiveMode, shouldShowImpressions]);

  const formatClicks = useCallback((value: number): number => {
    // RULE 4: If no analytics providers connected in live mode, return 0
    if (isLiveMode && !shouldShowImpressions) {
      return 0;
    }
    return value;
  }, [isLiveMode, shouldShowImpressions]);

  // RULE 5: Query filter helper
  const getTenantFilter = useCallback(() => {
    if (!tenantId) return null;
    return { tenant_id: tenantId };
  }, [tenantId]);

  // GUARD: One-line check to prevent demo data leaking into live mode
  const guardDemoLeak = useCallback((responseMetaDataMode?: string) => {
    if (isLiveMode && responseMetaDataMode === 'demo') {
      console.error('[DATA INTEGRITY] DEMO DATA LEAK BLOCKED: Live mode received demo data');
      throw new Error('DEMO DATA LEAK: blocked');
    }
  }, [isLiveMode]);

  return {
    tenantId,
    workspaceId,
    metricsMode,
    integrations,
    loading,
    error,
    canShowLiveMetrics,
    shouldShowRevenue,
    shouldShowImpressions,
    isLiveMode,
    isDemoMode,
    formatRevenue,
    formatROI,
    formatImpressions,
    formatClicks,
    getTenantFilter,
    guardDemoLeak,
    refresh: fetchIntegrityContext,
  };
}

/**
 * HARD FAIL: Validation function to detect demo data leaks
 * Call this before displaying any metrics in live mode
 */
export function validateDataIntegrity(
  metricsMode: "real" | "demo",
  dataSource: "demo" | "live" | "unknown"
): void {
  if (metricsMode === "real" && dataSource === "demo") {
    console.error("[DATA INTEGRITY VIOLATION] Demo data leaked into live mode!");
    throw new Error("DATA_INTEGRITY_VIOLATION: Demo data cannot be shown in live mode");
  }
}
