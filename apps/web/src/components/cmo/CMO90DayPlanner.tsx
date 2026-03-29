import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar,
  Target,
  DollarSign,
  TrendingUp,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Megaphone,
  FileText,
  Save
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MarketingPlan {
  plan_name: string;
  executive_summary: string;
  primary_objectives: Array<{
    objective: string;
    target_metric: string;
    baseline: string;
    goal: string;
    priority: string;
  }>;
  key_metrics: Array<{
    metric_name: string;
    current_value: string;
    target_value: string;
    measurement_frequency: string;
  }>;
  budget_allocation: {
    total_budget: number;
    currency: string;
    breakdown: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
  };
  month_1_plan: MonthPlan;
  month_2_plan: MonthPlan;
  month_3_plan: MonthPlan;
  channel_mix: Array<{
    channel: string;
    role: string;
    budget_percentage: number;
    target_icps: string[];
    kpis: string[];
  }>;
  campaign_themes: Array<{
    theme_name: string;
    description: string;
    duration_weeks: number;
    start_week: number;
    target_icps: string[];
  }>;
  risks_mitigations: Array<{
    risk: string;
    likelihood: string;
    impact: string;
    mitigation: string;
  }>;
  target_icp_segments: string[];
  target_offers: string[];
}

interface MonthPlan {
  theme: string;
  focus_areas: string[];
  campaigns: Array<{
    name: string;
    objective: string;
    channels: string[];
    target_icp: string;
    tactics: string[];
    budget: number;
  }>;
  content_pieces: Array<{
    type: string;
    title: string;
    target_icp: string;
    goal: string;
    publish_week: number;
  }>;
  milestones: string[];
}

interface CMO90DayPlannerProps {
  workspaceId: string;
  onPlanSaved?: () => void;
}

