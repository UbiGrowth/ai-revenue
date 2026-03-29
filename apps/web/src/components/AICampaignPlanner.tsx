import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  Sparkles, 
  Target, 
  DollarSign, 
  Calendar, 
  TrendingUp,
  Mail,
  Video,
  MessageSquare,
  Phone,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface CampaignPlan {
  campaignName: string;
  strategy: string;
  channels: Array<{
    channel: string;
    priority: number;
    budgetPercent: number;
    rationale: string;
    contentTheme: string;
    messagingAngle: string;
    frequency: string;
    bestTiming: string;
  }>;
  targetSegments: Array<{
    name: string;
    description: string;
    priority: number;
    channels: string[];
  }>;
  schedule: {
    launchDate: string;
    duration: string;
    phases: Array<{
      name: string;
      duration: string;
      focus: string;
      channels: string[];
    }>;
  };
  kpis: Array<{
    metric: string;
    target: string;
    channel: string;
  }>;
  abTests: Array<{
    name: string;
    channel: string;
    variants: string[];
    metric: string;
  }>;
  estimatedResults: {
    impressions: string;
    clicks: string;
    conversions: string;
    roi: string;
  };
}

interface AICampaignPlannerProps {
  goal: string;
  vertical: string;
  budget?: number;
  onPlanGenerated: (plan: CampaignPlan) => void;
  onExecutePlan: (plan: CampaignPlan) => void;
}

const channelIcons: Record<string, any> = {
  email: Mail,
  social: MessageSquare,
  video: Video,
  voice: Phone,
};

const AICampaignPlanner = ({ goal, vertical, budget, onPlanGenerated, onExecutePlan }: AICampaignPlannerProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<CampaignPlan | null>(null);

  const generatePlan = async () => {
    if (!goal || !vertical) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a goal and vertical first.",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-campaign-planner", {
        body: { goal, vertical, budget },
      });

      if (error) throw error;

      if (data?.plan) {
        setPlan(data.plan);
        onPlanGenerated(data.plan);
        toast({
          title: "Strategy Generated",
          description: "AI has created your optimal campaign strategy.",
        });
      }
    } catch (error: any) {
      console.error("Error generating plan:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate campaign plan",
      });
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    const Icon = channelIcons[channel.toLowerCase()] || MessageSquare;
    return <Icon className="h-4 w-4" />;
  };

  const getPriorityColor = (priority: number) => {
    if (priority === 1) return "bg-green-500/10 text-green-500 border-green-500/20";
    if (priority === 2) return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    if (priority === 3) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI Campaign Strategist
        </CardTitle>
        <CardDescription>
          Let AI analyze your goal and create an optimized multi-channel strategy
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!plan ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Ready to Plan Your Campaign</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Our AI will analyze your goal, industry, and budget to create an optimal 
              multi-channel campaign strategy with timing, targeting, and budget allocation.
            </p>
            <Button onClick={generatePlan} disabled={loading || !goal || !vertical}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Generate AI Strategy
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Strategy Overview */}
            <div className="bg-background/50 rounded-lg p-4 border">
              <h4 className="font-semibold flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                {plan.campaignName}
              </h4>
              <p className="text-sm text-muted-foreground">{plan.strategy}</p>
            </div>

            {/* Channel Allocation */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Channel Allocation
              </h4>
              <div className="space-y-3">
                {plan.channels
                  .sort((a, b) => a.priority - b.priority)
                  .map((channel, idx) => (
                    <div key={idx} className="bg-background/50 rounded-lg p-3 border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getChannelIcon(channel.channel)}
                          <span className="font-medium capitalize">{channel.channel}</span>
                          <Badge variant="outline" className={getPriorityColor(channel.priority)}>
                            Priority {channel.priority}
                          </Badge>
                        </div>
                        <span className="font-semibold text-primary">{channel.budgetPercent}%</span>
                      </div>
                      <Progress value={channel.budgetPercent} className="h-2 mb-2" />
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Theme:</span> {channel.contentTheme}
                        </div>
                        <div>
                          <span className="font-medium">Timing:</span> {channel.bestTiming}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Schedule */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Campaign Schedule
              </h4>
              <div className="bg-background/50 rounded-lg p-4 border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm">Launch: {plan.schedule.launchDate}</span>
                  <Badge variant="secondary">{plan.schedule.duration}</Badge>
                </div>
                <div className="space-y-2">
                  {plan.schedule.phases.map((phase, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="font-medium">{phase.name}</span>
                      <span className="text-muted-foreground">({phase.duration})</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {phase.channels.join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Estimated Results */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Estimated Results
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-background/50 rounded-lg p-3 border text-center">
                  <div className="text-lg font-bold text-primary">{plan.estimatedResults.impressions}</div>
                  <div className="text-xs text-muted-foreground">Impressions</div>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border text-center">
                  <div className="text-lg font-bold text-primary">{plan.estimatedResults.clicks}</div>
                  <div className="text-xs text-muted-foreground">Clicks</div>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border text-center">
                  <div className="text-lg font-bold text-primary">{plan.estimatedResults.conversions}</div>
                  <div className="text-xs text-muted-foreground">Conversions</div>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border text-center">
                  <div className="text-lg font-bold text-green-500">{plan.estimatedResults.roi}</div>
                  <div className="text-xs text-muted-foreground">Est. ROI</div>
                </div>
              </div>
            </div>

            {/* A/B Tests */}
            {plan.abTests && plan.abTests.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  Recommended A/B Tests
                </h4>
                <div className="space-y-2">
                  {plan.abTests.map((test, idx) => (
                    <div key={idx} className="bg-background/50 rounded-lg p-3 border text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        {getChannelIcon(test.channel)}
                        <span className="font-medium">{test.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Test: {test.variants.join(" vs ")} • Measure: {test.metric}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={generatePlan} disabled={loading}>
                <Sparkles className="mr-2 h-4 w-4" />
                Regenerate Plan
              </Button>
              <Button onClick={() => onExecutePlan(plan)} className="flex-1">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Execute This Strategy
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AICampaignPlanner;
