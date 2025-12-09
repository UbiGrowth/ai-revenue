import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  User,
  Building,
  Mail,
  Phone,
  Linkedin,
  Sparkles,
  TrendingUp,
  Clock,
  Target,
  MessageSquare,
  Calendar,
  ExternalLink,
  RefreshCw
} from "lucide-react";

interface ProspectIntelligenceDrawerProps {
  prospectId: string | null;
  onClose: () => void;
}

interface Prospect {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  title: string;
  linkedin_url: string | null;
}

interface ProspectScore {
  score: number;
  band: string;
  last_scored_at: string;
}

interface ProspectSignal {
  id: string;
  signal_type: string;
  source: string;
  signal_data: unknown;
  detected_at: string;
}

interface MessageEvent {
  id: string;
  event_type: string;
  channel: string;
  occurred_at: string;
  metadata: unknown;
}

export default function ProspectIntelligenceDrawer({ prospectId, onClose }: ProspectIntelligenceDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [score, setScore] = useState<ProspectScore | null>(null);
  const [signals, setSignals] = useState<ProspectSignal[]>([]);
  const [events, setEvents] = useState<MessageEvent[]>([]);

  useEffect(() => {
    if (prospectId) {
      fetchProspectData();
    }
  }, [prospectId]);

  const fetchProspectData = async () => {
    if (!prospectId) return;
    setLoading(true);

    try {
      // Fetch prospect details
      const { data: prospectData } = await supabase
        .from("prospects")
        .select("*")
        .eq("id", prospectId)
        .single();

      setProspect(prospectData);

      // Fetch score
      const { data: scoreData } = await supabase
        .from("prospect_scores")
        .select("score, band, last_scored_at")
        .eq("prospect_id", prospectId)
        .maybeSingle();

      setScore(scoreData);

      // Fetch signals
      const { data: signalsData } = await supabase
        .from("prospect_signals")
        .select("*")
        .eq("prospect_id", prospectId)
        .order("detected_at", { ascending: false })
        .limit(10);

      setSignals(signalsData || []);

      // Fetch message events through sequence runs
      const { data: runs } = await supabase
        .from("outbound_sequence_runs")
        .select("id")
        .eq("prospect_id", prospectId);

      if (runs && runs.length > 0) {
        const runIds = runs.map(r => r.id);
        const { data: eventsData } = await supabase
          .from("outbound_message_events")
          .select("id, event_type, channel, occurred_at, metadata")
          .in("sequence_run_id", runIds)
          .order("occurred_at", { ascending: false })
          .limit(20);

        setEvents(eventsData || []);
      }
    } catch (error) {
      console.error("Error fetching prospect data:", error);
    } finally {
      setLoading(false);
    }
  };

  const regenerateMessage = async () => {
    if (!prospect) return;
    setRegenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("outbound-message-gen", {
        body: {
          mode: "personalize",
          prospect_id: prospect.id,
          prospect: {
            first_name: prospect.first_name,
            last_name: prospect.last_name,
            company: prospect.company,
            title: prospect.title,
          },
          signals: signals.slice(0, 5),
        }
      });

      if (error) throw error;

      toast({
        title: "Message regenerated!",
        description: data?.message ? "New personalized message ready" : "Check the campaign for new content",
      });
    } catch (error) {
      console.error("Error regenerating message:", error);
      toast({
        title: "Error",
        description: "Could not regenerate message",
        variant: "destructive",
      });
    } finally {
      setRegenerating(false);
    }
  };

  const getBandColor = (band: string) => {
    switch (band) {
      case "hot": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "warm": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default: return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    }
  };

  const getSignalIcon = (type: string) => {
    switch (type) {
      case "email_opened": return <Mail className="h-4 w-4" />;
      case "link_clicked": return <ExternalLink className="h-4 w-4" />;
      case "replied": return <MessageSquare className="h-4 w-4" />;
      case "booked": return <Calendar className="h-4 w-4" />;
      case "linkedin_view": return <Linkedin className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getEventColor = (eventType: string) => {
    const colors: Record<string, string> = {
      sent: "text-blue-400",
      delivered: "text-green-400",
      opened: "text-yellow-400",
      clicked: "text-orange-400",
      replied: "text-purple-400",
      booked: "text-emerald-400",
      bounced: "text-red-400",
    };
    return colors[eventType] || "text-muted-foreground";
  };

  return (
    <Sheet open={!!prospectId} onOpenChange={() => onClose()}>
      <SheetContent className="w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle>Prospect Intelligence</SheetTitle>
          <SheetDescription>
            Profile, signals, and engagement history
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : prospect ? (
            <div className="space-y-6">
              {/* Profile Card */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">
                        {prospect.first_name} {prospect.last_name}
                      </h3>
                      <p className="text-muted-foreground">{prospect.title}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Building className="h-3 w-3" />
                        {prospect.company}
                      </div>
                    </div>
                    {score && (
                      <Badge className={getBandColor(score.band)}>
                        Score: {score.score}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    {prospect.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${prospect.email}`} className="hover:underline">
                          {prospect.email}
                        </a>
                      </div>
                    )}
                    {prospect.linkedin_url && (
                      <div className="flex items-center gap-2 text-sm">
                        <Linkedin className="h-4 w-4 text-muted-foreground" />
                        <a 
                          href={prospect.linkedin_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          LinkedIn Profile
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={regenerateMessage}
                      disabled={regenerating}
                    >
                      {regenerating ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Regenerate Message
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Signals Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Intent Signals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {signals.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No signals detected yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {signals.map(signal => (
                        <div
                          key={signal.id}
                          className="flex items-start gap-3 text-sm"
                        >
                          <div className="mt-0.5">
                            {getSignalIcon(signal.signal_type)}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium capitalize">
                              {signal.signal_type.replace(/_/g, " ")}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {signal.source} • {new Date(signal.detected_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Activity Timeline */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Activity Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No activity yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {events.map(event => (
                        <div
                          key={event.id}
                          className="flex items-center gap-3 text-sm"
                        >
                          <div className={`w-2 h-2 rounded-full ${getEventColor(event.event_type).replace("text-", "bg-")}`} />
                          <div className="flex-1">
                            <span className={`font-medium capitalize ${getEventColor(event.event_type)}`}>
                              {event.event_type}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              via {event.channel}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.occurred_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No prospect selected
            </p>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