export function CMO90DayPlanner({ workspaceId, onPlanSaved }: CMO90DayPlannerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [streamContent, setStreamContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Input parameters
  const [primaryGoal, setPrimaryGoal] = useState('');
  const [budget, setBudget] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');

  const focusOptions = [
    'Lead Generation',
    'Brand Awareness',
    'Customer Retention',
    'Product Launch',
    'Market Expansion',
    'Thought Leadership',
    'Community Building',
    'Sales Enablement'
  ];

  const toggleFocusArea = (area: string) => {
    setFocusAreas(prev => 
      prev.includes(area) 
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
  };

  const parsePlanFromStream = (content: string) => {
    const planMatch = content.match(/```json:plan\n([\s\S]*?)\n```/);
    if (planMatch) {
      try {
        return JSON.parse(planMatch[1]);
      } catch (e) {
        console.error('Failed to parse plan JSON:', e);
      }
    }
    return null;
  };

  const generatePlan = async () => {
    setIsGenerating(true);
    setStreamContent('');
    setPlan(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cmo-plan-90day`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            workspaceId,
            primaryGoal: primaryGoal || undefined,
            budget: budget ? parseInt(budget) : undefined,
            focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
            startDate: startDate || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate plan');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setStreamContent(fullContent);
              
              // Try to parse plan as it streams
              const parsedPlan = parsePlanFromStream(fullContent);
              if (parsedPlan) {
                setPlan(parsedPlan);
              }
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Final parse attempt
      const finalPlan = parsePlanFromStream(fullContent);
      if (finalPlan) {
        setPlan(finalPlan);
        toast.success('90-day marketing plan generated!');
      }

    } catch (error) {
      console.error('Plan generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate plan');
    } finally {
      setIsGenerating(false);
    }
  };

  const savePlan = async () => {
    if (!plan) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in to save');
        return;
      }

      // Using type assertion as types will be regenerated after migration
      const { error } = await (supabase.from('cmo_marketing_plans') as any).insert({
        workspace_id: workspaceId,
        created_by: user.id,
        plan_name: plan.plan_name,
        plan_type: '90-day',
        status: 'draft',
        start_date: startDate || null,
        executive_summary: plan.executive_summary,
        primary_objectives: plan.primary_objectives,
        key_metrics: plan.key_metrics,
        budget_allocation: plan.budget_allocation,
        month_1_plan: plan.month_1_plan,
        month_2_plan: plan.month_2_plan,
        month_3_plan: plan.month_3_plan,
        channel_mix: plan.channel_mix,
        campaign_themes: plan.campaign_themes,
        risks_mitigations: plan.risks_mitigations,
        target_icp_segments: plan.target_icp_segments,
        target_offers: plan.target_offers,
        generation_context: {
          primaryGoal,
          budget,
          focusAreas,
          generatedAt: new Date().toISOString()
        }
      });

      if (error) throw error;

      toast.success('Marketing plan saved!');
      onPlanSaved?.();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save plan');
    } finally {
      setIsSaving(false);
    }
  };

  const renderMonthPlan = (monthPlan: MonthPlan, monthNum: number) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-lg px-3 py-1">
          Month {monthNum}
        </Badge>
        <span className="font-semibold text-lg">{monthPlan.theme}</span>
      </div>

      <div className="grid gap-4">
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Target className="h-4 w-4" /> Focus Areas
          </h4>
          <div className="flex flex-wrap gap-2">
            {monthPlan.focus_areas?.map((area, i) => (
              <Badge key={i} variant="secondary">{area}</Badge>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Campaigns
          </h4>
          <div className="space-y-2">
            {monthPlan.campaigns?.map((campaign, i) => (
              <Card key={i} className="p-3">
                <div className="font-medium">{campaign.name}</div>
                <div className="text-sm text-muted-foreground">{campaign.objective}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {campaign.channels?.map((ch, j) => (
                    <Badge key={j} variant="outline" className="text-xs">{ch}</Badge>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Content Pieces
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {monthPlan.content_pieces?.slice(0, 6).map((content, i) => (
              <div key={i} className="text-sm p-2 bg-muted rounded">
                <Badge variant="outline" className="text-xs mb-1">{content.type}</Badge>
                <div className="font-medium truncate">{content.title}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Milestones
          </h4>
          <ul className="list-disc list-inside text-sm space-y-1">
            {monthPlan.milestones?.map((milestone, i) => (
              <li key={i}>{milestone}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Input Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            90-Day Marketing Plan Generator
          </CardTitle>
          <CardDescription>
            Generate a comprehensive marketing plan based on your brand, ICP segments, and offers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Goal</Label>
              <Input
                placeholder="e.g., Increase qualified leads by 50%"
                value={primaryGoal}
                onChange={(e) => setPrimaryGoal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Available Budget (USD)</Label>
              <Input
                type="number"
                placeholder="e.g., 10000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Focus Areas (select all that apply)</Label>
            <div className="flex flex-wrap gap-2">
              {focusOptions.map((area) => (
                <Badge
                  key={area}
                  variant={focusAreas.includes(area) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleFocusArea(area)}
                >
                  {area}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Start Date (optional)</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <Button 
            onClick={generatePlan} 
            disabled={isGenerating}
            className="w-full gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Plan...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate 90-Day Plan
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Plan */}
      {plan && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{plan.plan_name}</CardTitle>
                <CardDescription className="mt-2">
                  {plan.executive_summary?.slice(0, 200)}...
                </CardDescription>
              </div>
              <Button onClick={savePlan} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Plan
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="month1">Month 1</TabsTrigger>
                <TabsTrigger value="month2">Month 2</TabsTrigger>
                <TabsTrigger value="month3">Month 3</TabsTrigger>
                <TabsTrigger value="risks">Risks</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-4">
                {/* Objectives */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" /> Primary Objectives
                  </h3>
                  <div className="grid gap-2">
                    {plan.primary_objectives?.map((obj, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <div className="font-medium">{obj.objective}</div>
                          <div className="text-sm text-muted-foreground">
                            {obj.baseline} → {obj.goal}
                          </div>
                        </div>
                        <Badge variant={obj.priority === 'high' ? 'destructive' : 'secondary'}>
                          {obj.priority}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Budget Allocation */}
                {plan.budget_allocation?.breakdown && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Budget Allocation
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {plan.budget_allocation.breakdown.map((item, i) => (
                        <Card key={i} className="p-3 text-center">
                          <div className="text-2xl font-bold">{item.percentage}%</div>
                          <div className="text-sm text-muted-foreground">{item.category}</div>
                          <div className="text-xs">${item.amount?.toLocaleString()}</div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Channel Mix */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Channel Mix
                  </h3>
                  <div className="grid gap-2">
                    {plan.channel_mix?.map((channel, i) => (
                      <div key={i} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{channel.channel}</span>
                          <Badge variant="outline">{channel.role}</Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {channel.budget_percentage}% budget
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="month1" className="mt-4">
                {plan.month_1_plan && renderMonthPlan(plan.month_1_plan, 1)}
              </TabsContent>

              <TabsContent value="month2" className="mt-4">
                {plan.month_2_plan && renderMonthPlan(plan.month_2_plan, 2)}
              </TabsContent>

              <TabsContent value="month3" className="mt-4">
                {plan.month_3_plan && renderMonthPlan(plan.month_3_plan, 3)}
              </TabsContent>

              <TabsContent value="risks" className="mt-4">
                <div className="space-y-3">
                  {plan.risks_mitigations?.map((risk, i) => (
                    <Card key={i} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <span className="font-medium">{risk.risk}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <strong>Mitigation:</strong> {risk.mitigation}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={risk.likelihood === 'high' ? 'destructive' : 'outline'}>
                            {risk.likelihood} likelihood
                          </Badge>
                          <Badge variant={risk.impact === 'high' ? 'destructive' : 'outline'}>
                            {risk.impact} impact
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Streaming Content (shown during generation) */}
      {isGenerating && streamContent && !plan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating Plan...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <pre className="text-sm whitespace-pre-wrap">{streamContent}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
