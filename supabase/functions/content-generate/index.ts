import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContentRequest {
  vertical: string;
  contentType: 'email' | 'social' | 'landing_page' | 'video';
  assetGoal?: string;
  tone?: string;
  businessProfile?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vertical, contentType, assetGoal, tone = 'professional', businessProfile }: ContentRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // PICKLEBALL DEFINITION - THIS IS NOT TENNIS:
    // - PADDLES: Solid rectangular paddles (like ping-pong), NOT stringed tennis rackets
    // - BALL: Perforated plastic wiffle ball, NOT fuzzy yellow tennis ball
    // - COURT: Smaller court (20x44 ft) with kitchen zone, NOT tennis court
    
    // Vertical-specific context - ALL content must incorporate PlayKout pickleball theme
    // CRITICAL: Pickleball uses SOLID PADDLES and PERFORATED WIFFLE BALLS - NOT tennis equipment
    const verticalContext = {
      'Hotels & Resorts': 'luxury hospitality with PlayKout PICKLEBALL amenities (solid paddles, wiffle balls, smaller courts), guest experience centered around pickleball tournaments, on-site pickleball courts with kitchen zones, pickleball vacation packages',
      'Multifamily Real Estate': 'apartment living featuring PlayKout PICKLEBALL courts (smaller than tennis, with kitchen zones), resident engagement through pickleball events using solid paddles and perforated balls, PlayKout-branded recreational facilities',
      'Pickleball Clubs & Country Clubs': 'PlayKout PICKLEBALL facilities with championship courts (20x44 ft with kitchen zones), solid paddle equipment, wiffle ball tournaments, professional coaching, PlayKout tournament hosting',
      'Entertainment Venues': 'PlayKout PICKLEBALL entertainment events featuring solid paddle gameplay, wiffle ball tournament spectating, pickleball-themed shows, PlayKout brand events',
      'Physical Therapy': 'PlayKout PICKLEBALL injury rehabilitation, sports therapy for pickleball players using solid paddles, recovery programs for pickleball athletes, pickleball-specific physical therapy',
      'Corporate Offices & Co-Working Spaces': 'workspace solutions with PlayKout PICKLEBALL courts (smaller courts with solid paddles and wiffle balls), team building through pickleball, corporate pickleball leagues',
      'Education': 'PlayKout PICKLEBALL programs teaching proper solid paddle technique and wiffle ball gameplay, student pickleball leagues, educational pickleball clinics',
      'Gyms': 'fitness training for PICKLEBALL performance (solid paddle swings, court movement), PlayKout pickleball conditioning programs, pickleball-specific workout plans'
    };

    const context = verticalContext[vertical as keyof typeof verticalContext] || 'PlayKout pickleball-themed general marketing';

    // Build business context from profile if available
    let businessContext = '';
    if (businessProfile) {
      const parts = [];
      
      // Business details
      if (businessProfile.business_name) parts.push(`Business Name: ${businessProfile.business_name}`);
      if (businessProfile.business_description) parts.push(`Business Description: ${businessProfile.business_description}`);
      if (businessProfile.industry) parts.push(`Industry: ${businessProfile.industry}`);
      
      // Unique selling points and competitive advantages
      if (businessProfile.unique_selling_points?.length > 0) {
        parts.push(`Unique Selling Points: ${businessProfile.unique_selling_points.join(', ')}`);
      }
      if (businessProfile.competitive_advantages) parts.push(`Competitive Advantages: ${businessProfile.competitive_advantages}`);
      
      // Brand voice and tone guidelines
      if (businessProfile.brand_voice) parts.push(`Brand Voice: ${businessProfile.brand_voice}`);
      if (businessProfile.brand_tone) parts.push(`Brand Tone: ${businessProfile.brand_tone}`);
      
      // Content preferences
      if (businessProfile.messaging_pillars?.length > 0) {
        parts.push(`Key Messaging Pillars: ${businessProfile.messaging_pillars.join(', ')}`);
      }
      if (businessProfile.cta_patterns?.length > 0) {
        parts.push(`Preferred CTAs: ${businessProfile.cta_patterns.join(', ')}`);
      }
      if (businessProfile.imagery_style) parts.push(`Imagery Style: ${businessProfile.imagery_style}`);
      if (businessProfile.content_length) parts.push(`Preferred Content Length: ${businessProfile.content_length}`);
      
      // Target audiences
      if (businessProfile.target_audiences && Object.keys(businessProfile.target_audiences).length > 0) {
        const audiences = typeof businessProfile.target_audiences === 'object' 
          ? JSON.stringify(businessProfile.target_audiences) 
          : businessProfile.target_audiences;
        parts.push(`Target Audiences: ${audiences}`);
      }
      
      if (parts.length > 0) {
        businessContext = '\n\nBUSINESS CONTEXT (Use these details to personalize content):\n' + parts.join('\n');
      }
    }

    // Add campaign performance context if available
    let performanceContext = '';
    if (businessProfile?.campaign_insights) {
      const insights = businessProfile.campaign_insights;
      const perfParts = [];
      if (insights.top_performing_subject_lines?.length > 0) {
        perfParts.push(`Top Performing Subject Lines: ${insights.top_performing_subject_lines.join('; ')}`);
      }
      if (insights.best_performing_ctas?.length > 0) {
        perfParts.push(`Best CTAs: ${insights.best_performing_ctas.join(', ')}`);
      }
      if (insights.optimal_content_length) {
        perfParts.push(`Optimal Content Length: ${insights.optimal_content_length}`);
      }
      if (insights.top_engagement_topics?.length > 0) {
        perfParts.push(`High Engagement Topics: ${insights.top_engagement_topics.join(', ')}`);
      }
      if (perfParts.length > 0) {
        performanceContext = '\n\nPREVIOUS CAMPAIGN INSIGHTS (Optimize based on what worked):\n' + perfParts.join('\n');
      }
    }

    businessContext += performanceContext;

    // Use business profile tone if available
    const effectiveTone = businessProfile?.content_tone || tone;

    // Build AI prompt based on content type
    let systemPrompt = '';
    let userPrompt = '';
    let titlePrompt = '';

    if (contentType === 'email') {
      systemPrompt = `You are an expert email marketing copywriter specializing in the ${vertical} industry with PlayKout pickleball branding. 
Create compelling, conversion-focused email content with a ${effectiveTone} tone that emphasizes PlayKout pickleball theme and offerings.
Focus on: ${context}.${businessContext}
CRITICAL: All content must relate to PlayKout pickleball facilities, programs, or experiences within the ${vertical} context.
Always include a clear call-to-action.
IMPORTANT: Write in plain text without any markdown formatting, bold, italics, or special characters.
Format: Subject: [subject line]\n\n[email body]`;
      
      userPrompt = assetGoal 
        ? `Create an email campaign for PlayKout pickleball services in ${vertical} with this goal: ${assetGoal}. Emphasize PlayKout pickleball brand, facilities, and experiences.` 
        : `Create a promotional email campaign for PlayKout pickleball offerings in ${vertical}. Highlight PlayKout pickleball courts, programs, tournaments, and community.`;
      
      titlePrompt = assetGoal ? `PlayKout Pickleball ${vertical} Email - ${assetGoal}` : `PlayKout Pickleball ${vertical} Email Campaign`;
    } else if (contentType === 'social') {
      systemPrompt = `You are an expert social media content creator for the ${vertical} industry with PlayKout pickleball branding.
Create engaging, shareable social media posts with a ${effectiveTone} tone that showcase PlayKout pickleball offerings.
Focus on: ${context}.${businessContext}
CRITICAL: All content must prominently feature PlayKout pickleball theme and relate to pickleball within the ${vertical} context.
Keep posts concise and impactful for Instagram and LinkedIn.
IMPORTANT: Write in plain text without any markdown formatting, bold, italics, or special characters.`;
      
      userPrompt = assetGoal 
        ? `Create a social media post for PlayKout pickleball services in ${vertical} with this goal: ${assetGoal}. Feature PlayKout pickleball brand prominently.` 
        : `Create an engaging social media post for PlayKout pickleball offerings in ${vertical}. Showcase PlayKout pickleball facilities and community.`;
      
      titlePrompt = assetGoal ? `PlayKout Pickleball ${vertical} Social - ${assetGoal}` : `PlayKout Pickleball ${vertical} Social Post`;
    } else if (contentType === 'video') {
      systemPrompt = `You are an expert video marketing scriptwriter specializing in the ${vertical} industry with PlayKout pickleball branding.
Create compelling video scripts with a ${effectiveTone} tone that engage viewers and drive action while showcasing PlayKout pickleball facilities and experiences.
Focus on: ${context}.${businessContext}
CRITICAL: All video content must prominently feature PlayKout pickleball brand, courts, programs, or events within the ${vertical} context.
Include: opening hook mentioning PlayKout pickleball, main message focused on pickleball benefits, key benefits of PlayKout facilities, and strong call-to-action.
Format the script with clear sections and natural dialogue.
IMPORTANT: Write in plain text without any markdown formatting, bold, italics, or special characters.`;
      
      userPrompt = assetGoal 
        ? `Create a video script for PlayKout pickleball services in ${vertical} with this goal: ${assetGoal}. The video must showcase PlayKout pickleball courts, coaches, tournaments, or facilities.` 
        : `Create a promotional video script for PlayKout pickleball offerings in ${vertical}. Feature PlayKout brand signage and pickleball action prominently.`;
      
      titlePrompt = assetGoal ? `PlayKout Pickleball ${vertical} Video - ${assetGoal}` : `PlayKout Pickleball ${vertical} Marketing Video`;
    } else {
      systemPrompt = `You are an expert landing page copywriter for the ${vertical} industry with PlayKout pickleball branding.
Create persuasive landing page content with a ${effectiveTone} tone that highlights PlayKout pickleball offerings and experiences.
Focus on: ${context}.${businessContext}
CRITICAL: All landing page content must center on PlayKout pickleball facilities, programs, tournaments, or experiences within the ${vertical} context.
Include headline mentioning PlayKout pickleball, subheadline emphasizing pickleball benefits, benefits of PlayKout facilities, and strong call-to-action.
IMPORTANT: Write in plain text without any markdown formatting, bold, italics, or special characters.`;
      
      userPrompt = assetGoal 
        ? `Create landing page content for PlayKout pickleball services in ${vertical} with this goal: ${assetGoal}. Emphasize PlayKout pickleball brand and facilities throughout.` 
        : `Create a landing page for PlayKout pickleball offerings in ${vertical}. Highlight PlayKout courts, programs, and community benefits.`;
      
      titlePrompt = assetGoal ? `PlayKout Pickleball ${vertical} Landing Page - ${assetGoal}` : `PlayKout Pickleball ${vertical} Landing Page`;
    }

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
    const generatedContent = aiData.choices[0].message.content;

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

    // Extract subject line for emails
    let subject = '';
    let content = cleanContent(generatedContent);
    
    if (contentType === 'email') {
      const subjectMatch = generatedContent.match(/Subject:?\s*(.+?)(?:\n|$)/i);
      if (subjectMatch) {
        subject = cleanContent(subjectMatch[1].trim());
        content = cleanContent(generatedContent.replace(subjectMatch[0], '').trim());
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        title: titlePrompt,
        content,
        subject,
        vertical,
        contentType,
        tone
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in content-generate:", error);
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