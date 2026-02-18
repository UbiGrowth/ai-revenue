import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Zap,
  TrendingUp,
  Mail,
  Phone,
  Building,
  Briefcase,
  MapPin,
  RefreshCw,
  MousePointerClick,
  PhoneCall,
  Clock,
} from "lucide-react";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  job_title?: string;
  status: string;
  score: number;
  source: string;
  vertical?: string;
  industry?: string;
  company_size?: string;
}

interface LeadScoringProps {
  lead: Lead;
  onUpdate: () => void;
}

const SCORING_CRITERIA = [
  {
    id: "email",
    label: "Has Email",
    icon: Mail,
    check: (lead: Lead) => !!lead.email,
    points: 10,
  },
  {
    id: "phone",
    label: "Has Phone Number",
    icon: Phone,
    check: (lead: Lead) => !!lead.phone,
    points: 15,
  },
  {
    id: "company",
    label: "Company Identified",
    icon: Building,
    check: (lead: Lead) => !!lead.company,
    points: 10,
  },
  {
    id: "job_title",
    label: "Job Title Known",
    icon: Briefcase,
    check: (lead: Lead) => !!lead.job_title,
    points: 10,
  },
  {
    id: "vertical",
    label: "Industry Vertical Matched",
    icon: MapPin,
    check: (lead: Lead) => !!lead.vertical,
    points: 15,
  },
  {
    id: "decision_maker",
    label: "Decision Maker",
    icon: TrendingUp,
    check: (lead: Lead) => {
      const titles = ["owner", "ceo", "director", "manager", "vp", "president"];
      return titles.some((t) => lead.job_title?.toLowerCase().includes(t));
    },
    points: 20,
  },
  {
    id: "enterprise",
    label: "Enterprise Company",
    icon: Building,
    check: (lead: Lead) => {
      const sizes = ["51-200", "201-500", "501-1000", "1000+"];
      return sizes.includes(lead.company_size || "");
    },
    points: 20,
  },
];

