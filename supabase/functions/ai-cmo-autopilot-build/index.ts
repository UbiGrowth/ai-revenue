import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { openaiChat } from "../_shared/providers/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-ai-revenue-build",
  "x-ai-revenue-build": "ai-cmo-autopilot-build-v2",
};

const VALID_CHANNELS = ["email", "sms", "linkedin", "voice", "landing_page"];
const VALID_GOALS = ["leads", "meetings", "revenue", "engagement"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: authError?.message || "No user found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      icp,
      offer,
      channels,
      desiredResult,
      target_tags,
      target_segments,
      targetTags,
      targetSegments,
      workspaceId: requestedWorkspaceId,
    } = await req.json();

    if (!icp || typeof icp !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid icp" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!offer || typeof offer !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid offer" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!Array.isArray(channels) || channels.length === 0) {
      return new Response(JSON.stringify({ error: "channels must be a non-empty array" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const invalidChannels = channels.filter(c => !VALID_CHANNELS.includes(c));
    if (invalidChannels.length > 0) {
      return new Response(JSON.stringify({ error: `Invalid channels: ${invalidChannels.join(", ")}. Valid: ${VALID_CHANNELS.join(", ")}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!desiredResult || !VALID_GOALS.includes(desiredResult)) {
      return new Response(JSON.stringify({ error: `Invalid desiredResult. Must be one of: ${VALID_GOALS.join(", ")}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const requiresEmail = channels.includes("email");
    const requiresVoice = channels.includes("voice");

    // Resolve workspace from header > body > membership > owned
    const headerWorkspaceId = req.headers.get("x-workspace-id") || undefined;
    let workspaceId = (requestedWorkspaceId as string | undefined) || headerWorkspaceId;

    if (!workspaceId) {
      const { data: membershipWorkspace } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .maybeSingle();
      workspaceId = membershipWorkspace?.workspace_id;
    }

    if (!workspaceId) {
      const { data: ownedWorkspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      workspaceId = ownedWorkspace?.id;
    }

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "No workspace provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, owner_id, tenant_id")
      .eq("id", workspaceId)
      .maybeSingle();

    if (workspaceError || !workspace) {
      return new Response(JSON.stringify({ error: "Workspace lookup failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let hasAccess = workspace.owner_id === user.id;
    if (!hasAccess) {
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .maybeSingle();
      hasAccess = !!membership;
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden: workspace access denied" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tenantId = workspace.tenant_id || user.id;

    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // FIX: include tenant_id (NOT NULL column) alongside workspace_id
    const campaignData: Record<string, unknown> = {
      workspace_id: workspaceId,
      tenant_id: tenantId,
      campaign_name: `Autopilot Campaign - ${desiredResult}`,
      campaign_type: "autopilot",
      description: `AI-generated campaign targeting ${desiredResult}`,
      target_icp: icp,
      target_offer: offer,
      goal: desiredResult,
      autopilot_enabled: true,
      status: "draft",
    };

    const normalizedTags = Array.isArray(target_tags) ? target_tags : Array.isArray(targetTags) ? targetTags : [];
    const normalizedSegments = Array.isArray(target_segments) ? target_segments : Array.isArray(targetSegments) ? targetSegments : [];
    if (normalizedTags.length > 0) campaignData.target_tags = normalizedTags;
    if (normalizedSegments.length > 0) campaignData.target_segment_codes = normalizedSegments;

    const { data: campaign, error: campaignError } = await admin
      .from("cmo_campaigns")
      .insert(campaignData)
      .select()
      .single();

    if (campaignError) {
      console.error("Error creating campaign:", campaignError);
      return new Response(
        JSON.stringify({
          error: "Failed to create campaign",
          details: campaignError.message || "Unknown database error",
          hint: (campaignError as any).hint,
          code: (campaignError as any).code,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Created draft campaign ${campaign.id} for tenant ${tenantId}`);

    const system = "You are a marketing campaign generator. Return only valid JSON, no markdown.";
    const userPrompt = `Generate assets for a marketing campaign.\n\nRequirements:\n- Return JSON with keys: campaign_name (string), campaign_description (string), assets (object), automations (object), summary (string)\n- assets may include: emails (array), voice_scripts (array)\n- If email is requested, generate 3 emails with fields: step (number), subject (string), body (string), delay_days (number)\n- If voice is requested, generate 1 voice_scripts item with fields: scenario, opening, pitch, objection_handling, close\n- Use plain text, no markdown.\n\nInput:\nicp: ${icp}\noffer: ${offer}\ndesired_result: ${desiredResult}\nchannels: ${channels.join(", ")}\n`;

    let aiText: string;
    try {
      const { text } = await openaiChat({ apiKey: OPENAI_API_KEY, model: "gpt-4o-mini", messages: [{ role: "system", content: system }, { role: "user", content: userPrompt }], temperature: 0.4, maxTokens: 1200 });
      aiText = text;
    } catch (aiErr: any) {
      return new Response(JSON.stringify({ error: "AI generation failed", details: aiErr?.message || "Unknown AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!aiText) {
      return new Response(JSON.stringify({ error: "AI generation failed", details: "Empty model response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let result: any;
    try { result = JSON.parse(aiText); } catch {
      return new Response(JSON.stringify({ error: "AI generation failed", details: "Model returned non-JSON output" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (result?.campaign_name) {
      await admin.from("cmo_campaigns").update({ campaign_name: result.campaign_name, description: result.campaign_description || campaign.description }).eq("id", campaign.id);
    }

    const { error: channelsError } = await admin.from("cmo_campaign_channels").insert(channels.map((channel: string) => ({ campaign_id: campaign.id, channel_name: channel, channel_type: channel })));
    if (channelsError) {
      return new Response(JSON.stringify({ error: "Failed to create campaign channels", details: channelsError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const assets = result.assets || {};
    const assetInserts: any[] = [];
    const legacyAssetInserts: Array<Record<string, unknown>> = [];

    if (requiresEmail && Array.isArray(assets.emails)) {
      for (const email of assets.emails) {
        const subject = typeof email.subject === "string" ? email.subject : "Email";
        const body = typeof email.body === "string" ? email.body : "";
        assetInserts.push({ workspace_id: workspaceId, tenant_id: tenantId, campaign_id: campaign.id, title: subject, content_type: "email", channel: "email", key_message: body, status: "draft" });
        legacyAssetInserts.push({ workspace_id: workspaceId, type: "email", status: "review", name: `${result?.campaign_name || campaign.campaign_name} - Email ${email.step ?? ""}`.trim(), description: result?.campaign_description || campaign.description, channel: "email", goal: desiredResult, content: { subject, body, step: email.step ?? null, delay_days: email.delay_days ?? null, campaign_id: campaign.id, campaign_name: result?.campaign_name || campaign.campaign_name }, created_by: user.id });
      }
    }

    if (assets.sms) {
      for (const sms of assets.sms) {
        assetInserts.push({ workspace_id: workspaceId, tenant_id: tenantId, campaign_id: campaign.id, title: `SMS Step ${sms.step}`, content_type: "sms", channel: "sms", key_message: sms.message, status: "draft" });
      }
    }

    if (requiresVoice && Array.isArray(assets.voice_scripts)) {
      for (const script of assets.voice_scripts) {
        const scenario = typeof script.scenario === "string" ? script.scenario : "Voice";
        const pitch = typeof script.pitch === "string" ? script.pitch : "";
        const opening = typeof script.opening === "string" ? script.opening : "";
        const objection = typeof script.objection_handling === "string" ? script.objection_handling : "";
        const close = typeof script.close === "string" ? script.close : "";
        assetInserts.push({ workspace_id: workspaceId, tenant_id: tenantId, campaign_id: campaign.id, title: `Voice Script - ${scenario}`, content_type: "voice_script", channel: "voice", key_message: pitch, supporting_points: [opening, objection, close], status: "draft" });
        legacyAssetInserts.push({ workspace_id: workspaceId, type: "voice", status: "review", name: `${result?.campaign_name || campaign.campaign_name} - Voice Script`.trim(), description: result?.campaign_description || campaign.description, channel: "voice", goal: desiredResult, content: { scenario, opening, pitch, objection_handling: objection, close, campaign_id: campaign.id, campaign_name: result?.campaign_name || campaign.campaign_name }, created_by: user.id });
      }
    }

    if (assets.posts) {
      for (const post of assets.posts) {
        assetInserts.push({ workspace_id: workspaceId, tenant_id: tenantId, campaign_id: campaign.id, title: post.hook || `${post.channel} Post`, content_type: "social_post", channel: post.channel, key_message: post.content, cta: post.cta, status: "draft" });
      }
    }

    if (assets.landing_pages) {
      for (const page of assets.landing_pages) {
        assetInserts.push({ workspace_id: workspaceId, tenant_id: tenantId, campaign_id: campaign.id, title: page.title || page.headline, content_type: "landing_page", channel: "landing_page", key_message: page.subheadline, supporting_points: page.sections || [], status: "draft" });
      }
    }

    if (assetInserts.length > 0) {
      const { error: assetsError } = await admin.from("cmo_content_assets").insert(assetInserts);
      if (assetsError) return new Response(JSON.stringify({ error: "Failed to store campaign assets", details: assetsError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (legacyAssetInserts.length > 0) {
      const { error: legacyAssetsError } = await admin.from("assets").insert(legacyAssetInserts);
      if (legacyAssetsError) return new Response(JSON.stringify({ error: "Failed to store approval assets", details: legacyAssetsError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const automationSteps = Array.isArray((result.automations || {}).steps) ? result.automations.steps : [];
    if (automationSteps.length > 0) {
      const stepInserts = automationSteps.map((step: any, index: number) => ({
        workspace_id: workspaceId,
        tenant_id: tenantId,
        automation_id: campaign.id,
        step_order: step.step || index + 1,
        step_type: step.type,
        config: { delay_days: step.delay_days || 0, ...step.config, ...(step.type === "voice" && { agent_id: step.config?.agent_id, script_template: step.config?.script_template, retry_on_no_answer: step.config?.retry_on_no_answer || false, max_retries: step.config?.max_retries || 2, max_duration: step.config?.max_duration || 300 }) },
      }));
      const { error: stepsError } = await admin.from("automation_steps").insert(stepInserts);
      if (stepsError) return new Response(JSON.stringify({ error: "Failed to create automation steps", details: stepsError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.log(`Created ${stepInserts.length} automation steps for campaign ${campaign.id}`);
    }

    console.log(`Autopilot campaign ${campaign.id} built with ${assetInserts.length} assets`);
    return new Response(JSON.stringify({ campaignId: campaign.id, status: "created" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("ai-cmo-autopilot-build error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
