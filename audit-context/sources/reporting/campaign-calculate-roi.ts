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
    const { campaignId } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // If campaignId provided, calculate for that campaign
    // Otherwise, calculate for all campaigns
    let query = supabaseClient
      .from("campaign_metrics")
      .select("*, campaigns!inner(id, channel, budget_allocated, asset_id)");

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    const { data: metricsData, error: metricsError } = await query;

    if (metricsError) {
      throw new Error("Failed to fetch campaign metrics");
    }

    const updates = [];

    for (const metric of metricsData || []) {
      const campaign = (metric as any).campaigns;
      
      // Calculate revenue based on channel-specific conversions
      // Using simple conversion values for demonstration
      let estimatedRevenue = 0;
      const conversionValue = 50; // $50 per conversion (adjust as needed)

      if (campaign.channel === "email") {
        // For email: revenue from clicks (assuming some convert)
        const estimatedConversions = Math.floor((metric.click_count || 0) * 0.02); // 2% conversion rate
        estimatedRevenue = estimatedConversions * conversionValue;
      } else {
        // For other channels, use conversions directly
        estimatedRevenue = (metric.conversions || 0) * conversionValue;
      }

      const cost = parseFloat(campaign.budget_allocated || 0);
      const roi = cost > 0 ? ((estimatedRevenue - cost) / cost) * 100 : 0;

      updates.push({
        campaign_id: metric.campaign_id,
        revenue: estimatedRevenue,
        cost: cost,
        roi: roi.toFixed(2),
      });

      // Update the metric
      await supabaseClient
        .from("campaign_metrics")
        .update({
          revenue: estimatedRevenue,
          cost: cost,
        })
        .eq("campaign_id", metric.campaign_id);
    }

    console.log(`ROI calculated for ${updates.length} campaigns`);

    return new Response(
      JSON.stringify({
        success: true,
        updated: updates.length,
        campaigns: updates,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in campaign-calculate-roi function:", error);
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
