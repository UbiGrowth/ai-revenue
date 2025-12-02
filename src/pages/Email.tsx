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
import { Loader2, Mail } from "lucide-react";
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

const Email = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [vertical, setVertical] = useState("");
  const [goal, setGoal] = useState("");
  const [recipients, setRecipients] = useState("");

  const handleCreateEmail = async () => {
    if (!vertical) {
      toast({
        title: "Vertical Required",
        description: "Please select a vertical to create your email.",
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
          contentType: "email",
          assetGoal: goal || undefined,
        },
      });

      if (contentError) throw contentError;

      // Step 2: Generate hero image
      const { data: imageData, error: imageError } = await supabase.functions.invoke("generate-hero-image", {
        body: {
          vertical,
          assetGoal: goal || contentData.title,
        },
      });

      if (imageError) {
        console.error("Image generation error:", imageError);
      }

      // Step 3: Create asset with generated content, recipients, and hero image
      const assetName = contentData.title || `${vertical} Email - ${new Date().toLocaleDateString()}`;
      const emailSubject = contentData.subject || assetName;
      
      // Parse recipients from comma-separated input
      const recipientList = recipients
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);
      
      const { data: assetData, error: assetError } = await supabase
        .from("assets")
        .insert({
          name: assetName,
          description: contentData.content,
          type: "email",
          channel: vertical,
          goal: goal || contentData.title,
          status: "review",
          created_by: userData.user?.id,
          preview_url: imageData?.imageUrl || null,
          content: {
            subject: emailSubject,
            body: contentData.content,
            html: contentData.content,
            recipients: recipientList,
            hero_image_url: imageData?.imageUrl || null,
          },
        })
        .select()
        .single();

      if (assetError) throw assetError;

      toast({
        title: "Email Created",
        description: "Your email campaign is fully built and ready for approval.",
      });

      // Navigate to asset detail for approval
      navigate(`/assets/${assetData.id}`);
    } catch (error: any) {
      console.error("Error creating email:", error);
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create email. Please try again.",
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
                <Mail className="h-8 w-8" />
                Create Email Sequence
              </h1>
              <p className="text-muted-foreground">
                AI-powered email campaigns for your marketing efforts
              </p>
            </div>

            <div className="mb-6">
              <AIPromptCard
                title="Email Campaign Help"
                description="Get AI assistance with email strategy and copy"
                prompts={[
                  "What's the best email structure for higher open rates?",
                  "Give me 5 subject line ideas that drive clicks",
                  "How can I personalize emails for better engagement?",
                ]}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <AIAssistant
                context="campaign-goal"
                onSuggestion={(suggestion) => setGoal(suggestion)}
                placeholder="Ask AI to help define your email campaign goal..."
                buttonText="Get Goal Suggestions"
              />

              <Card>
                <CardHeader>
                  <CardTitle>Quick Email Creation</CardTitle>
                  <CardDescription>
                    Select your industry and AI will generate everything automatically
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
                  <Label htmlFor="goal">Campaign Goal (Optional)</Label>
                  <Input
                    id="goal"
                    placeholder="e.g., Newsletter, Promotional, Welcome series"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipients">Email Recipients</Label>
                  <Textarea
                    id="recipients"
                    placeholder="Enter email addresses, separated by commas"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: customer1@example.com, customer2@example.com
                  </p>
                </div>

                <Button
                  onClick={handleCreateEmail}
                  disabled={creating || !vertical || !recipients}
                  className="w-full"
                  size="lg"
                >
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {creating ? "Creating Email..." : "Generate & Create Email"}
                </Button>

                <p className="text-sm text-muted-foreground text-center">
                  Your email will be automatically generated with AI and ready for approval before sending
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

export default Email;
