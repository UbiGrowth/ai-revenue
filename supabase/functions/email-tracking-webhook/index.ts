import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const event = await req.json();
    console.log("Resend webhook received:", JSON.stringify(event));

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Extract lead_id from tags
    const leadId = event.data?.tags?.find(
      (tag: any) => tag.name === "lead_id"
    )?.value;

    if (!leadId) {
      console.log("No lead_id found in webhook event");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let activityType = "";
    let description = "";

    switch (event.type) {
      case "email.delivered":
        activityType = "email_delivered";
        description = "Outreach email was delivered";
        break;
      case "email.opened":
        activityType = "email_opened";
        description = "Lead opened outreach email";
        break;
      case "email.clicked":
        activityType = "email_clicked";
        description = `Lead clicked link in email: ${event.data?.click?.link || "unknown"}`;
        break;
      case "email.bounced":
        activityType = "email_bounced";
        description = "Email bounced - delivery failed";
        break;
      default:
        console.log("Unhandled event type:", event.type);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Log activity
    const { error: activityError } = await supabaseClient
      .from("lead_activities")
      .insert({
        lead_id: leadId,
        activity_type: activityType,
        description: description,
        metadata: {
          email_id: event.data?.email_id,
          timestamp: event.created_at,
          raw_event: event.type,
        },
      });

    if (activityError) {
      console.error("Error logging activity:", activityError);
    }

    // Trigger automated lead scoring recalculation
    if (event.type === "email.opened" || event.type === "email.clicked") {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        
        await fetch(`${supabaseUrl}/functions/v1/auto-score-lead`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ leadId }),
        });
        console.log(`Triggered auto-scoring for lead ${leadId}`);
      } catch (scoreError) {
        console.error("Error triggering auto-score:", scoreError);
      }
    }

    console.log(`Tracked ${activityType} for lead ${leadId}`);

    return new Response(JSON.stringify({ received: true, tracked: activityType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in email-tracking-webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
