import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import AIChat from "./AIChat";
import { supabase } from "@/integrations/supabase/client";

// Routes where AI chat should not appear
const AUTH_ROUTES = ["/login", "/signup", "/change-password", "/auth/callback", "/"];

const AIChatWidget = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState<string>(() => Date.now().toString());

  // Check if current route is an auth route
  const isAuthRoute = AUTH_ROUTES.includes(location.pathname);

  // Listen for auth state changes to clear chat on logout
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        // Reset session key to force AIChat to remount with fresh state
        setSessionKey(Date.now().toString());
        setIsOpen(false);
        setInitialPrompt(null);
        setPulse(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleOpenChat = (event: CustomEvent) => {
      setIsOpen(true);
      setPulse(false);
      setInitialPrompt(event.detail?.prompt || null);
    };

    window.addEventListener('open-ai-chat' as any, handleOpenChat);
    return () => window.removeEventListener('open-ai-chat' as any, handleOpenChat);
  }, []);

  // Don't render on auth routes
  if (isAuthRoute) {
    return null;
  }

  return (
    <>
      {isOpen && (
        <AIChat
          key={sessionKey}
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
