import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface AIPromptCardProps {
  title: string;
  description: string;
  prompts: string[];
}

const AIPromptCard = ({ title, description, prompts }: AIPromptCardProps) => {
  const handlePromptClick = (prompt: string) => {
    const event = new CustomEvent('open-ai-chat', { detail: { prompt } });
    window.dispatchEvent(event);
  };

  return (
    <Card className="p-6 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent shadow-lg">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
      <div className="space-y-2">
        {prompts.map((prompt, i) => (
          <Button
            key={i}
            variant="ghost"
            onClick={() => handlePromptClick(prompt)}
            className="w-full justify-start text-left hover:bg-primary/10 hover:text-primary transition-all group"
          >
            <Sparkles className="h-3 w-3 mr-2 text-primary/60 group-hover:text-primary flex-shrink-0" />
            <span className="text-sm truncate">{prompt}</span>
          </Button>
        ))}
      </div>
    </Card>
  );
};

export default AIPromptCard;
