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
    const event = await req.json();
    console.log("Resend webhook received:", event);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Extract campaign_id from tags
    const campaignId = event.data?.tags?.find(
      (tag: any) => tag.name === "campaign_id"
    )?.value;

    if (!campaignId) {
      console.log("No campaign_id found in webhook event");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch current metrics
    const { data: metrics, error: metricsError } = await supabaseClient
      .from("campaign_metrics")
      .select("*")
      .eq("campaign_id", campaignId)
      .single();

    if (metricsError || !metrics) {
      console.error("Metrics not found for campaign:", campaignId);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update metrics based on event type
    let updates: any = {
      last_synced_at: new Date().toISOString(),
    };

    switch (event.type) {
      case "email.delivered":
        updates.delivered_count = (metrics.delivered_count || 0) + 1;
        break;
      case "email.opened":
        updates.open_count = (metrics.open_count || 0) + 1;
        break;
      case "email.clicked":
        updates.click_count = (metrics.click_count || 0) + 1;
        updates.clicks = (metrics.clicks || 0) + 1;
        break;
      case "email.bounced":
        updates.bounce_count = (metrics.bounce_count || 0) + 1;
        break;
      case "email.complained":
        // Treat complaints as unsubscribes
        updates.unsubscribe_count = (metrics.unsubscribe_count || 0) + 1;
        break;
    }

    // Calculate engagement rate
    if (updates.delivered_count || metrics.delivered_count > 0) {
      const delivered = updates.delivered_count || metrics.delivered_count;
      const opened = updates.open_count || metrics.open_count || 0;
      const clicked = updates.click_count || metrics.click_count || 0;
      updates.engagement_rate = (((opened + clicked) / delivered) * 100).toFixed(2);
    }

    // Update metrics
    const { error: updateError } = await supabaseClient
      .from("campaign_metrics")
      .update(updates)
      .eq("campaign_id", campaignId);

    if (updateError) {
      console.error("Error updating metrics:", updateError);
    }

    console.log(`Updated metrics for campaign ${campaignId}:`, updates);

    return new Response(JSON.stringify({ received: true, updated: updates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in email-webhook function:", error);
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
