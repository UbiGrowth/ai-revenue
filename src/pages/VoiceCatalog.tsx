/**
 * Voice Agent Templates Catalog
 * Browse and deploy pre-built voice agent templates
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface VoiceAgentTemplate {
  id: string;
  name: string;
  description: string;
  use_case: string;
  system_prompt: string;
  first_message: string;
  voice_id: string;
  language: string;
  is_public: boolean;
}

function VoiceCatalogPage() {
  const navigate = useNavigate();
  const { currentWorkspace, currentTenant } = useWorkspaceContext();
  const [templates, setTemplates] = useState<VoiceAgentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deployingTemplate, setDeployingTemplate] = useState<string | null>(null);
  const [showCustomizeDialog, setShowCustomizeDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<VoiceAgentTemplate | null>(null);
  const [customName, setCustomName] = useState("");
  const [customFirstMessage, setCustomFirstMessage] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('voice_agent_templates')
        .select('*')
        .eq('is_public', true)
        .order('use_case', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  async function deployTemplate(templateId: string, overrides?: any) {
    if (!currentTenant?.id) {
      toast.error('No tenant selected');
      return;
    }

    try {
      setDeployingTemplate(templateId);
      
      const { data, error } = await supabase.functions.invoke('voice-deploy-template', {
        body: {
          template_id: templateId,
          tenant_id: currentTenant.id,
          overrides: overrides || {},
        },
      });

      if (error) throw error;

      toast.success(`✅ Agent deployed: ${data.agent.name}`);
      navigate('/voice-agents');
    } catch (error: any) {
      console.error('Error deploying template:', error);
      toast.error(error.message || 'Failed to deploy agent');
    } finally {
      setDeployingTemplate(null);
      setShowCustomizeDialog(false);
      setSelectedTemplate(null);
    }
  }

  function handleQuickDeploy(template: VoiceAgentTemplate) {
    deployTemplate(template.id);
  }

  function handleCustomizeDeploy(template: VoiceAgentTemplate) {
    setSelectedTemplate(template);
    setCustomName(template.name);
    setCustomFirstMessage(template.first_message);
    setShowCustomizeDialog(true);
  }

  function handleConfirmCustomDeploy() {
    if (!selectedTemplate) return;

    const overrides: any = {};
    if (customName !== selectedTemplate.name) {
      overrides.name = customName;
    }
    if (customFirstMessage !== selectedTemplate.first_message) {
      overrides.first_message = customFirstMessage;
    }

    deployTemplate(selectedTemplate.id, overrides);
  }

  const useCaseColors: Record<string, string> = {
    sales_outreach: 'bg-blue-500',
    appointment_setting: 'bg-green-500',
    lead_qualification: 'bg-purple-500',
    customer_support: 'bg-orange-500',
  };

  const useCaseLabels: Record<string, string> = {
    sales_outreach: 'Sales Outreach',
    appointment_setting: 'Appointment Setting',
    lead_qualification: 'Lead Qualification',
    customer_support: 'Customer Support',
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex flex-col bg-gray-50">
          <NavBar />
          <main className="flex-1 container mx-auto px-4 py-8">
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          </main>
          <Footer />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <NavBar />
        <main className="flex-1 container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Phone className="h-8 w-8 text-blue-600" />
                  Voice Agent Catalog
                </h1>
                <p className="text-gray-600 mt-2">
                  Deploy pre-built voice agents in seconds
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate('/voice-agents')}
              >
                View My Agents
              </Button>
            </div>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{template.name}</CardTitle>
                      <Badge className={useCaseColors[template.use_case]}>
                        {useCaseLabels[template.use_case] || template.use_case}
                      </Badge>
                    </div>
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                  </div>
                  <CardDescription className="mt-3">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">First Message:</span>
                      <p className="text-gray-600 mt-1 italic">
                        "{template.first_message.substring(0, 100)}..."
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Language: {template.language.toUpperCase()}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleQuickDeploy(template)}
                    disabled={deployingTemplate === template.id}
                  >
                    {deployingTemplate === template.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Deploying...
                      </>
                    ) : (
                      <>
                        <Phone className="h-4 w-4 mr-2" />
                        Quick Deploy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCustomizeDeploy(template)}
                    disabled={deployingTemplate === template.id}
                  >
                    Customize
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {templates.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <Phone className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No templates available</p>
              </CardContent>
            </Card>
          )}
        </main>
        <Footer />

        {/* Customize Dialog */}
        <Dialog open={showCustomizeDialog} onOpenChange={setShowCustomizeDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Customize Agent</DialogTitle>
              <DialogDescription>
                Customize the agent before deployment
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="customName">Agent Name</Label>
                <Input
                  id="customName"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter agent name"
                />
              </div>
              <div>
                <Label htmlFor="customFirstMessage">First Message</Label>
                <Textarea
                  id="customFirstMessage"
                  value={customFirstMessage}
                  onChange={(e) => setCustomFirstMessage(e.target.value)}
                  placeholder="Enter first message"
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowCustomizeDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmCustomDeploy}
                  disabled={!customName || !customFirstMessage}
                >
                  Deploy Agent
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}

export default VoiceCatalogPage;
