import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssistRequest {
  context: string;
  userPrompt: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { context, userPrompt }: AssistRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Context-specific system prompts - ALL must emphasize PlayKout pickleball theme
    const contextPrompts: Record<string, string> = {
      'campaign-goal': 'You are an expert marketing strategist for PlayKout pickleball facilities. Help users define clear, actionable campaign goals that promote PlayKout pickleball services, courts, tournaments, or programs. Be specific and results-oriented. All goals must relate to PlayKout pickleball offerings. Keep responses under 50 words. Write in plain text without markdown formatting.',
      'subject-line': 'You are an expert email copywriter for PlayKout pickleball marketing. Create compelling subject lines that drive opens and emphasize PlayKout pickleball value. Use proven techniques like urgency, curiosity, and personalization. All subject lines must mention PlayKout or pickleball. Provide 3 options. Write in plain text without markdown formatting.',
      'social-caption': 'You are a social media expert for PlayKout pickleball brand. Write engaging captions optimized for social platforms that showcase PlayKout pickleball facilities, tournaments, or community. Include relevant pickleball hashtags and PlayKout branding. Keep it conversational. Write in plain text without markdown formatting.',
      'video-script': 'You are a video marketing expert for PlayKout pickleball brand. Create engaging video scripts that feature PlayKout pickleball courts, coaching, tournaments, or community with a strong hook, clear message about PlayKout offerings, and compelling call-to-action. Structure with sections. Write in plain text without markdown formatting.',
      'content-optimization': 'You are a content optimization expert for PlayKout pickleball marketing. Analyze the content and suggest improvements for clarity, engagement, and conversion while ensuring PlayKout pickleball theme is prominent throughout. Be specific and actionable. Write in plain text without markdown formatting.',
      'audience-targeting': 'You are an audience targeting expert for PlayKout pickleball services. Suggest specific audience segments interested in pickleball and targeting criteria based on the campaign goal and industry vertical for PlayKout facilities. Write in plain text without markdown formatting.',
    };

    const systemPrompt = contextPrompts[context] || 'You are a helpful AI marketing assistant for PlayKout pickleball brand. Provide clear, actionable suggestions that emphasize PlayKout pickleball facilities, programs, and services. Write in plain text without markdown formatting.';

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
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
    const generatedSuggestion = aiData.choices[0].message.content;

    // Function to clean up markdown and special characters
    const cleanContent = (text: string): string => {
      return text
        // Remove markdown bold
        .replace(/\*\*/g, '')
        // Remove markdown italic
        .replace(/\*/g, '')
        .replace(/_/g, '')
        // Remove markdown headers
        .replace(/^#+\s+/gm, '')
        // Remove markdown links but keep the text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove other special markdown characters but preserve basic punctuation
        .replace(/[`~]/g, '')
        // Clean up multiple spaces
        .replace(/  +/g, ' ')
        // Clean up multiple newlines (keep max 2)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    const suggestion = cleanContent(generatedSuggestion);

    return new Response(
      JSON.stringify({
        success: true,
        suggestion,
        context
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in ai-assist:", error);
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
