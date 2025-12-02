import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Zap, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  DollarSign,
  Target,
  Clock,
  Lightbulb
} from "lucide-react";

interface Optimization {
  campaignId: string;
  campaignName: string;
  channel: string;
  performanceScore: number;
  performanceLevel: string;
  issues: Array<{
    issue: string;
    severity: string;
    impact: string;
  }>;
  recommendations: Array<{
    type: string;
    action: string;
    expectedImpact: string;
    priority: number;
    autoApplicable: boolean;
  }>;
  budgetRecommendation?: {
    currentBudget: number;
    recommendedBudget: number;
    reason: string;
  };
  predictedImprovement: {
    ctr: string;
    conversions: string;
    roi: string;
  };
}

interface CampaignOptimizerProps {
  campaignIds?: string[];
}

const CampaignOptimizer = ({ campaignIds }: CampaignOptimizerProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [optimizations, setOptimizations] = useState<Optimization[]>([]);
  const [appliedChanges, setAppliedChanges] = useState<any[]>([]);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runOptimization = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("campaign-optimizer", {
        body: { campaignIds, optimizeAll: !campaignIds },
      });

      if (error) throw error;

      if (data?.optimizations) {
        setOptimizations(data.optimizations);
        setAppliedChanges(data.appliedOptimizations || []);
        setLastRun(data.timestamp);
        
        toast({
          title: "Optimization Complete",
          description: `Analyzed ${data.campaignsAnalyzed} campaigns, auto-applied ${data.appliedOptimizations?.length || 0} changes.`,
        });
      }
    } catch (error: any) {
      console.error("Error running optimization:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to run optimization",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceColor = (level: string) => {
    switch (level) {
      case "excellent": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "good": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "average": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "poor": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "high": return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "medium": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "budget": return <DollarSign className="h-4 w-4" />;
      case "targeting": return <Target className="h-4 w-4" />;
      case "timing": return <Clock className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Self-Optimizing Engine
            </CardTitle>
            <CardDescription>
              AI continuously analyzes and optimizes your campaigns
            </CardDescription>
          </div>
          <Button onClick={runOptimization} disabled={loading} size="sm">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">{loading ? "Analyzing..." : "Run Optimization"}</span>
          </Button>
        </div>
        {lastRun && (
          <p className="text-xs text-muted-foreground mt-2">
            Last run: {new Date(lastRun).toLocaleString()}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {optimizations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Run Optimization" to analyze your campaigns</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {/* Applied Changes Summary */}
              {appliedChanges.length > 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-green-500 flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4" />
                    Auto-Applied Optimizations
                  </h4>
                  <div className="space-y-1 text-sm">
                    {appliedChanges.map((change, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span>
                          {change.action === "budget_adjusted" && 
                            `Budget adjusted from $${change.from} to $${change.to}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Campaign Optimizations */}
              {optimizations.map((opt, idx) => (
                <Card key={idx} className="border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{opt.campaignName}</CardTitle>
                        <CardDescription className="capitalize">{opt.channel} Campaign</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getPerformanceColor(opt.performanceLevel)}>
                          {opt.performanceLevel}
                        </Badge>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{opt.performanceScore}</div>
                          <div className="text-xs text-muted-foreground">Score</div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Performance Bar */}
                    <Progress value={opt.performanceScore} className="h-2" />

                    {/* Issues */}
                    {opt.issues && opt.issues.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium mb-2">Issues Identified</h5>
                        <div className="space-y-2">
                          {opt.issues.map((issue, iIdx) => (
                            <div key={iIdx} className="flex items-start gap-2 text-sm bg-background/50 rounded p-2">
                              {getSeverityIcon(issue.severity)}
                              <div>
                                <span className="font-medium">{issue.issue}</span>
                                <p className="text-xs text-muted-foreground">{issue.impact}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {opt.recommendations && opt.recommendations.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium mb-2">Recommendations</h5>
                        <div className="space-y-2">
                          {opt.recommendations
                            .sort((a, b) => a.priority - b.priority)
                            .slice(0, 3)
                            .map((rec, rIdx) => (
                              <div key={rIdx} className="flex items-start gap-2 text-sm bg-primary/5 rounded p-2 border border-primary/10">
                                {getTypeIcon(rec.type)}
                                <div className="flex-1">
                                  <span className="font-medium">{rec.action}</span>
                                  <p className="text-xs text-muted-foreground">{rec.expectedImpact}</p>
                                </div>
                                {rec.autoApplicable && (
                                  <Badge variant="secondary" className="text-xs">Auto</Badge>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Budget Recommendation */}
                    {opt.budgetRecommendation && (
                      <div className="bg-background/50 rounded-lg p-3 border">
                        <h5 className="text-sm font-medium flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4 text-primary" />
                          Budget Recommendation
                        </h5>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-lg font-bold">${opt.budgetRecommendation.currentBudget}</div>
                            <div className="text-xs text-muted-foreground">Current</div>
                          </div>
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <div className="text-center">
                            <div className="text-lg font-bold text-primary">${opt.budgetRecommendation.recommendedBudget}</div>
                            <div className="text-xs text-muted-foreground">Recommended</div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{opt.budgetRecommendation.reason}</p>
                      </div>
                    )}

                    {/* Predicted Improvement */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center bg-green-500/5 rounded p-2 border border-green-500/10">
                        <TrendingUp className="h-4 w-4 text-green-500 mx-auto mb-1" />
                        <div className="text-sm font-bold text-green-500">{opt.predictedImprovement?.ctr}</div>
                        <div className="text-xs text-muted-foreground">CTR Lift</div>
                      </div>
                      <div className="text-center bg-blue-500/5 rounded p-2 border border-blue-500/10">
                        <Target className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                        <div className="text-sm font-bold text-blue-500">{opt.predictedImprovement?.conversions}</div>
                        <div className="text-xs text-muted-foreground">Conversions</div>
                      </div>
                      <div className="text-center bg-primary/5 rounded p-2 border border-primary/10">
                        <DollarSign className="h-4 w-4 text-primary mx-auto mb-1" />
                        <div className="text-sm font-bold text-primary">{opt.predictedImprovement?.roi}</div>
                        <div className="text-xs text-muted-foreground">ROI Gain</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default CampaignOptimizer;
