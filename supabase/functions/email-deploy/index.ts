import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assetId } = await req.json();

    if (!assetId) {
      throw new Error("Asset ID is required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Fetch the asset details
    const { data: asset, error: assetError } = await supabaseClient
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      throw new Error("Asset not found");
    }

    if (asset.type !== "email") {
      throw new Error("Asset must be of type 'email'");
    }

    if (asset.status !== "approved" && asset.status !== "live") {
      throw new Error("Asset must be approved before deployment");
    }

    // Extract email content from asset
    const emailContent = asset.content as any;
    const subject = emailContent?.subject || asset.name;
    const htmlBody = emailContent?.html || emailContent?.body || "";
    
    // Get recipients from explicit list or from linked CRM leads
    let recipientList = emailContent?.recipients || [];
    const targetLeads = emailContent?.target_leads || [];
    
    // If no explicit recipients, use email addresses from linked CRM leads
    if (recipientList.length === 0 && targetLeads.length > 0) {
      recipientList = targetLeads
        .filter((lead: any) => lead.email)
        .map((lead: any) => lead.email);
      console.log(`Using ${recipientList.length} emails from linked CRM leads`);
    }

    if (!recipientList.length) {
      throw new Error("No recipients specified - add recipients or link CRM leads with email addresses");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Find existing campaign or create new one
    let campaign;
    const { data: existingCampaign } = await supabaseClient
      .from("campaigns")
      .select("*")
      .eq("asset_id", assetId)
      .eq("channel", "email")
      .single();

    if (existingCampaign) {
      // Update existing campaign
      const { data: updatedCampaign, error: updateError } = await supabaseClient
        .from("campaigns")
        .update({
          status: "deploying",
          deployed_at: new Date().toISOString(),
          target_audience: { recipients: recipientList },
        })
        .eq("id", existingCampaign.id)
        .select()
        .single();

      if (updateError) {
        throw new Error("Failed to update campaign record");
      }
      campaign = updatedCampaign;
    } else {
      // Create new campaign if none exists
      const { data: newCampaign, error: campaignError } = await supabaseClient
        .from("campaigns")
        .insert({
          asset_id: assetId,
          channel: "email",
          status: "deploying",
          deployed_at: new Date().toISOString(),
          target_audience: { recipients: recipientList },
        })
        .select()
        .single();

      if (campaignError || !newCampaign) {
        throw new Error("Failed to create campaign record");
      }
      campaign = newCampaign;
    }

    // Send emails via Resend REST API
    let sentCount = 0;
    let failedCount = 0;
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    const emailPromises = recipientList.map(async (recipient: string, index: number) => {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Playkout Marketing <onboarding@resend.dev>",
            to: [recipient],
            subject: subject,
            html: htmlBody,
            tags: [
              { name: "campaign_id", value: campaign.id },
              { name: "asset_id", value: assetId },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`Resend API error: ${response.status}`);
        }
        sentCount++;
        
        // Log lead activity if this email came from a linked lead
        const linkedLead = targetLeads.find((lead: any) => lead.email === recipient);
        if (linkedLead && linkedLead.id) {
          try {
            await supabaseClient.from('lead_activities').insert({
              lead_id: linkedLead.id,
              activity_type: 'email_sent',
              description: `Email campaign sent: ${subject}`,
              created_by: user?.id,
              metadata: { campaignId: campaign.id, assetId, subject },
            });
          } catch (e) {
            console.error('Failed to log lead activity:', e);
          }
        }
      } catch (error) {
        console.error(`Failed to send to ${recipient}:`, error);
        failedCount++;
      }
    });

    await Promise.all(emailPromises);

    // Update or create metrics record
    const { data: existingMetrics } = await supabaseClient
      .from("campaign_metrics")
      .select("*")
      .eq("campaign_id", campaign.id)
      .single();

    if (existingMetrics) {
      // Update existing metrics
      await supabaseClient
        .from("campaign_metrics")
        .update({
          sent_count: sentCount,
          delivered_count: 0, // Will be updated via webhook
          open_count: 0,
          click_count: 0,
          bounce_count: failedCount,
          last_synced_at: new Date().toISOString(),
        })
        .eq("campaign_id", campaign.id);
    } else {
      // Create new metrics if none exist
      await supabaseClient.from("campaign_metrics").insert({
        campaign_id: campaign.id,
        sent_count: sentCount,
        delivered_count: 0,
        open_count: 0,
        click_count: 0,
        bounce_count: failedCount,
      });
    }

    // Update campaign status
    await supabaseClient
      .from("campaigns")
      .update({ status: sentCount > 0 ? "active" : "failed" })
      .eq("id", campaign.id);

    // Update asset status to live
    if (sentCount > 0) {
      await supabaseClient
        .from("assets")
        .update({ status: "live" })
        .eq("id", assetId);
    }

    console.log(`Email campaign deployed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        campaignId: campaign.id,
        sentCount,
        failedCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in email-deploy function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
