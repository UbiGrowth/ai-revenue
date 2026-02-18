// CMO Realtime Hooks - Live Supabase subscriptions

import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cmoKeys } from "./useCMO";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

interface RealtimeOptions {
  workspaceId: string;
  tables?: string[];
  onEvent?: (table: string, event: RealtimeEvent, payload: unknown) => void;
}

const CMO_TABLES = [
  "cmo_brand_profiles",
  "cmo_icp_segments",
  "cmo_offers",
  "cmo_marketing_plans",
  "cmo_funnels",
  "cmo_funnel_stages",
  "cmo_campaigns",
  "cmo_campaign_channels",
  "cmo_content_assets",
  "cmo_content_variants",
  "cmo_metrics_snapshots",
  "cmo_weekly_summaries",
  "cmo_recommendations",
  "cmo_calendar_events",
  "agent_runs",
];

// Map table names to query keys for cache invalidation
const TABLE_TO_QUERY_KEY: Record<string, (workspaceId: string) => readonly unknown[]> = {
  cmo_brand_profiles: (wid) => cmoKeys.brandProfiles(wid),
  cmo_icp_segments: (wid) => cmoKeys.icpSegments(wid),
  cmo_offers: (wid) => cmoKeys.offers(wid),
  cmo_marketing_plans: (wid) => cmoKeys.marketingPlans(wid),
  cmo_funnels: (wid) => cmoKeys.funnels(wid),
  cmo_campaigns: (wid) => cmoKeys.campaigns(wid),
  cmo_content_assets: (wid) => cmoKeys.contentAssets(wid),
  cmo_metrics_snapshots: (wid) => cmoKeys.metrics(wid),
  cmo_weekly_summaries: (wid) => cmoKeys.weeklySummaries(wid),
  cmo_recommendations: (wid) => cmoKeys.recommendations(wid),
  cmo_calendar_events: (wid) => cmoKeys.calendarEvents(wid),
};

/**
 * Hook to subscribe to realtime updates for CMO tables
 * Automatically invalidates React Query cache on changes
 */
export function useCMORealtime({
  workspaceId,
  tables = CMO_TABLES,
  onEvent,
}: RealtimeOptions) {
  const queryClient = useQueryClient();

  const invalidateTable = useCallback(
    (table: string) => {
      const getQueryKey = TABLE_TO_QUERY_KEY[table];
      if (getQueryKey) {
        queryClient.invalidateQueries({ queryKey: getQueryKey(workspaceId) });
      } else {
        // Fallback: invalidate all CMO queries
        queryClient.invalidateQueries({ queryKey: cmoKeys.all });
      }
    },
    [queryClient, workspaceId]
  );

  useEffect(() => {
    if (!workspaceId) return;

    const channels = tables.map((table) => {
      const channel = supabase
        .channel(`cmo-${table}-${workspaceId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `workspace_id=eq.${workspaceId}`,
          },
          (payload) => {
            const event = payload.eventType as RealtimeEvent;
            console.log(`[CMO Realtime] ${table} ${event}:`, payload);
            
            // Invalidate cache
            invalidateTable(table);
            
            // Call custom handler
            onEvent?.(table, event, payload.new || payload.old);
          }
        )
        .subscribe();

      return channel;
    });

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [workspaceId, tables, invalidateTable, onEvent]);
}

/**
 * Hook to subscribe to agent run updates
 */
export function useAgentRunsRealtime(
  workspaceId: string,
  onRunUpdate?: (run: unknown) => void
) {
  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel(`agent-runs-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_runs",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          console.log("[Agent Run]", payload.eventType, payload);
          onRunUpdate?.(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, onRunUpdate]);
}

/**
 * Hook to subscribe to calendar events (for live scheduling updates)
 */
export function useCalendarRealtime(
  workspaceId: string,
  onEventChange?: (event: unknown, type: RealtimeEvent) => void
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel(`calendar-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cmo_calendar_events",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const event = payload.eventType as RealtimeEvent;
          queryClient.invalidateQueries({ queryKey: cmoKeys.calendarEvents(workspaceId) });
          onEventChange?.(payload.new || payload.old, event);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, queryClient, onEventChange]);
}

/**
 * Hook to subscribe to metrics updates (for live dashboard)
 */
export function useMetricsRealtime(
  workspaceId: string,
  campaignId?: string,
  onMetricUpdate?: (metric: unknown) => void
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;

    const filter = campaignId
      ? `workspace_id=eq.${workspaceId},campaign_id=eq.${campaignId}`
      : `workspace_id=eq.${workspaceId}`;

    const channel = supabase
      .channel(`metrics-${workspaceId}-${campaignId || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cmo_metrics_snapshots",
          filter,
        },
        (payload) => {
          queryClient.invalidateQueries({ 
            queryKey: cmoKeys.metrics(workspaceId, campaignId ? { campaignId } : undefined) 
          });
          onMetricUpdate?.(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, campaignId, queryClient, onMetricUpdate]);
}
