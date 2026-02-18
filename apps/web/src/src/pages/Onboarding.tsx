import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Logo from "@/components/Logo";
import { Globe, Sparkles, Building2, Loader2, Upload, Palette, Type, MessageSquare, AlertCircle, Edit2 } from "lucide-react";
import { INDUSTRY_VERTICALS, matchIndustryVertical } from "@/lib/industryVerticals";

interface BrandGuidelines {
  brandName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  headingFont?: string;
  bodyFont?: string;
  brandVoice?: string;
  brandTone?: string;
  messagingPillars?: string[];
  industry?: string;
  logo?: string;
}

interface ValidationErrors {
  businessName?: string;
  websiteUrl?: string;
  industry?: string;
}

const Onboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  
  // Step 1: Website URL (primary) + optional business name
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  
  // Step 2: Editable brand guidelines
  const [brandGuidelines, setBrandGuidelines] = useState<BrandGuidelines | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  // Editable brand fields
  const [editPrimaryColor, setEditPrimaryColor] = useState("#000000");
  const [editSecondaryColor, setEditSecondaryColor] = useState("#666666");
  const [editAccentColor, setEditAccentColor] = useState("#0066cc");
  const [editBrandVoice, setEditBrandVoice] = useState("");
  const [editHeadingFont, setEditHeadingFont] = useState("Inter");
  const [editBodyFont, setEditBodyFont] = useState("Inter");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/signup");
      }
    });
  }, [navigate]);

  // Sync editable fields when brand guidelines are extracted
  useEffect(() => {
    if (brandGuidelines) {
      setEditPrimaryColor(brandGuidelines.primaryColor || "#000000");
      setEditSecondaryColor(brandGuidelines.secondaryColor || "#666666");
      setEditAccentColor(brandGuidelines.accentColor || "#0066cc");
      setEditBrandVoice(brandGuidelines.brandVoice || "");
      setEditHeadingFont(brandGuidelines.headingFont || "Inter");
      setEditBodyFont(brandGuidelines.bodyFont || "Inter");
      
      // Auto-fill business name if not set
      if (!businessName && brandGuidelines.brandName) {
        setBusinessName(brandGuidelines.brandName);
      }
      
      // Auto-match industry
      if (!industry && brandGuidelines.industry) {
        const matched = matchIndustryVertical(brandGuidelines.industry);
        if (matched) setIndustry(matched);
      }
    }
  }, [brandGuidelines]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateUrl = (url: string): boolean => {
    if (!url) return false;
    try {
      const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
      return !!parsed.hostname;
    } catch {
      return false;
    }
  };

  const extractBrandGuidelines = async () => {
    // Clear previous errors
    setValidationErrors({});
    
    // Validate URL (required)
    if (!websiteUrl) {
      setValidationErrors({ websiteUrl: "Website URL is required" });
      return;
    }
    
    if (!validateUrl(websiteUrl)) {
      setValidationErrors({ websiteUrl: "Please enter a valid URL (e.g., example.com)" });
      return;
    }

    setIsExtracting(true);
    try {
      let logoBase64 = null;
      if (logoFile) {
        const reader = new FileReader();
        logoBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(logoFile);
        });
      }

      const { data, error } = await supabase.functions.invoke('extract-brand-guidelines', {
        body: { 
          websiteUrl: websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`,
          logoImageBase64: logoBase64
        }
      });

      if (error) throw error;

      if (data?.brandGuidelines) {
        setBrandGuidelines(data.brandGuidelines);
        
        toast({
          title: data.cached ? "Brand loaded from cache" : "Brand guidelines extracted!",
          description: data.cached 
            ? "Using cached analysis for consistent results." 
            : "We've analyzed your website. Review and edit below.",
        });
        setStep(2);
      } else {
        throw new Error("No brand data returned");
      }
    } catch (error) {
      console.error('Error extracting brand guidelines:', error);
      toast({
        variant: "destructive",
        title: "Extraction failed",
        description: "Could not extract brand guidelines. You can continue with manual setup.",
      });
      // Still go to step 2 for manual setup
      setBrandGuidelines({});
      setStep(2);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSkipToManual = () => {
    // Navigate to business profile settings with empty state
    navigate("/settings", { state: { openTab: "business" } });
  };

  const validateStep2 = (): boolean => {
    const errors: ValidationErrors = {};
    
    if (!businessName.trim()) {
      errors.businessName = "Business name is required";
    }
    
    if (!industry) {
      errors.industry = "Please select an industry";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveBusinessProfile = async () => {
    if (!validateStep2()) return;
    
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let uploadedLogoUrl: string | null = null;

      // Upload logo to storage if provided
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${user.id}/logo.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('cmo-assets')
          .upload(fileName, logoFile, { upsert: true });
        
        if (uploadError) {
          console.error('Logo upload error:', uploadError);
          toast({
            variant: "destructive",
            title: "Logo upload failed",
            description: "Your profile was saved but the logo couldn't be uploaded.",
          });
        } else {
          const { data: urlData } = supabase.storage
            .from('cmo-assets')
            .getPublicUrl(fileName);
          uploadedLogoUrl = urlData.publicUrl;
        }
      }

      const profileData = {
        user_id: user.id,
        business_name: businessName.trim(),
        industry: industry,
        brand_voice: editBrandVoice || "Professional and friendly",
        brand_tone: brandGuidelines?.brandTone || "Approachable yet authoritative",
        brand_colors: {
          primary: editPrimaryColor,
          secondary: editSecondaryColor,
          accent: editAccentColor,
        },
        brand_fonts: {
          heading: editHeadingFont,
          body: editBodyFont,
        },
        messaging_pillars: brandGuidelines?.messagingPillars || [],
        business_description: `${businessName.trim()} - ${industry}`,
        logo_url: uploadedLogoUrl || brandGuidelines?.logo || null,
      };

      const { error } = await supabase
        .from('business_profiles')
        .upsert(profileData, { onConflict: 'user_id' });

      if (error) {
        console.error("Profile save error:", error);
        throw new Error(error.message || "Failed to save profile");
      }

      toast({
        title: "Setup complete!",
        description: "Your business profile has been created. Redirecting to dashboard...",
      });
      
      // Brief delay to show toast
      setTimeout(() => navigate("/dashboard"), 1000);
      
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        variant: "destructive",
        title: "Setup failed",
        description: error instanceof Error ? error.message : "Failed to save your business profile. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg animate-fade-in border-border bg-card">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <Logo className="h-10" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {step === 1 ? "Let's Set Up Your Business" : "Customize Your Brand"}
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {step === 1 
                ? "Enter your website URL and we'll extract your brand automatically"
                : "Review and edit your brand details"
              }
            </CardDescription>
          </div>
          
          {/* Progress indicator */}
          <div className="flex justify-center gap-2 pt-2">
            <div className={`h-2 w-16 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-16 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="websiteUrl" className="text-foreground flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="websiteUrl"
                  type="text"
                  placeholder="yourcompany.com"
                  value={websiteUrl}
                  onChange={(e) => {
                    setWebsiteUrl(e.target.value);
                    if (validationErrors.websiteUrl) {
                      setValidationErrors({ ...validationErrors, websiteUrl: undefined });
                    }
                  }}
                  disabled={isExtracting}
                  className={`bg-background border-input text-foreground ${validationErrors.websiteUrl ? 'border-destructive' : ''}`}
                />
                {validationErrors.websiteUrl && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.websiteUrl}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  We'll analyze your website to extract colors, fonts, and brand voice
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Business Name <span className="text-xs text-muted-foreground">(optional - we'll try to detect it)</span>
                </Label>
                <Input
                  id="businessName"
                  type="text"
                  placeholder="Your Company Name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  disabled={isExtracting}
                  className="bg-background border-input text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Logo <span className="text-xs text-muted-foreground">(optional - helps with color extraction)</span>
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={isExtracting}
                    className="bg-background border-input text-foreground flex-1"
                  />
                  {logoPreview && (
                    <img src={logoPreview} alt="Logo preview" className="h-12 w-12 object-contain rounded border border-border" />
                  )}
                </div>
              </div>

              <Button
                onClick={extractBrandGuidelines}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isExtracting}
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing your brand...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Extract Brand Guidelines
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={handleSkipToManual}
                className="w-full text-muted-foreground"
                disabled={isExtracting}
              >
                Skip and set up manually in Settings
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              {/* Validation errors banner */}
              {Object.keys(validationErrors).length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please fix the errors below before continuing.
                  </AlertDescription>
                </Alert>
              )}

              {/* Editable Business Name */}
              <div className="space-y-2">
                <Label htmlFor="editBusinessName" className="text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Business Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="editBusinessName"
                  value={businessName}
                  onChange={(e) => {
                    setBusinessName(e.target.value);
                    if (validationErrors.businessName) {
                      setValidationErrors({ ...validationErrors, businessName: undefined });
                    }
                  }}
                  className={`bg-background border-input text-foreground ${validationErrors.businessName ? 'border-destructive' : ''}`}
                />
                {validationErrors.businessName && (
                  <p className="text-sm text-destructive">{validationErrors.businessName}</p>
                )}
              </div>

              {/* Editable Industry */}
              <div className="space-y-2">
                <Label htmlFor="editIndustry" className="text-foreground">
                  Industry <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={industry} 
                  onValueChange={(v) => {
                    setIndustry(v);
                    if (validationErrors.industry) {
                      setValidationErrors({ ...validationErrors, industry: undefined });
                    }
                  }}
                >
                  <SelectTrigger className={`bg-background border-input text-foreground ${validationErrors.industry ? 'border-destructive' : ''}`}>
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_VERTICALS.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {validationErrors.industry && (
                  <p className="text-sm text-destructive">{validationErrors.industry}</p>
                )}
              </div>

              {/* Editable Brand Colors */}
              <div className="space-y-3">
                <Label className="text-foreground flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Brand Colors <Edit2 className="h-3 w-3 text-muted-foreground" />
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Primary</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editPrimaryColor}
                        onChange={(e) => setEditPrimaryColor(e.target.value)}
                        className="h-8 w-8 rounded cursor-pointer border border-border"
                      />
                      <Input
                        value={editPrimaryColor}
                        onChange={(e) => setEditPrimaryColor(e.target.value)}
                        className="h-8 text-xs font-mono"
                        maxLength={7}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Secondary</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editSecondaryColor}
                        onChange={(e) => setEditSecondaryColor(e.target.value)}
                        className="h-8 w-8 rounded cursor-pointer border border-border"
                      />
                      <Input
                        value={editSecondaryColor}
                        onChange={(e) => setEditSecondaryColor(e.target.value)}
                        className="h-8 text-xs font-mono"
                        maxLength={7}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Accent</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editAccentColor}
                        onChange={(e) => setEditAccentColor(e.target.value)}
                        className="h-8 w-8 rounded cursor-pointer border border-border"
                      />
                      <Input
                        value={editAccentColor}
                        onChange={(e) => setEditAccentColor(e.target.value)}
                        className="h-8 text-xs font-mono"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Typography */}
              <div className="space-y-3">
                <Label className="text-foreground flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Typography <Edit2 className="h-3 w-3 text-muted-foreground" />
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Heading Font</Label>
                    <Input
                      value={editHeadingFont}
                      onChange={(e) => setEditHeadingFont(e.target.value)}
                      placeholder="Inter"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Body Font</Label>
                    <Input
                      value={editBodyFont}
                      onChange={(e) => setEditBodyFont(e.target.value)}
                      placeholder="Inter"
                      className="h-8"
                    />
                  </div>
                </div>
              </div>

              {/* Editable Brand Voice */}
              <div className="space-y-2">
                <Label className="text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Brand Voice <Edit2 className="h-3 w-3 text-muted-foreground" />
                </Label>
                <textarea
                  value={editBrandVoice}
                  onChange={(e) => setEditBrandVoice(e.target.value)}
                  placeholder="Describe your brand's communication style..."
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Logo preview */}
              {(logoPreview || brandGuidelines?.logo) && (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <img 
                    src={logoPreview || brandGuidelines?.logo} 
                    alt="Logo" 
                    className="h-12 w-12 object-contain rounded"
                  />
                  <span className="text-sm text-muted-foreground">Logo will be saved to your profile</span>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1"
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  onClick={saveBusinessProfile}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Complete Setup"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
