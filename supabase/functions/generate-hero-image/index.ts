import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImageRequest {
  vertical: string;
  assetGoal?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vertical, assetGoal }: ImageRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // PICKLEBALL DEFINITION FOR AI MODELS - THIS IS NOT TENNIS:
    // - PADDLES: Solid rectangular paddles (like oversized ping-pong paddles), NOT stringed tennis rackets
    // - BALL: Perforated plastic wiffle ball with holes, NOT fuzzy yellow tennis ball
    // - COURT: Smaller court (20x44 feet) with "kitchen" zone, NOT large tennis court
    // - NET: Lower net (34 inches), NOT tennis height
    
    const pickleballDefinition = `CRITICAL: This is PICKLEBALL, NOT tennis. Visual requirements:
    - Players holding SOLID RECTANGULAR PADDLES (like large ping-pong paddles) - NO stringed tennis rackets
    - PERFORATED PLASTIC BALLS with visible holes (wiffle ball style) - NO fuzzy yellow tennis balls  
    - SMALL courts (20x44 ft) with kitchen/non-volley zones - NOT large tennis courts
    - Lower nets (34 inches) - NOT tennis height
    NEGATIVE: Absolutely NO tennis rackets, NO tennis balls, NO tennis courts.`;

    // Create vertical-specific image prompts with explicit pickleball requirements
    const verticalPrompts: Record<string, string> = {
      'Hotels & Resorts': `${pickleballDefinition}. PlayKout luxury resort with PICKLEBALL courts (small courts with kitchen zones), guests holding SOLID PADDLES, PERFORATED BALLS visible, ocean view, PlayKout signage, sunset lighting, ultra high resolution`,
      'Multifamily Real Estate': `${pickleballDefinition}. PlayKout apartment complex with community PICKLEBALL courts, residents with SOLID PADDLES and WIFFLE BALLS, PlayKout branded facilities, modern architecture, golden hour, ultra high resolution`,
      'Pickleball Clubs & Country Clubs': `${pickleballDefinition}. PlayKout championship PICKLEBALL facility, green courts with kitchen zones, players holding SOLID PADDLES hitting PERFORATED BALLS, PlayKout clubhouse, professional photography, ultra high resolution`,
      'Entertainment Venues': `${pickleballDefinition}. PlayKout PICKLEBALL tournament venue, stadium seating, players with SOLID PADDLES and WIFFLE BALLS, dramatic lighting, PlayKout sponsorship banners, ultra high resolution`,
      'Physical Therapy': `${pickleballDefinition}. PlayKout sports therapy clinic, therapist with PICKLEBALL player, SOLID PADDLES and PERFORATED BALLS visible, modern healthcare facility, professional photography, ultra high resolution`,
      'Corporate Offices & Co-Working Spaces': `${pickleballDefinition}. PlayKout corporate rooftop PICKLEBALL court, professionals with SOLID PADDLES and WIFFLE BALLS, modern office building, PlayKout branded workspace, natural light, ultra high resolution`,
      'Education': `${pickleballDefinition}. PlayKout campus PICKLEBALL courts, students learning with SOLID PADDLES and PERFORATED BALLS, modern athletic facility, PlayKout educational signage, bright lighting, ultra high resolution`,
      'Gyms': `${pickleballDefinition}. PlayKout fitness center with indoor PICKLEBALL courts, athletes training with SOLID PADDLES and WIFFLE BALLS, modern gym equipment, PlayKout branding, dynamic lighting, ultra high resolution`
    };

    let imagePrompt = verticalPrompts[vertical] || `${pickleballDefinition}. PlayKout pickleball facility with SOLID PADDLES and PERFORATED BALLS, professional marketing hero image, PlayKout branding, ultra high resolution`;
    
    // Add goal-specific context if provided
    if (assetGoal) {
      imagePrompt = `${imagePrompt}. PlayKout pickleball focus on: ${assetGoal}`;
    }

    console.log("Generating image with prompt:", imagePrompt);

    // Call Lovable AI image generation
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: imagePrompt
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error("No image generated");
    }

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl,
        vertical,
        prompt: imagePrompt
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in generate-hero-image:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});