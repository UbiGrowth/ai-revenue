import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Fetch assets without preview images
    const { data: assets, error: fetchError } = await supabaseClient
      .from('assets')
      .select('id, name, type, channel, content, preview_url')
      .or('preview_url.is.null,and(type.eq.landing_page,content->>hero_image_url.is.null)')
      .in('type', ['landing_page', 'email', 'video']);

    if (fetchError) throw fetchError;
    if (!assets || assets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No assets need images', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${assets.length} assets needing images`);
    const results = [];

    for (const asset of assets) {
      try {
        // Check if this asset actually needs an image
        const needsImage = !asset.preview_url && 
          (asset.type !== 'landing_page' || !asset.content?.hero_image_url);
        
        if (!needsImage) continue;

        // Generate appropriate prompt based on asset type and content
        let prompt = '';
        const vertical = asset.channel || 'Pickleball Clubs & Country Clubs';
        
        if (asset.type === 'landing_page') {
          const headline = asset.content?.hero_headline || asset.content?.headline || asset.name;
          prompt = `Create a professional, high-quality hero image for a PlayKout pickleball ${vertical.toLowerCase()} landing page. Theme: "${headline}". Style: Modern, clean, energetic. Must prominently feature PlayKout pickleball branding, indoor pickleball courts with professional lighting, and an upscale athletic facility atmosphere. Photorealistic, 16:9 aspect ratio, ultra high resolution.`;
        } else if (asset.type === 'video') {
          const description = asset.content?.description || asset.name;
          prompt = `Create a professional thumbnail image for a PlayKout pickleball video about "${description}" for ${vertical}. Style: Vibrant, action-oriented, cinematic. Must show PlayKout pickleball courts, players in action, professional athletic facility. Include visible PlayKout branding. Photorealistic, 16:9 aspect ratio, ultra sharp focus.`;
        } else if (asset.type === 'email') {
          const subject = asset.content?.subject || asset.name;
          prompt = `Create an email header image for PlayKout pickleball marketing about "${subject}" targeting ${vertical}. Style: Professional, inviting, premium. Feature PlayKout pickleball facilities, modern indoor courts, athletic atmosphere. Include PlayKout branding naturally integrated. Photorealistic, 16:9 aspect ratio.`;
        }

        console.log(`Generating image for asset ${asset.id}: ${asset.name}`);

        // Call Lovable AI image generation
        const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            modalities: ['image', 'text']
          }),
        });

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          console.error(`Image generation failed for ${asset.id}:`, imageResponse.status, errorText);
          results.push({ id: asset.id, name: asset.name, success: false, error: `API error: ${imageResponse.status}` });
          continue;
        }

        const imageData = await imageResponse.json();
        const generatedImageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!generatedImageUrl) {
          console.error(`No image URL returned for ${asset.id}`);
          results.push({ id: asset.id, name: asset.name, success: false, error: 'No image generated' });
          continue;
        }

        // Update the asset with the generated image
        let updateData: any = {};
        if (asset.type === 'landing_page') {
          // Store in content.hero_image_url for landing pages
          updateData = {
            content: {
              ...asset.content,
              hero_image_url: generatedImageUrl
            }
          };
        } else {
          // Store in preview_url for other types
          updateData = {
            preview_url: generatedImageUrl
          };
        }

        const { error: updateError } = await supabaseClient
          .from('assets')
          .update(updateData)
          .eq('id', asset.id);

        if (updateError) {
          console.error(`Failed to update asset ${asset.id}:`, updateError);
          results.push({ id: asset.id, name: asset.name, success: false, error: updateError.message });
        } else {
          console.log(`Successfully generated image for asset ${asset.id}`);
          results.push({ id: asset.id, name: asset.name, success: true });
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (assetError) {
        console.error(`Error processing asset ${asset.id}:`, assetError);
        results.push({ 
          id: asset.id, 
          name: asset.name, 
          success: false, 
          error: assetError instanceof Error ? assetError.message : 'Unknown error' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${successCount} images, ${failCount} failed`,
        totalProcessed: results.length,
        successCount,
        failCount,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-missing-images:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
