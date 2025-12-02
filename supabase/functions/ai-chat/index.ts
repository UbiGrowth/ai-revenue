import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages }: { messages: ChatMessage[] } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // System prompt for the PlayKout AI assistant - emphasizing pickleball theme
    const systemPrompt = `You are the PlayKout AI Assistant, an expert in marketing automation for PlayKout pickleball facilities and programs. You help users with:

- Creating effective PlayKout pickleball marketing campaigns across video, email, and social media
- Writing compelling content about PlayKout pickleball courts, tournaments, coaching, and community
- Optimizing PlayKout campaign performance and ROI across all industry verticals
- Audience targeting and segmentation strategies for pickleball enthusiasts and facility users
- Best practices for promoting PlayKout pickleball offerings in 8 verticals: Hotels & Resorts with pickleball amenities, Multifamily Real Estate with pickleball courts, Pickleball Clubs, Entertainment Venues hosting pickleball events, Physical Therapy for pickleball athletes, Corporate Offices with pickleball facilities, Education institutions with pickleball programs, and Gyms with pickleball training

CRITICAL: All marketing content must prominently feature PlayKout pickleball brand, facilities, programs, tournaments, or community within the appropriate industry vertical context.

Keep responses concise, actionable, and focused on helping users succeed with their PlayKout pickleball marketing automation. When discussing content creation, always emphasize PlayKout pickleball theme for the user's industry vertical.

IMPORTANT: Write in plain text without markdown formatting (no bold, italics, or special characters).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Error in ai-chat:", error);
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
