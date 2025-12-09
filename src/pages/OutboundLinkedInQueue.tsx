import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Linkedin,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  User,
  Building,
  Sparkles
} from "lucide-react";

interface QueuedMessage {
  id: string;
  prospect_id: string;
  prospect: {
    first_name: string;
    last_name: string;
    company: string;
    title: string;
    linkedin_url: string;
  };
  message: string;
  step_type: string;
  campaign_name: string;
  created_at: string;
  copied: boolean;
}

export default function OutboundLinkedInQueue() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());
  const [regenerating, setRegenerating] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch pending LinkedIn messages from sequence runs
      const { data: runs } = await supabase
        .from("outbound_sequence_runs")
        .select(`
          id,
          prospect_id,
          sequence_id,
          last_step_sent,
          next_step_due_at
        `)
        .eq("status", "active")
        .lte("next_step_due_at", new Date().toISOString());

      if (!runs || runs.length === 0) {
        setQueue([]);
        setLoading(false);
        return;
      }

      // Get sequence IDs and fetch steps
      const sequenceIds = [...new Set(runs.map(r => r.sequence_id))];
      const { data: sequences } = await supabase
        .from("outbound_sequences")
        .select("id, campaign_id, name")
        .in("id", sequenceIds);

      const { data: steps } = await supabase
        .from("outbound_sequence_steps")
        .select("*")
        .in("sequence_id", sequenceIds);

      // Get campaign names
      const campaignIds = sequences?.map(s => s.campaign_id).filter(Boolean) || [];
      const { data: campaigns } = await supabase
        .from("outbound_campaigns")
        .select("id, name")
        .in("id", campaignIds.length > 0 ? campaignIds : ["00000000-0000-0000-0000-000000000000"]);

      // Get prospect details
      const prospectIds = runs.map(r => r.prospect_id);
      const { data: prospects } = await supabase
        .from("prospects")
        .select("id, first_name, last_name, company, title, linkedin_url")
        .in("id", prospectIds);

      // Build queue - only include LinkedIn channel steps
      const queueItems: QueuedMessage[] = [];

      for (const run of runs) {
        const sequence = sequences?.find(s => s.id === run.sequence_id);
        const campaign = campaigns?.find(c => c.id === sequence?.campaign_id);
        const prospect = prospects?.find(p => p.id === run.prospect_id);
        
        // Find the next step (current step + 1)
        const nextStep = steps?.find(s => 
          s.sequence_id === run.sequence_id && 
          s.step_order === (run.last_step_sent || 0) + 1
        );

        // Only include if it's a LinkedIn step and prospect has LinkedIn URL
        if (nextStep && prospect?.linkedin_url) {
          // Check metadata for channel
          const metadata = nextStep.metadata as Record<string, unknown> | null;
          const channel = metadata?.channel as string || "email";
          
          if (channel === "linkedin" || nextStep.step_type === "connect") {
            queueItems.push({
              id: run.id,
              prospect_id: run.prospect_id,
              prospect: {
                first_name: prospect.first_name,
                last_name: prospect.last_name,
                company: prospect.company,
                title: prospect.title,
                linkedin_url: prospect.linkedin_url,
              },
              message: nextStep.message_template || "",
              step_type: nextStep.step_type,
              campaign_name: campaign?.name || "Unknown Campaign",
              created_at: run.next_step_due_at || "",
              copied: false,
            });
          }
        }
      }

      setQueue(queueItems);
    } catch (error) {
      console.error("Error fetching queue:", error);
      toast({
        title: "Error",
        description: "Could not load LinkedIn queue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = async (item: QueuedMessage) => {
    try {
      // Personalize message with prospect data
      const personalizedMessage = item.message
        .replace(/\{\{first_name\}\}/g, item.prospect.first_name)
        .replace(/\{\{last_name\}\}/g, item.prospect.last_name)
        .replace(/\{\{company\}\}/g, item.prospect.company)
        .replace(/\{\{title\}\}/g, item.prospect.title);

      await navigator.clipboard.writeText(personalizedMessage);
      
      setCopiedIds(prev => new Set([...prev, item.id]));
      
      toast({
        title: "Copied!",
        description: "Message copied to clipboard. Paste it in LinkedIn.",
      });

      // Reset copy state after 3 seconds
      setTimeout(() => {
        setCopiedIds(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }, 3000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const markAsSent = async (item: QueuedMessage) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Log the event
      await supabase.from("outbound_message_events").insert({
        sequence_run_id: item.id,
        step_id: item.id, // Using run id as placeholder
        tenant_id: user.id,
        event_type: "sent",
        channel: "linkedin",
        metadata: {
          step_type: item.step_type,
          manual_send: true,
        },
      });

      // Update the run to move to next step
      const { data: run } = await supabase
        .from("outbound_sequence_runs")
        .select("last_step_sent, sequence_id")
        .eq("id", item.id)
        .single();

      if (run) {
        const nextStepOrder = (run.last_step_sent || 0) + 1;
        
        // Get the next step's delay
        const { data: nextStep } = await supabase
          .from("outbound_sequence_steps")
          .select("delay_days")
          .eq("sequence_id", run.sequence_id)
          .eq("step_order", nextStepOrder + 1)
          .maybeSingle();

        const nextDueAt = nextStep
          ? new Date(Date.now() + (nextStep.delay_days || 3) * 24 * 60 * 60 * 1000).toISOString()
          : null;

        await supabase
          .from("outbound_sequence_runs")
          .update({
            last_step_sent: nextStepOrder,
            next_step_due_at: nextDueAt,
            status: nextDueAt ? "active" : "completed",
          })
          .eq("id", item.id);
      }

      // Remove from queue
      setQueue(prev => prev.filter(q => q.id !== item.id));

      toast({
        title: "Marked as sent",
        description: "Message logged and sequence advanced",
      });
    } catch (error) {
      console.error("Error marking as sent:", error);
      toast({
        title: "Error",
        description: "Could not update status",
        variant: "destructive",
      });
    }
  };

  const regenerateMessage = async (item: QueuedMessage) => {
    setRegenerating(item.id);
    try {
      const { data, error } = await supabase.functions.invoke("outbound-message-gen", {
        body: {
          mode: "personalize",
          prospect_id: item.prospect_id,
          prospect: item.prospect,
          step_type: item.step_type,
          channel: "linkedin",
        },
      });

      if (error) throw error;

      if (data?.message) {
        setQueue(prev => prev.map(q => 
          q.id === item.id ? { ...q, message: data.message } : q
        ));
        toast({ title: "Message regenerated!" });
      }
    } catch (error) {
      console.error("Error regenerating:", error);
      toast({
        title: "Error",
        description: "Could not regenerate message",
        variant: "destructive",
      });
    } finally {
      setRegenerating(null);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/outbound")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Linkedin className="h-6 w-6 text-[#0A66C2]" />
                  LinkedIn Queue
                </h1>
                <p className="text-muted-foreground">
                  Copy messages and send manually to stay ToS-compliant
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={fetchQueue}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Info Banner */}
          <Card className="mb-6 border-[#0A66C2]/30 bg-[#0A66C2]/5">
            <CardContent className="pt-4">
              <p className="text-sm">
                <strong>Human-in-the-loop approach:</strong> AI generates personalized messages, 
                you copy and send them via LinkedIn. This keeps you compliant with LinkedIn's 
                Terms of Service while leveraging AI for message creation.
              </p>
            </CardContent>
          </Card>

          {/* Queue */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : queue.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Linkedin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold mb-2">No messages in queue</h3>
                <p className="text-muted-foreground text-sm">
                  LinkedIn messages will appear here when they're due to be sent
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {queue.map((item) => (
                <Card key={item.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-[#0A66C2]" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {item.prospect.first_name} {item.prospect.last_name}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {item.prospect.title} at {item.prospect.company}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {item.step_type.replace("_", " ")}
                        </Badge>
                        <Badge variant="secondary">{item.campaign_name}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Message Preview */}
                    <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                      {item.message
                        .replace(/\{\{first_name\}\}/g, item.prospect.first_name)
                        .replace(/\{\{last_name\}\}/g, item.prospect.last_name)
                        .replace(/\{\{company\}\}/g, item.prospect.company)
                        .replace(/\{\{title\}\}/g, item.prospect.title)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => regenerateMessage(item)}
                          disabled={regenerating === item.id}
                        >
                          {regenerating === item.id ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                          )}
                          Regenerate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={item.prospect.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open LinkedIn
                          </a>
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={copiedIds.has(item.id) ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => copyMessage(item)}
                        >
                          {copiedIds.has(item.id) ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Message
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => markAsSent(item)}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Mark as Sent
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
