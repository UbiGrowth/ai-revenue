import { useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, Mail, Video, MessageSquare, Phone } from "lucide-react";
import AIPromptCard from "@/components/AIPromptCard";
import WorkflowProgress from "@/components/WorkflowProgress";

const verticals = [
  "Hotels & Resorts",
  "Multifamily Real Estate",
  "Pickleball Clubs & Country Clubs",
  "Entertainment Venues",
  "Physical Therapy",
  "Corporate Offices & Co-Working Spaces",
  "Education",
  "Gyms"
];

const NewCampaign = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [vertical, setVertical] = useState("");
  const [goal, setGoal] = useState("");
  const [location, setLocation] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [budget, setBudget] = useState("");

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!campaignName || !vertical || !goal) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in campaign name, vertical, and goal.",
      });
      return;
    }

    setCreating(true);

    try {
      toast({
        title: "Generating Campaign",
        description: "Creating all content across channels...",
      });

      // Call orchestrator function
      const { data, error } = await supabase.functions.invoke("campaign-orchestrator", {
        body: {
          campaignName,
          vertical,
          goal,
          location: location || undefined,
          businessType: businessType || undefined,
          budget: budget ? parseFloat(budget) : undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Campaign Created",
        description: `Generated ${data.assetsCreated} assets. Go to Approvals to review and deploy.`,
      });

      navigate("/approvals");
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create campaign",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <WorkflowProgress
            steps={[
              { label: "Create", status: "current" },
              { label: "Approve", status: "upcoming" },
              { label: "Track ROI", status: "upcoming" },
            ]}
            className="mb-8"
          />
          
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-primary" />
              Create Campaign
            </h1>
            <p className="mt-2 text-muted-foreground">
              Simple 3-step process: Create → Approve → Track ROI
            </p>
          </div>

          <form onSubmit={handleCreateCampaign}>
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Campaign Setup</CardTitle>
                <CardDescription>
                  System will generate all content, you approve, then it deploys automatically
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="campaignName">Campaign Name *</Label>
                  <Input
                    id="campaignName"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g., Spring 2025 Luxury Resort Campaign"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vertical">Client Vertical *</Label>
                  <Select value={vertical} onValueChange={setVertical} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry vertical" />
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
                  <Label htmlFor="goal">Marketing Objective *</Label>
                  <Textarea
                    id="goal"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="What should this campaign achieve for your client? (e.g., Drive 100 new member sign-ups, promote luxury resort packages, increase facility bookings by 25%)"
                    rows={4}
                    required
                  />
                </div>

                <AIPromptCard
                  title="Need help defining the objective?"
                  description="Get AI-powered suggestions for this vertical"
                  prompts={[
                    `Create a marketing objective for ${vertical || 'a client'} to increase brand awareness and drive membership`,
                    `Generate an objective for ${vertical || 'this vertical'} focused on lead generation and conversions`,
                    `Suggest campaign objectives for ${vertical || 'a client in this vertical'} to boost customer retention and engagement`,
                  ]}
                />

                <div className="space-y-2">
                  <Label htmlFor="budget">Campaign Budget (Optional)</Label>
                  <Input
                    id="budget"
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g., 5000"
                    min="0"
                    step="100"
                  />
                  <p className="text-xs text-muted-foreground">Total budget for this campaign in USD</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Client Location (Optional)</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., Miami, FL or Dallas, TX"
                    />
                    <p className="text-xs text-muted-foreground">For automated lead scraping</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessType">Target Business Type (Optional)</Label>
                    <Input
                      id="businessType"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      placeholder="e.g., luxury resorts, country clubs"
                    />
                    <p className="text-xs text-muted-foreground">For automated lead scraping</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20 rounded-lg p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <p className="text-sm font-semibold text-foreground">
                      Automated Workflow
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-background/50 rounded-lg p-4 space-y-2">
                      <div className="text-primary font-medium">1. Generate</div>
                      <div className="text-muted-foreground text-xs">
                        AI creates emails, social posts, videos, and call scripts
                      </div>
                    </div>
                    <div className="bg-background/50 rounded-lg p-4 space-y-2">
                      <div className="text-primary font-medium">2. Approve</div>
                      <div className="text-muted-foreground text-xs">
                        Review and approve content in one click
                      </div>
                    </div>
                    <div className="bg-background/50 rounded-lg p-4 space-y-2">
                      <div className="text-primary font-medium">3. Deploy & Track</div>
                      <div className="text-muted-foreground text-xs">
                        Auto-deploys to all channels and tracks ROI live
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Campaign...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Create Campaign
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </form>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default NewCampaign;
