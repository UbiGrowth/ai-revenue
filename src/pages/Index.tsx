import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 animate-fade-in">
        <Logo className="h-12 mx-auto" showTagline />
        <div>
          <h1 className="mb-4 text-4xl font-bold text-foreground">
            Welcome to <span className="text-ubigrowth">UbiGrowth AI</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            AI-powered marketing automation for your business
          </p>
        </div>
        <Button
          onClick={() => navigate("/login")}
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Sign In
        </Button>
        <div className="text-sm text-muted-foreground">
          New to UbiGrowth?{" "}
          <button
            onClick={() => navigate("/signup")}
            className="text-primary hover:text-primary/90 font-medium transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
