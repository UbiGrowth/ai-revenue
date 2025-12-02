import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import AIChat from "./AIChat";
import { useEffect } from "react";

const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenChat = (event: CustomEvent) => {
      setIsOpen(true);
      setPulse(false);
      setInitialPrompt(event.detail?.prompt || null);
    };

    window.addEventListener('open-ai-chat' as any, handleOpenChat);
    return () => window.removeEventListener('open-ai-chat' as any, handleOpenChat);
  }, []);

  return (
    <>
      {isOpen && (
        <AIChat
          onClose={() => {
            setIsOpen(false);
            setInitialPrompt(null);
          }}
          initialPrompt={initialPrompt}
        />
      )}
      
      {!isOpen && (
        <div className="fixed bottom-4 right-4 z-50">
          {pulse && (
            <div className="absolute inset-0 h-14 w-14 rounded-full bg-primary/30 animate-ping" />
          )}
          <Button
            onClick={() => {
              setIsOpen(true);
              setPulse(false);
            }}
            size="lg"
            className="relative h-14 w-14 rounded-full shadow-2xl group hover:scale-110 transition-transform"
          >
            <Sparkles className="h-6 w-6 group-hover:rotate-12 transition-transform" />
          </Button>
        </div>
      )}
    </>
  );
};

export default AIChatWidget;
