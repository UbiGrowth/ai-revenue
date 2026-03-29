import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2 } from "lucide-react";

interface AIAssistantProps {
  context: string;
  onSuggestion: (suggestion: string) => void;
  placeholder?: string;
  buttonText?: string;
}

const AIAssistant = ({ context, onSuggestion, placeholder, buttonText }: AIAssistantProps) => {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Input Required",
        description: "Please describe what you need help with.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-assist", {
        body: {
          context,
          userPrompt: prompt,
        },
      });

      if (error) throw error;

      onSuggestion(data.suggestion);
      setPrompt("");
      
      toast({
        title: "AI Suggestion Ready",
        description: "Your content has been generated.",
      });
    } catch (error: any) {
      console.error("AI assistance error:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate suggestion.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Assistant
        </CardTitle>
        <CardDescription>
          Describe what you need and AI will help you create it
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder={placeholder || "e.g., Create a compelling campaign goal for brand awareness..."}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="resize-none"
        />
        <Button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          className="w-full"
        >
          {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Sparkles className="mr-2 h-4 w-4" />
          {buttonText || "Generate with AI"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AIAssistant;
