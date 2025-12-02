import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Target, TrendingUp } from "lucide-react";

interface AIQuickActionsProps {
  onActionClick: (prompt: string) => void;
}

const AIQuickActions = ({ onActionClick }: AIQuickActionsProps) => {
  const actions = [
    {
      icon: Sparkles,
      label: "Generate Campaign Ideas",
      prompt: "Give me 3 creative campaign ideas for my business vertical",
    },
    {
      icon: Target,
      label: "Optimize Targeting",
      prompt: "How can I improve my audience targeting strategy?",
    },
    {
      icon: TrendingUp,
      label: "Boost Performance",
      prompt: "What are the best practices to improve my campaign performance?",
    },
    {
      icon: Zap,
      label: "Quick Tips",
      prompt: "Give me 5 quick tips to make my marketing more effective",
    },
  ];

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">AI Quick Actions</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {actions.map((action, i) => (
          <Button
            key={i}
            variant="outline"
            onClick={() => onActionClick(action.prompt)}
            className="justify-start gap-3 h-auto py-3 px-4 hover:bg-primary/10 hover:border-primary transition-all"
          >
            <action.icon className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm text-left">{action.label}</span>
          </Button>
        ))}
      </div>
    </Card>
  );
};

export default AIQuickActions;
