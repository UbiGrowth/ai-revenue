// Agent History - Run logs display

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useCMOContext } from "@/contexts/CMOContext";

interface AgentRun {
  id: string;
  agent: string;
  mode: string | null;
  status: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

interface AgentHistoryProps {
  agentFilter?: string;
  limit?: number;
}

export function AgentHistory({ agentFilter, limit = 20 }: AgentHistoryProps) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const { workspaceId } = useCMOContext();

  const fetchRuns = async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from("agent_runs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (agentFilter) {
        query = query.eq("agent", agentFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRuns((data as AgentRun[]) || []);
    } catch (error) {
      console.error("Failed to fetch agent runs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and realtime subscription
  useEffect(() => {
    fetchRuns();

    if (!workspaceId) return;

    // Subscribe to realtime updates
    const channel = supabase
      .channel("agent-runs-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_runs",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRuns((prev) => [payload.new as AgentRun, ...prev].slice(0, limit));
          } else if (payload.eventType === "UPDATE") {
            setRuns((prev) =>
              prev.map((run) =>
                run.id === (payload.new as AgentRun).id ? (payload.new as AgentRun) : run
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, agentFilter, limit]);

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      failed: "destructive",
      running: "secondary",
      pending: "outline",
    };
    return (
      <Badge variant={variants[status || "pending"] || "outline"} className="text-xs">
        {status || "pending"}
      </Badge>
    );
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            Agent History
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchRuns} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {isLoading && runs.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No agent runs yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <Collapsible
                  key={run.id}
                  open={expandedRun === run.id}
                  onOpenChange={(open) => setExpandedRun(open ? run.id : null)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/50">
                      {expandedRun === run.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      {getStatusIcon(run.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{run.agent}</span>
                          {run.mode && (
                            <Badge variant="outline" className="text-xs">
                              {run.mode}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(run.created_at), "MMM d, HH:mm:ss")}
                          {run.duration_ms && (
                            <span className="ml-2">• {run.duration_ms}ms</span>
                          )}
                        </p>
                      </div>
                      {getStatusBadge(run.status)}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-8 mt-2 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                      {run.error_message && (
                        <div className="rounded bg-destructive/10 p-2">
                          <p className="text-xs font-medium text-destructive">Error</p>
                          <p className="text-xs text-destructive/80">{run.error_message}</p>
                        </div>
                      )}
                      {run.input && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Input</p>
                          <pre className="text-xs bg-background rounded p-2 overflow-auto max-h-[100px]">
                            {JSON.stringify(run.input, null, 2)}
                          </pre>
                        </div>
                      )}
                      {run.output && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Output</p>
                          <pre className="text-xs bg-background rounded p-2 overflow-auto max-h-[100px]">
                            {JSON.stringify(run.output, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
