import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use screenshotone.com API for high-quality screenshots
    const apiKey = Deno.env.get("SCREENSHOTONE_API_KEY");
    
    if (!apiKey) {
      throw new Error("SCREENSHOTONE_API_KEY is not configured");
    }

    const screenshotApiUrl = new URL("https://api.screenshotone.com/take");
    screenshotApiUrl.searchParams.set("access_key", apiKey);
    screenshotApiUrl.searchParams.set("url", url);
    screenshotApiUrl.searchParams.set("format", "jpg");
    screenshotApiUrl.searchParams.set("viewport_width", "1920");
    screenshotApiUrl.searchParams.set("viewport_height", "1080");
    screenshotApiUrl.searchParams.set("device_scale_factor", "1");
    screenshotApiUrl.searchParams.set("image_quality", "80");
    screenshotApiUrl.searchParams.set("block_ads", "true");
    screenshotApiUrl.searchParams.set("block_cookie_banners", "true");
    screenshotApiUrl.searchParams.set("cache", "true");

    console.log("Capturing screenshot for:", url);
    console.log("API URL:", screenshotApiUrl.toString().replace(apiKey, "***"));

    const response = await fetch(screenshotApiUrl.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("ScreenshotOne API error response:", errorText);
      throw new Error(`Screenshot API error: ${response.status} - ${errorText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    console.log("Screenshot captured successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        screenshot: dataUrl 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );

  } catch (error) {
    console.error("Screenshot error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );
  }
});
