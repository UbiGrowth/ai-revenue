import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BrandRequest {
  websiteUrl: string;
  logoImageBase64?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { websiteUrl, logoImageBase64 }: BrandRequest = await req.json();
    
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!FIRECRAWL_API_KEY) {
      throw new Error("FIRECRAWL_API_KEY is not configured");
    }
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Scraping website with Firecrawl:", websiteUrl);

    // Use Firecrawl REST API directly instead of SDK
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: websiteUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 30000,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error("Firecrawl API error:", scrapeResponse.status, errorText);
      throw new Error(`Firecrawl scrape failed: ${scrapeResponse.status}`);
    }

    const scrapeResult = await scrapeResponse.json();
    console.log("Firecrawl scrape successful");

    const markdownContent = scrapeResult.data?.markdown || "";
    const metadata = scrapeResult.data?.metadata || {};

    // Start with default brand data
    let parsedBrandData: any = {
      brandName: metadata.title || "Unknown",
      primaryColor: "#000000",
      secondaryColor: "#666666",
      accentColor: "#0066cc",
      backgroundColor: "#ffffff",
      textColor: "#000000",
      primaryFont: "Inter",
      secondaryFont: "Inter",
      brandVoice: "",
      keyMessaging: [],
      industry: "",
      logo: "",
      favicon: "",
      colorScheme: "light",
    };

    // Use AI to analyze brand from website content
    console.log("Analyzing brand with AI...");

    const analysisPrompt = `Analyze this website content and extract comprehensive brand guidelines:

Website: ${metadata.title || "Unknown"}
URL: ${websiteUrl}
Content: ${markdownContent.substring(0, 8000)}

Extract and return ONLY a valid JSON object with this exact structure:
{
  "brandName": "Company name",
  "primaryColor": "#hexcode for main brand color",
  "secondaryColor": "#hexcode for secondary color",
  "accentColor": "#hexcode for accent/CTA color",
  "backgroundColor": "#hexcode for background",
  "textColor": "#hexcode for main text",
  "primaryFont": "Main font family name",
  "secondaryFont": "Secondary font family name",
  "brandVoice": "Brief description of brand voice and tone (2-3 sentences)",
  "keyMessaging": ["Message point 1", "Message point 2", "Message point 3", "Message point 4"],
  "industry": "Industry vertical",
  "colorScheme": "light or dark"
}

Guidelines:
- Extract actual colors used on the website if mentioned
- Identify fonts from any typography references
- Describe brand voice based on content tone, language style, and messaging approach
- Extract 3-4 key value propositions or messaging points
- Identify the primary industry vertical
- Make educated guesses based on content if specific values aren't found

Return ONLY valid JSON, no markdown, no explanation.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: analysisPrompt
          }
        ],
      }),
    });

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      let analysisData = aiData.choices[0].message.content;
      analysisData = analysisData.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      try {
        const analysis = JSON.parse(analysisData);
        parsedBrandData = { ...parsedBrandData, ...analysis };
        console.log("AI brand analysis successful");
      } catch (e) {
        console.error("Failed to parse AI analysis:", e);
      }
    } else {
      console.error("AI analysis failed:", aiResponse.status);
    }

    // Analyze logo if provided
    let logoColors = null;
    if (logoImageBase64) {
      console.log("Analyzing logo colors...");
      
      const logoAnalysisPrompt = `Analyze this logo image and extract the main colors used. Return ONLY a valid JSON object with this structure:
{
  "dominantColor": "#hexcode",
  "accentColors": ["#hexcode1", "#hexcode2", "#hexcode3"]
}

Return ONLY valid JSON, no markdown, no explanation.`;

      const logoResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: logoAnalysisPrompt },
                { type: "image_url", image_url: { url: logoImageBase64 } }
              ]
            }
          ],
        }),
      });

      if (logoResponse.ok) {
        const logoData = await logoResponse.json();
        let logoColorsRaw = logoData.choices[0].message.content;
        logoColorsRaw = logoColorsRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        try {
          logoColors = JSON.parse(logoColorsRaw);
          // Override colors with logo colors if available
          if (logoColors.dominantColor) {
            parsedBrandData.primaryColor = logoColors.dominantColor;
          }
          if (logoColors.accentColors && logoColors.accentColors.length > 0) {
            parsedBrandData.secondaryColor = logoColors.accentColors[0];
            if (logoColors.accentColors.length > 1) {
              parsedBrandData.accentColor = logoColors.accentColors[1];
            }
          }
          console.log("Logo color analysis successful");
        } catch (e) {
          console.error("Failed to parse logo colors:", e);
        }
      }
    }

    console.log("Brand extraction successful");

    return new Response(
      JSON.stringify({
        success: true,
        brandGuidelines: parsedBrandData,
        logoColors: logoColors,
        websiteTitle: metadata.title || "Unknown",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in extract-brand-guidelines:", error);
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