export default function LeadScoring({ lead, onUpdate }: LeadScoringProps) {
  const [recalculating, setRecalculating] = useState(false);
  const [engagementStats, setEngagementStats] = useState({
    emailOpens: 0,
    emailClicks: 0,
    callsCompleted: 0,
    recentActivity: false,
  });

  useEffect(() => {
    fetchEngagementStats();
  }, [lead.id]);

  const fetchEngagementStats = async () => {
    const { data: activities } = await supabase
      .from("lead_activities")
      .select("activity_type, created_at")
      .eq("lead_id", lead.id);

    if (activities) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      setEngagementStats({
        emailOpens: activities.filter(a => a.activity_type === "email_opened").length,
        emailClicks: activities.filter(a => a.activity_type === "email_clicked").length,
        callsCompleted: activities.filter(a => a.activity_type === "call_completed").length,
        recentActivity: activities.some(a => new Date(a.created_at) > sevenDaysAgo),
      });
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const response = await supabase.functions.invoke("auto-score-lead", {
        body: { leadId: lead.id },
      });

      if (response.error) throw response.error;

      const { previousScore, newScore, updated } = response.data;
      
      if (updated) {
        toast.success(`Lead score updated: ${previousScore} → ${newScore}`);
      } else {
        toast.info(`Lead score unchanged at ${newScore}`);
      }
      
      await fetchEngagementStats();
      onUpdate();
    } catch (error) {
      console.error("Error recalculating score:", error);
      toast.error("Failed to recalculate score");
    } finally {
      setRecalculating(false);
    }
  };

  const calculateScore = () => {
    let score = 0;
    SCORING_CRITERIA.forEach((criteria) => {
      if (criteria.check(lead)) {
        score += criteria.points;
      }
    });
    return Math.min(score, 100);
  };

  const getScoreGrade = (score: number) => {
    if (score >= 80) return { grade: "A", color: "text-green-500", label: "Hot Lead" };
    if (score >= 60) return { grade: "B", color: "text-emerald-500", label: "Warm Lead" };
    if (score >= 40) return { grade: "C", color: "text-yellow-500", label: "Cool Lead" };
    if (score >= 20) return { grade: "D", color: "text-orange-500", label: "Cold Lead" };
    return { grade: "F", color: "text-red-500", label: "Unqualified" };
  };

  const scoreInfo = getScoreGrade(lead.score);
  const calculatedScore = calculateScore();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Lead Score
            </CardTitle>
            <CardDescription>Based on qualification criteria</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={recalculating}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${recalculating ? "animate-spin" : ""}`} />
            Recalculate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className={`text-4xl font-bold ${scoreInfo.color}`}>
              {lead.score}
            </div>
            <Badge variant="outline" className={scoreInfo.color}>
              {scoreInfo.label}
            </Badge>
          </div>
          <div className="flex-1">
            <Progress value={lead.score} className="h-3" />
            {calculatedScore !== lead.score && (
              <p className="text-xs text-muted-foreground mt-1">
                Calculated score: {calculatedScore} (click Recalculate to update)
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Profile Criteria</h4>
          <div className="grid gap-2">
            {SCORING_CRITERIA.map((criteria) => {
              const passed = criteria.check(lead);
              const Icon = criteria.icon;

              return (
                <div
                  key={criteria.id}
                  className={`flex items-center justify-between p-2 rounded-lg border ${
                    passed ? "bg-green-500/10 border-green-500/20" : "bg-muted/30 border-border"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${passed ? "text-green-500" : "text-muted-foreground"}`} />
                    <span className={`text-sm ${passed ? "" : "text-muted-foreground"}`}>
                      {criteria.label}
                    </span>
                  </div>
                  <Badge variant={passed ? "default" : "outline"}>
                    +{criteria.points}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Engagement Signals</h4>
          <div className="grid gap-2">
            <div className={`flex items-center justify-between p-2 rounded-lg border ${
              engagementStats.emailOpens > 0 ? "bg-green-500/10 border-green-500/20" : "bg-muted/30 border-border"
            }`}>
              <div className="flex items-center gap-2">
                <Mail className={`h-4 w-4 ${engagementStats.emailOpens > 0 ? "text-green-500" : "text-muted-foreground"}`} />
                <span className={`text-sm ${engagementStats.emailOpens > 0 ? "" : "text-muted-foreground"}`}>
                  Email Opens ({engagementStats.emailOpens})
                </span>
              </div>
              <Badge variant={engagementStats.emailOpens > 0 ? "default" : "outline"}>
                +{Math.min(engagementStats.emailOpens * 3, 15)}
              </Badge>
            </div>

            <div className={`flex items-center justify-between p-2 rounded-lg border ${
              engagementStats.emailClicks > 0 ? "bg-green-500/10 border-green-500/20" : "bg-muted/30 border-border"
            }`}>
              <div className="flex items-center gap-2">
                <MousePointerClick className={`h-4 w-4 ${engagementStats.emailClicks > 0 ? "text-green-500" : "text-muted-foreground"}`} />
                <span className={`text-sm ${engagementStats.emailClicks > 0 ? "" : "text-muted-foreground"}`}>
                  Email Clicks ({engagementStats.emailClicks})
                </span>
              </div>
              <Badge variant={engagementStats.emailClicks > 0 ? "default" : "outline"}>
                +{Math.min(engagementStats.emailClicks * 5, 20)}
              </Badge>
            </div>

            <div className={`flex items-center justify-between p-2 rounded-lg border ${
              engagementStats.callsCompleted > 0 ? "bg-green-500/10 border-green-500/20" : "bg-muted/30 border-border"
            }`}>
              <div className="flex items-center gap-2">
                <PhoneCall className={`h-4 w-4 ${engagementStats.callsCompleted > 0 ? "text-green-500" : "text-muted-foreground"}`} />
                <span className={`text-sm ${engagementStats.callsCompleted > 0 ? "" : "text-muted-foreground"}`}>
                  Calls Completed ({engagementStats.callsCompleted})
                </span>
              </div>
              <Badge variant={engagementStats.callsCompleted > 0 ? "default" : "outline"}>
                +{Math.min(engagementStats.callsCompleted * 10, 20)}
              </Badge>
            </div>

            <div className={`flex items-center justify-between p-2 rounded-lg border ${
              engagementStats.recentActivity ? "bg-green-500/10 border-green-500/20" : "bg-muted/30 border-border"
            }`}>
              <div className="flex items-center gap-2">
                <Clock className={`h-4 w-4 ${engagementStats.recentActivity ? "text-green-500" : "text-muted-foreground"}`} />
                <span className={`text-sm ${engagementStats.recentActivity ? "" : "text-muted-foreground"}`}>
                  Recent Activity (7 days)
                </span>
              </div>
              <Badge variant={engagementStats.recentActivity ? "default" : "outline"}>
                +5-10
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
