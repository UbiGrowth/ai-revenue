import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireBasicAuth, basicAuthResponse } from "../_shared/basic-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Internal secret for internal function calls
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Allow access via: 1) Basic Auth, 2) Internal secret header, 3) Valid JWT
    const internalSecret = req.headers.get('x-internal-secret');
    const hasValidInternalSecret = internalSecret && internalSecret === INTERNAL_SECRET;
    const hasBasicAuth = requireBasicAuth(req, "UG_ADMIN_BASIC_USER", "UG_ADMIN_BASIC_PASS");
    const hasAuthHeader = req.headers.get('Authorization')?.startsWith('Bearer ');

    if (!hasValidInternalSecret && !hasBasicAuth && !hasAuthHeader) {
      console.log("[capture-screenshot] Unauthorized access attempt");
      return basicAuthResponse("UbiGrowth Screenshot", corsHeaders);
    }

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

    console.log("[capture-screenshot] Capturing:", url);

    const response = await fetch(screenshotApiUrl.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[capture-screenshot] API error:", errorText);
      throw new Error(`Screenshot API error: ${response.status} - ${errorText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    console.log("[capture-screenshot] Success");

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
    console.error("[capture-screenshot] Error:", error);
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
