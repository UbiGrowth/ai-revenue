import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pickleball-specific image prompts by asset type and vertical
const getPickleballPrompt = (assetType: string, vertical: string, campaignName: string, goal: string) => {
  const verticalContext: Record<string, string> = {
    "Hotels & Resorts": "luxury resort setting with palm trees, infinity pool in background, guests enjoying pickleball on pristine courts",
    "Multifamily Real Estate": "modern apartment complex amenity center, residents playing pickleball, community gathering around courts",
    "Pickleball Clubs & Country Clubs": "premium indoor/outdoor pickleball facility, professional players in action, tournament atmosphere",
    "Entertainment Venues": "vibrant entertainment complex with neon lighting, social pickleball experience, food and drinks nearby",
    "Physical Therapy": "rehabilitation center with therapeutic pickleball session, medical staff supervising, adaptive equipment",
    "Corporate Offices & Co-Working Spaces": "corporate wellness center, employees in business casual playing pickleball, team building event",
    "Education": "school gymnasium with students learning pickleball, colorful equipment, PE class atmosphere",
    "Gyms": "fitness center with dedicated pickleball courts, athletic members, high-energy workout environment",
  };

  const typeContext: Record<string, string> = {
    video: "cinematic wide shot, dynamic action, motion blur on paddle",
    email: "clean professional composition, welcoming atmosphere, bright lighting",
    landing_page: "hero image style, dramatic lighting, call-to-action ready",
    voice: "person on phone in pickleball setting, conversational moment",
  };

  const context = verticalContext[vertical] || verticalContext["Pickleball Clubs & Country Clubs"];
  const typeStyle = typeContext[assetType] || typeContext.landing_page;

  return `Professional marketing photograph for pickleball facility: ${context}. ${typeStyle}. 
Campaign: "${campaignName}". Goal: ${goal || "Drive engagement"}.
REQUIREMENTS: Ultra high resolution, professional sports photography, PlayKout branded facility, 
bright green pickleball court lines visible, paddles and pickleballs prominent, 
happy engaged people playing or watching pickleball, NO tennis, NO other sports,
clean modern aesthetic, marketing-ready composition, 16:9 aspect ratio.`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assetId, assetType, vertical, campaignName, goal } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const prompt = getPickleballPrompt(
      assetType || "landing_page",
      vertical || "Pickleball Clubs & Country Clubs",
      campaignName || "Pickleball Marketing Campaign",
      goal || "Drive engagement and conversions"
    );

    console.log(`Generating pickleball thumbnail for ${campaignName} (${assetType})`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Image generation error:", response.status, errorText);
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error("No image generated");
    }

    // Update asset with generated thumbnail
    if (assetId) {
      const { data: asset } = await supabaseClient
        .from("assets")
        .select("content")
        .eq("id", assetId)
        .single();

      await supabaseClient
        .from("assets")
        .update({
          preview_url: imageUrl,
          content: {
            ...(asset?.content || {}),
            hero_image_url: imageUrl,
            thumbnail_generated_at: new Date().toISOString(),
          },
        })
        .eq("id", assetId);

      console.log(`Updated asset ${assetId} with generated thumbnail`);
    }

    return new Response(
      JSON.stringify({ success: true, imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-campaign-thumbnail:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
