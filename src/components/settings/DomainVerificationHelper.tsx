/**
 * Domain Verification Helper
 * Helps users verify their sending domain with Resend
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Globe, 
  ExternalLink,
  Copy,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

interface DomainVerificationHelperProps {
  domain: string;
  emailMethod: "resend" | "gmail" | "smtp";
  isGmailConnected?: boolean;
}

type VerificationStatus = "unknown" | "checking" | "verified" | "unverified" | "partial";

export function DomainVerificationHelper({
  domain,
  emailMethod,
  isGmailConnected = false,
}: DomainVerificationHelperProps) {
  const [status, setStatus] = useState<VerificationStatus>("unknown");
  const [checking, setChecking] = useState(false);

  // DNS records needed for Resend domain verification
  const dnsRecords = [
    {
      type: "MX",
      name: `${domain}`,
      value: "feedback-smtp.us-east-1.amazonses.com",
      priority: "10",
    },
    {
      type: "TXT",
      name: `resend._domainkey.${domain}`,
      value: "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBg...",
      priority: null,
    },
    {
      type: "TXT",
      name: `${domain}`,
      value: `v=spf1 include:amazonses.com ~all`,
      priority: null,
    },
  ];

  const checkDomainStatus = async () => {
    if (!domain) {
      toast.error("No domain to check");
      return;
    }

    setChecking(true);
    setStatus("checking");

    try {
      // Simulate domain check - in production this would call an API
      // to verify DNS records or check with Resend
      await new Promise(resolve => setTimeout(resolve, 1500));

      // For demo purposes, show as unverified with guidance
      // In production, this would actually check Resend's API
      setStatus("unverified");
    } catch (error) {
      toast.error("Failed to check domain status");
      setStatus("unknown");
    } finally {
      setChecking(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Gmail doesn't need domain verification
  if (emailMethod === "gmail" && isGmailConnected) {
    return (
      <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <p className="font-medium text-green-700">Domain Verified via Gmail</p>
            <p className="text-sm text-green-600">
              Your emails are sent through Gmail's authenticated servers.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!domain) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No Domain Detected</AlertTitle>
        <AlertDescription>
          Enter a From Address above to check domain verification status.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <span className="font-medium">{domain}</span>
          </div>
          
          {status === "unknown" && (
            <Badge variant="outline">Not Checked</Badge>
          )}
          {status === "checking" && (
            <Badge variant="outline" className="text-blue-500 border-blue-500">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Checking
            </Badge>
          )}
          {status === "verified" && (
            <Badge className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          )}
          {status === "unverified" && (
            <Badge variant="outline" className="text-amber-500 border-amber-500">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Not Verified
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={checkDomainStatus}
            disabled={checking}
          >
            {checking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Status
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("https://resend.com/domains", "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Resend
          </Button>
        </div>
      </div>

      {status === "unverified" && (
        <div className="space-y-4">
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-700">Domain Verification Required</AlertTitle>
            <AlertDescription className="text-amber-600">
              To send emails from <strong>{domain}</strong>, you need to add DNS records in your domain provider.
              Emails may fail or go to spam until verified.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Required DNS Records:</h4>
            
            <div className="space-y-2">
              {dnsRecords.map((record, i) => (
                <div
                  key={i}
                  className="p-3 rounded border bg-background text-sm flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{record.type}</Badge>
                      {record.priority && (
                        <span className="text-xs text-muted-foreground">Priority: {record.priority}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">Name:</p>
                    <p className="font-mono text-xs break-all">{record.name}</p>
                    <p className="text-xs text-muted-foreground mt-2 mb-1">Value:</p>
                    <p className="font-mono text-xs break-all text-muted-foreground">{record.value}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => copyToClipboard(record.value)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Note: DNS changes can take 1-48 hours to propagate. The exact records required will be shown 
              in your <a href="https://resend.com/domains" target="_blank" className="text-primary underline">Resend dashboard</a>.
            </p>
          </div>
        </div>
      )}

      {status === "verified" && (
        <Alert className="border-green-500/30 bg-green-500/5">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-700">Domain Verified</AlertTitle>
          <AlertDescription className="text-green-600">
            Your domain is properly configured. Emails from {domain} will have optimal deliverability.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default DomainVerificationHelper;
