// Agent Console - AI prompt testing interface

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, RotateCcw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCMOKernel } from "@/hooks/useCMO";
import { useCMOContext } from "@/contexts/CMOContext";
import { toast } from "@/hooks/use-toast";
import type { CMOWorkflowStep } from "@/lib/cmo/types";

const AGENT_MODES: { value: CMOWorkflowStep; label: string; description: string }[] = [
  { value: "brand-intake", label: "Brand Intake", description: "Capture brand identity and positioning" },
  { value: "plan-90day", label: "90-Day Planner", description: "Generate quarterly marketing plan" },
  { value: "funnel-architect", label: "Funnel Architect", description: "Design conversion funnels" },
  { value: "campaign-designer", label: "Campaign Designer", description: "Create multi-channel campaigns" },
  { value: "content-engine", label: "Content Engine", description: "Generate marketing content" },
  { value: "optimization-analyst", label: "Optimization Analyst", description: "Analyze and optimize performance" },
];

interface AgentConsoleProps {
  defaultMode?: CMOWorkflowStep;
  onResult?: (result: unknown) => void;
}

export function AgentConsole({ defaultMode = "brand-intake", onResult }: AgentConsoleProps) {
  const [mode, setMode] = useState<CMOWorkflowStep>(defaultMode);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const responseRef = useRef<HTMLPreElement>(null);

  const { workspaceId } = useCMOContext();
  const kernel = useCMOKernel();

  const selectedAgent = AGENT_MODES.find((a) => a.value === mode);

  const handleSubmit = async () => {
    if (!prompt.trim() || !workspaceId) return;

    setResponse(null);

    try {
      const result = await kernel.mutateAsync({
        mode,
        payload: {
          workspace_id: workspaceId,
          prompt,
        },
      });

      const responseText = JSON.stringify(result.data, null, 2);
      setResponse(responseText);
      onResult?.(result.data);

      toast({
        title: "Agent completed",
        description: `${selectedAgent?.label} finished processing`,
      });
    } catch (error) {
      console.error("Agent error:", error);
      toast({
        title: "Agent error",
        description: error instanceof Error ? error.message : "Failed to run agent",
        variant: "destructive",
      });
    }
  };

  const handleCopy = async () => {
    if (!response) return;
    await navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setPrompt("");
    setResponse(null);
  };

  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Agent Console
          </CardTitle>
          <Badge variant="outline" className="font-mono text-xs">
            {mode}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agent Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Agent Mode</label>
          <Select value={mode} onValueChange={(v) => setMode(v as CMOWorkflowStep)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGENT_MODES.map((agent) => (
                <SelectItem key={agent.value} value={agent.value}>
                  <div className="flex flex-col">
                    <span>{agent.label}</span>
                    <span className="text-xs text-muted-foreground">{agent.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Prompt</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Enter instructions for ${selectedAgent?.label}...`}
            className="min-h-[100px] resize-none bg-background"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSubmit}
            disabled={!prompt.trim() || kernel.isPending}
            className="flex-1 gap-2"
          >
            {kernel.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Run Agent
          </Button>
          <Button variant="outline" size="icon" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Response */}
        {response && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Response</label>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <ScrollArea className="h-[200px] rounded-md border border-border bg-muted/30 p-3">
              <pre
                ref={responseRef}
                className="whitespace-pre-wrap font-mono text-xs text-foreground"
              >
                {response}
              </pre>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
