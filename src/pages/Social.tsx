import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Share2 } from "lucide-react";
import AIAssistant from "@/components/AIAssistant";
import AIPromptCard from "@/components/AIPromptCard";

const verticals = [
  "Hotels & Resorts",
  "Multifamily Real Estate",
  "Pickleball Clubs & Country Clubs",
  "Entertainment Venues",
  "Physical Therapy",
  "Corporate Offices & Co-Working Spaces",
  "Education",
  "Gyms",
];

const platforms = ["Instagram", "LinkedIn", "Facebook", "TikTok"];

const Social = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [vertical, setVertical] = useState("");
  const [platform, setPlatform] = useState("");
  const [goal, setGoal] = useState("");

  const handleCreateSocial = async () => {
    if (!vertical || !platform) {
      toast({
        title: "Missing Information",
        description: "Please select a vertical and platform to create your post.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      // Step 1: Generate AI content
      const { data: contentData, error: contentError } = await supabase.functions.invoke("content-generate", {
        body: {
          vertical,
          contentType: "social",
          assetGoal: goal ? `${platform} - ${goal}` : platform,
        },
      });

      if (contentError) throw contentError;

      // Step 2: Generate hero image
      const { data: imageData, error: imageError } = await supabase.functions.invoke("generate-hero-image", {
        body: {
          vertical,
          assetGoal: goal || `${platform} post`,
        },
      });

      if (imageError) {
        console.error("Image generation error:", imageError);
      }

      // Step 3: Create asset with generated content and hero image
      const assetName = contentData.title || `${platform} Post - ${vertical} - ${new Date().toLocaleDateString()}`;
      
      const { data: assetData, error: assetError } = await supabase
        .from("assets")
        .insert({
          name: assetName,
          description: contentData.content,
          type: "landing_page",
          channel: `${vertical} - ${platform}`,
          goal: goal || contentData.title,
          status: "review",
          created_by: userData.user?.id,
          preview_url: imageData?.imageUrl || null,
          content: {
            platform,
            text: contentData.content,
            hero_image_url: imageData?.imageUrl || null,
          },
        })
        .select()
        .single();

      if (assetError) throw assetError;

      toast({
        title: "Social Post Created",
        description: "Your social media post is fully built and ready for approval.",
      });

      // Navigate to asset detail for approval
      navigate(`/assets/${assetData.id}`);
    } catch (error: any) {
      console.error("Error creating social post:", error);
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create social post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-background">
        <NavBar />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
                <Share2 className="h-8 w-8" />
                Create Social Media Post
              </h1>
              <p className="text-muted-foreground">
                AI-powered social media content for multiple platforms
              </p>
            </div>

            <div className="mb-6">
              <AIPromptCard
                title="Social Media Strategy"
                description="Get AI help with platform-specific content"
                prompts={[
                  "What content works best on Instagram vs LinkedIn?",
                  "Give me 5 engaging post ideas for my industry",
                  "How can I increase engagement on my social posts?",
                ]}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <AIAssistant
                context="campaign-goal"
                onSuggestion={(suggestion) => setGoal(suggestion)}
                placeholder="Ask AI to help define your social campaign goal..."
                buttonText="Get Goal Suggestions"
              />

              <Card>
                <CardHeader>
                  <CardTitle>Quick Social Post Creation</CardTitle>
                  <CardDescription>
                    Select your industry and platform, AI does the rest
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="vertical">Industry Vertical</Label>
                  <Select value={vertical} onValueChange={setVertical}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vertical" />
                    </SelectTrigger>
                    <SelectContent>
                      {verticals.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="platform">Platform</Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {platforms.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal">Campaign Goal (Optional)</Label>
                  <Input
                    id="goal"
                    placeholder="e.g., Engagement, Brand awareness, Event promotion"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleCreateSocial}
                  disabled={creating || !vertical || !platform}
                  className="w-full"
                  size="lg"
                >
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {creating ? "Creating Post..." : "Generate & Create Post"}
                </Button>

                <p className="text-sm text-muted-foreground text-center">
                  Your social media post will be automatically generated with AI and ready for approval
                </p>
              </CardContent>
            </Card>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default Social;
