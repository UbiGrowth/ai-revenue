import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  recipients: string[];  // Array of email addresses
  subject: string;
  body: string;
  fromName?: string;
  fromAddress?: string;
  assetId?: string;
  // Legacy single recipient support
  to?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: TestEmailRequest = await req.json();
    const { recipients, subject, body, fromName, fromAddress, assetId, to } = requestData;

    // Support both new array format and legacy single 'to' format
    let emailList: string[] = [];
    if (recipients && Array.isArray(recipients)) {
      emailList = recipients.filter(e => e && typeof e === 'string' && e.includes('@'));
    } else if (to) {
      emailList = [to];
    }

    if (emailList.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid email recipients provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit to 20 recipients per test
    if (emailList.length > 20) {
      return new Response(
        JSON.stringify({ error: "Maximum 20 test recipients allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const senderName = fromName || "UbiGrowth Test";
    const senderAddress = fromAddress || "onboarding@resend.dev";
    const emailSubject = subject || "Test Email from UbiGrowth";
    const emailBody = body || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1DA4FF;">Test Email</h1>
        <p>This is a test email to verify your email configuration is working correctly.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">
          If you received this email, your email delivery is configured correctly.
        </p>
      </div>
    `;

    console.log(`[test-email] Sending test email to ${emailList.length} recipient(s) from ${senderName} <${senderAddress}>`);
    if (assetId) {
      console.log(`[test-email] Asset ID: ${assetId}`);
    }

    // Send to all recipients using Resend API directly
    const results = await Promise.allSettled(
      emailList.map(async (recipient) => {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${senderName} <${senderAddress}>`,
            to: [recipient],
            subject: emailSubject,
            html: emailBody,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to send to ${recipient}`);
        }
        
        return { recipient, response: await response.json() };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    console.log(`[test-email] Sent: ${successful.length}, Failed: ${failed.length}`);

    if (failed.length > 0) {
      failed.forEach((f, i) => {
        if (f.status === 'rejected') {
          console.error(`[test-email] Failed for recipient ${i}:`, f.reason);
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentCount: successful.length,
        failedCount: failed.length,
        recipients: emailList,
        from: `${senderName} <${senderAddress}>`,
        subject: emailSubject,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[test-email] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
