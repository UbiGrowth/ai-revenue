import { useState, useEffect } from "react";
import { useCMOContext } from "@/contexts/CMOContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Sparkles,
  ExternalLink,
  FileText,
  Loader2,
  Rocket,
  Layout,
} from "lucide-react";
import { 
  fetchCampaignLandingPages, 
  regenerateLandingPage 
} from "@/lib/cmo/apiClient";
import type { LandingPageDraft } from "@/lib/cmo/types";

interface LandingPagesTabProps {
  campaignId?: string;
}

function LandingPagesTab({ campaignId }: LandingPagesTabProps) {
  const { tenantId, isLoading: contextLoading } = useCMOContext();
  const [pages, setPages] = useState<LandingPageDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [editing, setEditing] = useState({
    heroHeadline: "",
    heroSubheadline: "",
    primaryCtaLabel: ""
  });

  // Fetch landing pages when tenant/campaign changes
  useEffect(() => {
    if (!tenantId) return;
    
    setLoading(true);
    fetchCampaignLandingPages(tenantId, campaignId || null)
      .then((data) => {
        setPages(data);
        if (data.length && !selectedId) {
          setSelectedId(data[0].id || null);
          setEditing({
            heroHeadline: data[0].heroHeadline || "",
            heroSubheadline: data[0].heroSubheadline || "",
            primaryCtaLabel: data[0].primaryCtaLabel || ""
          });
        }
      })
      .catch((err) => {
        console.error("Failed to fetch landing pages:", err);
        toast.error("Failed to load landing pages");
      })
      .finally(() => setLoading(false));
  }, [tenantId, campaignId]);

  const selected = pages.find((p) => p.id === selectedId) ?? null;

  const handleSelectPage = (page: LandingPageDraft) => {
    setSelectedId(page.id || null);
    setEditing({
      heroHeadline: page.heroHeadline || "",
      heroSubheadline: page.heroSubheadline || "",
      primaryCtaLabel: page.primaryCtaLabel || ""
    });
  };

  const handleRegenerate = async () => {
    if (!tenantId || !selected?.id) return;
    setRebuilding(true);

    try {
      const updated = await regenerateLandingPage(tenantId, selected.id, editing);
      setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditing({
        heroHeadline: updated.heroHeadline || "",
        heroSubheadline: updated.heroSubheadline || "",
        primaryCtaLabel: updated.primaryCtaLabel || ""
      });
      toast.success("Landing page rebuilt with AI");
    } catch (error) {
      console.error("Regenerate error:", error);
      toast.error("Failed to rebuild landing page");
    } finally {
      setRebuilding(false);
    }
  };

  if (contextLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Select a tenant.</p>
      </div>
    );
  }

  if (!pages.length) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <Layout className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <CardTitle>No Landing Pages</CardTitle>
          <CardDescription>
            Build a campaign with Autopilot first.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={() => window.location.href = '/new-campaign'}>
            <Rocket className="h-4 w-4 mr-2" />
            Create Campaign with Autopilot
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[600px]">
      {/* Sidebar */}
      <aside className="w-full lg:w-80 shrink-0 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Campaign Landing Pages</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-48">
              <ul className="divide-y divide-border">
                {pages.map((page) => (
                  <li key={page.id}>
                    <button
                      className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 ${
                        page.id === selectedId ? "bg-primary/10 text-primary font-medium" : ""
                      }`}
                      onClick={() => handleSelectPage(page)}
                    >
                      <span className="block truncate">{page.internalName || "Untitled Page"}</span>
                      {page.campaignName && (
                        <span className="block text-xs text-muted-foreground truncate mt-0.5">
                          {page.campaignName}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Key Text
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Hero Headline</label>
                <Input
                  value={editing.heroHeadline}
                  onChange={(e) => setEditing((s) => ({ ...s, heroHeadline: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Hero Subheadline</label>
                <Textarea
                  value={editing.heroSubheadline}
                  onChange={(e) => setEditing((s) => ({ ...s, heroSubheadline: e.target.value }))}
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Primary CTA Label</label>
                <Input
                  value={editing.primaryCtaLabel}
                  onChange={(e) => setEditing((s) => ({ ...s, primaryCtaLabel: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <Button 
                className="w-full" 
                onClick={handleRegenerate} 
                disabled={rebuilding}
              >
                {rebuilding ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Rebuild Page With AI
              </Button>

              {selected.url && (
                <p className="text-xs text-muted-foreground">
                  Live URL:{" "}
                  <a 
                    href={selected.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {selected.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </aside>

      {/* Preview Panel */}
      <section className="flex-1 min-w-0">
        {selected && <LandingPreview draft={selected} editing={editing} />}
      </section>
    </div>
  );
}

// Simple preview component
function LandingPreview({ draft, editing }: { draft: LandingPageDraft; editing: { heroHeadline: string; heroSubheadline: string; primaryCtaLabel: string } }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{draft.internalName || "Landing Page Preview"}</CardTitle>
          <CardDescription className="text-xs flex items-center gap-2 mt-1">
            <Badge variant={draft.status === 'published' ? 'default' : 'secondary'}>
              {draft.status || 'draft'}
            </Badge>
            {draft.templateType && (
              <Badge variant="outline">{draft.templateType}</Badge>
            )}
          </CardDescription>
        </div>
        {draft.url && (
          <Button variant="outline" size="sm" asChild>
            <a href={draft.url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Live
            </a>
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-4">
        <div className="bg-muted rounded-lg p-2">
          <div className="bg-background rounded-md border shadow-sm overflow-hidden">
            {/* Browser Chrome */}
            <div className="bg-muted/50 px-3 py-2 flex items-center gap-2 border-b">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-muted rounded px-3 py-1 text-xs text-muted-foreground font-mono truncate">
                  {draft.url || `yoursite.com/${draft.urlSlug || 'landing'}`}
                </div>
              </div>
            </div>
            {/* Page Content Preview */}
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="p-8 space-y-8">
                {/* Hero Section */}
                <div className="text-center space-y-4 py-12 bg-gradient-to-b from-primary/5 to-transparent rounded-lg">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {editing.heroHeadline || draft.heroHeadline || "Your Headline Here"}
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    {editing.heroSubheadline || draft.heroSubheadline || "Your subheadline goes here"}
                  </p>
                  {draft.heroSupportingPoints && draft.heroSupportingPoints.length > 0 && (
                    <ul className="flex flex-wrap justify-center gap-4 mt-4">
                      {draft.heroSupportingPoints.map((point, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button size="lg" className="mt-6">
                    {editing.primaryCtaLabel || draft.primaryCtaLabel || "Get Started"}
                  </Button>
                </div>

                {/* Sections Preview */}
                {draft.sections && draft.sections.length > 0 && (
                  <div className="space-y-6">
                    {draft.sections.filter(s => s.enabled !== false).map((section, idx) => (
                      <div key={idx} className="border rounded-lg p-6">
                        <h3 className="font-semibold text-lg mb-2">{section.heading}</h3>
                        <p className="text-muted-foreground text-sm">{section.body}</p>
                        {section.bullets && section.bullets.length > 0 && (
                          <ul className="mt-3 space-y-1">
                            {section.bullets.map((bullet, bIdx) => (
                              <li key={bIdx} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Form Preview */}
                {draft.formFields && draft.formFields.length > 0 && (
                  <div className="max-w-md mx-auto border rounded-lg p-6 bg-muted/30">
                    <h3 className="font-semibold text-center mb-4">Get Started</h3>
                    <div className="space-y-3">
                      {draft.formFields.map((field, idx) => (
                        <div key={idx}>
                          <label className="text-xs font-medium text-muted-foreground">
                            {field.label} {field.required && <span className="text-destructive">*</span>}
                          </label>
                          <Input 
                            type={field.type} 
                            placeholder={field.label} 
                            className="mt-1" 
                            disabled 
                          />
                        </div>
                      ))}
                      <Button className="w-full mt-2">
                        {editing.primaryCtaLabel || draft.primaryCtaLabel || "Submit"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default LandingPagesTab;
