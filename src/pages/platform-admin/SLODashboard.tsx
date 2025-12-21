import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Activity,
  Clock,
  Bell,
  Shield,
} from "lucide-react";

interface SLOConfig {
  id: string;
  metric_name: string;
  display_name: string;
  description: string;
  threshold: number;
  comparison: string;
  unit: string;
  alert_severity: string;
  is_hard_slo: boolean;
  enabled: boolean;
}

interface SLOMetric {
  id: string;
  metric_name: string;
  metric_value: number;
  threshold: number;
  is_breached: boolean;
  measured_at: string;
  details: Record<string, unknown>;
}

interface SLOAlert {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  metric_name: string;
  metric_value: number;
  threshold: number;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  details: Record<string, unknown>;
}

export default function SLODashboard() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [configs, setConfigs] = useState<SLOConfig[]>([]);
  const [latestMetrics, setLatestMetrics] = useState<Record<string, SLOMetric>>({});
  const [alerts, setAlerts] = useState<SLOAlert[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    // Check if user is platform admin via user_tenants
    const { data: userTenant } = await supabase
      .from("user_tenants")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    // For now, allow any authenticated user to view (can tighten later)
    // In production, you'd check is_platform_admin from profiles
    const isPlatformAdmin = userTenant?.role === "owner" || userTenant?.role === "admin";
    
    if (!isPlatformAdmin) {
      toast.error("Access denied. Admin role required.");
      navigate("/");
      return;
    }

    setIsAdmin(true);
  }

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch SLO configs using RPC or direct query
      const { data: configData, error: configError } = await supabase
        .from("slo_config")
        .select("*")
        .order("metric_name");
      
      if (configError) {
        console.error("Config fetch error:", configError);
        // If RLS blocks, show empty state
        setConfigs([]);
      } else {
        setConfigs((configData as unknown as SLOConfig[]) || []);
      }

      // Fetch latest metrics for each config
      const metricsMap: Record<string, SLOMetric> = {};
      for (const config of (configData || []) as unknown as SLOConfig[]) {
        const { data: metricData } = await supabase
          .from("slo_metrics")
          .select("*")
          .eq("metric_name", config.metric_name)
          .order("measured_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (metricData) {
          metricsMap[config.metric_name] = metricData as unknown as SLOMetric;
        }
      }
      setLatestMetrics(metricsMap);

      // Fetch recent alerts
      const { data: alertData } = await supabase
        .from("slo_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setAlerts((alertData as unknown as SLOAlert[]) || []);
    } catch (error) {
      console.error("Error fetching SLO data:", error);
      toast.error("Failed to fetch SLO data");
    } finally {
      setLoading(false);
    }
  }

  async function runMonitor() {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("slo-monitor", {
        body: { action: "check" },
      });

      if (error) throw error;

      toast.success(`Monitor completed: ${data.summary.passing}/${data.summary.total_metrics} passing`);
      await fetchData();
    } catch (error) {
      console.error("Error running monitor:", error);
      toast.error("Failed to run SLO monitor");
    } finally {
      setRefreshing(false);
    }
  }

  async function acknowledgeAlert(alertId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("slo_alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user?.id })
      .eq("id", alertId);

    if (error) {
      toast.error("Failed to acknowledge alert");
    } else {
      toast.success("Alert acknowledged");
      fetchData();
    }
  }

  async function resolveAlert(alertId: string) {
    const { error } = await supabase
      .from("slo_alerts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", alertId);

    if (error) {
      toast.error("Failed to resolve alert");
    } else {
      toast.success("Alert resolved");
      fetchData();
    }
  }

  function getSLOStatus(metric: SLOMetric | undefined) {
    if (!metric) return { icon: Clock, color: "text-muted-foreground", label: "No data" };
    if (metric.is_breached) return { icon: XCircle, color: "text-destructive", label: "Breached" };
    return { icon: CheckCircle, color: "text-green-500", label: "Passing" };
  }

  function formatValue(value: number, unit: string) {
    if (unit === "%") return `${value.toFixed(1)}%`;
    if (unit === "seconds") return `${value}s`;
    return value.toString();
  }

  const passingCount = Object.values(latestMetrics).filter((m) => !m.is_breached).length;
  const breachedCount = Object.values(latestMetrics).filter((m) => m.is_breached).length;
  const unresolvedAlerts = alerts.filter((a) => !a.resolved_at).length;

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBar />
      <main className="flex-1 container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              SLO Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Service Level Objectives monitoring and alerts
            </p>
          </div>
          <Button onClick={runMonitor} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Run Monitor
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total SLOs</p>
                  <p className="text-3xl font-bold">{configs.filter((c) => c.enabled).length}</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Passing</p>
                  <p className="text-3xl font-bold text-green-500">{passingCount}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Breached</p>
                  <p className="text-3xl font-bold text-destructive">{breachedCount}</p>
                </div>
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unresolved Alerts</p>
                  <p className="text-3xl font-bold text-yellow-500">{unresolvedAlerts}</p>
                </div>
                <Bell className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="alerts">
              Alerts {unresolvedAlerts > 0 && <Badge variant="destructive" className="ml-2">{unresolvedAlerts}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading SLO data...</div>
            ) : configs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No SLO configurations found. Run the monitor to initialize metrics.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {configs.filter((c) => c.enabled).map((config) => {
                  const metric = latestMetrics[config.metric_name];
                  const status = getSLOStatus(metric);
                  const StatusIcon = status.icon;

                  return (
                    <Card key={config.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {config.display_name}
                            {config.is_hard_slo && (
                              <Badge variant="destructive" className="text-xs">HARD</Badge>
                            )}
                          </CardTitle>
                          <StatusIcon className={`h-5 w-5 ${status.color}`} />
                        </div>
                        <CardDescription>{config.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-3xl font-bold">
                              {metric ? formatValue(metric.metric_value, config.unit) : "—"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Target: {config.comparison === "gte" ? "≥" : config.comparison === "lte" ? "≤" : "="}{" "}
                              {formatValue(config.threshold, config.unit)}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant={metric?.is_breached ? "destructive" : "secondary"}>
                              {status.label}
                            </Badge>
                            {metric && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(metric.measured_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        {metric?.details && Object.keys(metric.details).length > 0 && (
                          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                            {Object.entries(metric.details)
                              .filter(([key]) => !key.includes("tenant_retry"))
                              .slice(0, 3)
                              .map(([key, value]) => (
                                <span key={key} className="mr-3">
                                  {key.replace(/_/g, " ")}: <strong>{String(value)}</strong>
                                </span>
                              ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>SLO breaches and system alerts</CardDescription>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>No alerts recorded</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Severity</TableHead>
                        <TableHead>Metric</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell>
                            <Badge variant={alert.severity === "critical" ? "destructive" : "secondary"}>
                              {alert.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{alert.metric_name}</TableCell>
                          <TableCell className="max-w-xs truncate">{alert.message}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(alert.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {alert.resolved_at ? (
                              <Badge variant="outline" className="text-green-500">Resolved</Badge>
                            ) : alert.acknowledged_at ? (
                              <Badge variant="outline" className="text-yellow-500">Acknowledged</Badge>
                            ) : (
                              <Badge variant="destructive">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!alert.resolved_at && (
                              <div className="flex gap-2">
                                {!alert.acknowledged_at && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => acknowledgeAlert(alert.id)}
                                  >
                                    Ack
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => resolveAlert(alert.id)}
                                >
                                  Resolve
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle>SLO Configuration</CardTitle>
                <CardDescription>Define thresholds and alert settings</CardDescription>
              </CardHeader>
              <CardContent>
                {configs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No SLO configurations found.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Threshold</TableHead>
                        <TableHead>Comparison</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {configs.map((config) => (
                        <TableRow key={config.id}>
                          <TableCell className="font-medium">{config.display_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {config.description}
                          </TableCell>
                          <TableCell>{formatValue(config.threshold, config.unit)}</TableCell>
                          <TableCell>
                            {config.comparison === "gte" ? "≥" : config.comparison === "lte" ? "≤" : "="}
                          </TableCell>
                          <TableCell>
                            <Badge variant={config.alert_severity === "critical" ? "destructive" : "secondary"}>
                              {config.alert_severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {config.is_hard_slo ? (
                              <Badge variant="destructive">Hard</Badge>
                            ) : (
                              <Badge variant="outline">Soft</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={config.enabled ? "default" : "outline"}>
                              {config.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
