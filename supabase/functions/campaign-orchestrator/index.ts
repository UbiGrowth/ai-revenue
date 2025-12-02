import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignName, vertical, goal, location, businessType, budget } = await req.json();

    const authHeader = req.headers.get("Authorization");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    console.log("Starting campaign orchestration:", { campaignName, vertical, goal });

    // Fetch business profile for context
    const { data: businessProfile } = await supabaseClient
      .from("business_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    console.log("Business profile loaded:", businessProfile ? "Yes" : "No");

    // Fetch previous campaign performance data for optimization
    let campaignInsights: any = null;
    try {
      const { data: previousCampaigns } = await supabaseClient
        .from("campaigns")
        .select(`
          id,
          channel,
          status,
          campaign_metrics (
            impressions,
            clicks,
            conversions,
            open_count,
            engagement_rate,
            revenue
          )
        `)
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (previousCampaigns && previousCampaigns.length > 0) {
        // Calculate insights from previous campaigns
        const metrics = previousCampaigns
          .filter(c => c.campaign_metrics && c.campaign_metrics.length > 0)
          .flatMap(c => c.campaign_metrics);
        
        if (metrics.length > 0) {
          const avgEngagement = metrics.reduce((sum, m) => sum + (m.engagement_rate || 0), 0) / metrics.length;
          const totalConversions = metrics.reduce((sum, m) => sum + (m.conversions || 0), 0);
          
          campaignInsights = {
            total_previous_campaigns: previousCampaigns.length,
            avg_engagement_rate: avgEngagement.toFixed(2),
            total_conversions: totalConversions,
            performance_note: avgEngagement > 5 ? "High engagement - maintain current approach" : "Focus on improving engagement"
          };
          console.log("Campaign insights loaded:", campaignInsights);
        }
      }
    } catch (error) {
      console.error("Error fetching campaign insights:", error);
    }

    // Merge campaign insights into business profile for content generation
    const enrichedProfile = businessProfile ? {
      ...businessProfile,
      campaign_insights: campaignInsights
    } : campaignInsights ? { campaign_insights: campaignInsights } : null;

    let leadsScraped = 0;
    let leadIds: string[] = [];

    // Step 1: Scrape leads if location and businessType provided
    if (location && businessType) {
      try {
        const { data: scrapedData } = await supabaseClient.functions.invoke("scrape-google-maps", {
          body: { location, businessType, radius: 50000, maxResults: 50 },
        });
        leadsScraped = scrapedData?.imported || 0;
        console.log(`Scraped ${leadsScraped} leads`);
      } catch (error) {
        console.error("Lead scraping failed:", error);
      }
    }

    // Fetch leads with phone numbers for voice campaigns and emails for email campaigns
    const { data: crmLeads } = await supabaseClient
      .from("leads")
      .select("id, first_name, last_name, email, phone, company, status")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (crmLeads) {
      leadIds = crmLeads.map(l => l.id);
      console.log(`Found ${leadIds.length} CRM leads to link to campaign`);
    }

    // Separate leads by channel capability
    const leadsWithPhone = crmLeads?.filter(l => l.phone) || [];
    const leadsWithEmail = crmLeads?.filter(l => l.email) || [];

    const assetsCreated: string[] = [];
    const campaignIds: string[] = [];
    
    // Calculate budget per channel (split evenly across 4 channels)
    const budgetPerChannel = budget ? Math.floor(budget / 4) : 1000;

    // Step 2: Generate email campaign - linked to CRM leads with emails
    try {
      const { data: emailContent } = await supabaseClient.functions.invoke("content-generate", {
        body: { vertical, contentType: "email", assetGoal: goal, businessProfile: enrichedProfile },
      });

      const { data: emailImage } = await supabaseClient.functions.invoke("generate-hero-image", {
        body: { vertical, contentType: "email", goal },
      });

      const { data: emailAsset } = await supabaseClient.from("assets").insert({
        name: `${campaignName} - Email Campaign`,
        type: "email",
        status: "review",
        channel: "email",
        goal: goal,
        created_by: user.id,
        content: {
          subject: emailContent?.subject || `${campaignName}`,
          body: emailContent?.content || "",
          vertical,
          hero_image_url: emailImage?.imageUrl,
          preview_url: emailImage?.imageUrl,
          // Link to CRM leads with emails
          target_leads: leadsWithEmail.map(l => ({ 
            id: l.id, 
            email: l.email, 
            name: `${l.first_name} ${l.last_name}`,
            company: l.company
          })),
          total_recipients: leadsWithEmail.length,
        },
        preview_url: emailImage?.imageUrl,
      }).select().single();

      if (emailAsset) {
        assetsCreated.push(emailAsset.id);
        
        // Create campaign record linked to leads
        const { data: emailCampaign } = await supabaseClient.from("campaigns").insert({
          asset_id: emailAsset.id,
          channel: "email",
          status: "pending",
          budget_allocated: budgetPerChannel,
          target_audience: { 
            vertical, 
            campaignName, 
            goal,
            lead_ids: leadsWithEmail.map(l => l.id),
            total_leads: leadsWithEmail.length,
          },
        }).select().single();
        
        if (emailCampaign) {
          campaignIds.push(emailCampaign.id);
        }
      }
    } catch (error) {
      console.error("Email generation failed:", error);
    }

    // Step 3: Generate social media post
    try {
      const { data: socialContent } = await supabaseClient.functions.invoke("content-generate", {
        body: { vertical, contentType: "social", assetGoal: goal, businessProfile: enrichedProfile },
      });

      const { data: socialImage } = await supabaseClient.functions.invoke("generate-hero-image", {
        body: { vertical, contentType: "social", goal },
      });

      const { data: socialAsset } = await supabaseClient.from("assets").insert({
        name: `${campaignName} - Social Post`,
        type: "landing_page",
        status: "review",
        channel: "social",
        goal: goal,
        created_by: user.id,
        content: {
          text: socialContent?.content || "",
          vertical,
          hero_image_url: socialImage?.imageUrl,
          preview_url: socialImage?.imageUrl,
        },
        preview_url: socialImage?.imageUrl,
      }).select().single();

      if (socialAsset) {
        assetsCreated.push(socialAsset.id);
        
        const { data: socialCampaign } = await supabaseClient.from("campaigns").insert({
          asset_id: socialAsset.id,
          channel: "social",
          status: "pending",
          budget_allocated: budgetPerChannel,
          target_audience: { vertical, campaignName, goal },
        }).select().single();
        
        if (socialCampaign) {
          campaignIds.push(socialCampaign.id);
        }
      }
    } catch (error) {
      console.error("Social post generation failed:", error);
    }

    // Step 4: Generate video
    try {
      const { data: videoContent } = await supabaseClient.functions.invoke("content-generate", {
        body: { vertical, contentType: "video", assetGoal: goal, businessProfile: enrichedProfile },
      });

      const { data: videoAsset } = await supabaseClient.from("assets").insert({
        name: `${campaignName} - Video`,
        type: "video",
        status: "review",
        channel: "video",
        goal: goal,
        created_by: user.id,
        content: {
          script: videoContent?.content || "",
          vertical,
          goal,
        },
      }).select().single();

      if (videoAsset) {
        assetsCreated.push(videoAsset.id);
        
        const { data: videoCampaign } = await supabaseClient.from("campaigns").insert({
          asset_id: videoAsset.id,
          channel: "video",
          status: "pending",
          budget_allocated: budgetPerChannel,
          target_audience: { vertical, campaignName, goal },
        }).select().single();
        
        if (videoCampaign) campaignIds.push(videoCampaign.id);
        
        // Trigger video generation in background
        supabaseClient.functions.invoke("generate-video", {
          body: {
            assetId: videoAsset.id,
            vertical,
            prompt: videoContent?.content || goal,
          },
        }).catch(console.error);
      }
    } catch (error) {
      console.error("Video generation failed:", error);
    }

    // Step 5: Generate voice campaign - linked to CRM leads with phone numbers
    try {
      const { data: voiceContent } = await supabaseClient.functions.invoke("content-generate", {
        body: { vertical, contentType: "voice", assetGoal: goal, businessProfile: enrichedProfile },
      });

      const { data: voiceAsset } = await supabaseClient.from("assets").insert({
        name: `${campaignName} - Voice Campaign`,
        type: "voice",
        status: "review",
        channel: "voice",
        goal: goal,
        created_by: user.id,
        content: {
          script: voiceContent?.content || "",
          vertical,
          goal,
          // Link to CRM leads with phone numbers for outbound calls
          target_leads: leadsWithPhone.map(l => ({ 
            id: l.id, 
            phone: l.phone, 
            name: `${l.first_name} ${l.last_name}`,
            company: l.company
          })),
          total_calls: leadsWithPhone.length,
          call_status: "pending", // pending, in_progress, completed
        },
      }).select().single();

      if (voiceAsset) {
        assetsCreated.push(voiceAsset.id);
        
        // Create campaign record linked to leads
        const { data: voiceCampaign } = await supabaseClient.from("campaigns").insert({
          asset_id: voiceAsset.id,
          channel: "voice",
          status: "pending",
          budget_allocated: budgetPerChannel,
          target_audience: { 
            vertical, 
            campaignName, 
            goal,
            lead_ids: leadsWithPhone.map(l => l.id),
            total_leads: leadsWithPhone.length,
          },
        }).select().single();
        
        if (voiceCampaign) campaignIds.push(voiceCampaign.id);
      }
    } catch (error) {
      console.error("Voice campaign generation failed:", error);
    }

    console.log(`Campaign created with ${assetsCreated.length} assets and ${campaignIds.length} campaigns`);
    console.log(`Voice campaign linked to ${leadsWithPhone.length} leads with phone numbers`);
    console.log(`Email campaign linked to ${leadsWithEmail.length} leads with emails`);

    return new Response(
      JSON.stringify({
        success: true,
        campaignName,
        assetsCreated: assetsCreated.length,
        campaignsCreated: campaignIds.length,
        leadsScraped,
        leadsLinked: {
          voice: leadsWithPhone.length,
          email: leadsWithEmail.length,
        },
        assetIds: assetsCreated,
        campaignIds: campaignIds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in campaign-orchestrator:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
