import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenantId || body.tenant_id;
    const analysisType = body.type || "all"; // "gmail", "calendar", "drive", "all"
    const batchSize = body.batchSize || 10;

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has access to this workspace
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", tenantId)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: "Access denied to this workspace" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results: Record<string, unknown> = {};

    if (analysisType === "gmail" || analysisType === "all") {
      results.gmail = await analyzeGmail(
        supabaseAdmin,
        tenantId,
        batchSize,
        anthropicApiKey
      );
    }

    if (analysisType === "calendar" || analysisType === "all") {
      results.calendar = await analyzeCalendar(
        supabaseAdmin,
        tenantId,
        batchSize,
        anthropicApiKey
      );
    }

    if (analysisType === "drive" || analysisType === "all") {
      results.drive = await analyzeDrive(
        supabaseAdmin,
        tenantId,
        batchSize,
        anthropicApiKey
      );
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in ai-analyze-workspace:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errBody}`);
  }

  const data = await response.json();
  const content = data.content?.[0];
  return content?.text || "";
}

async function analyzeGmail(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  batchSize: number,
  apiKey: string
): Promise<{ analyzed: number; failed: number }> {
  // Fetch unanalyzed messages
  const { data: messages, error } = await supabase
    .from("gmail_messages")
    .select("id, subject, from_email, from_name, snippet, body_text, labels")
    .eq("tenant_id", tenantId)
    .is("analyzed_at", null)
    .order("received_at", { ascending: false })
    .limit(batchSize);

  if (error || !messages || messages.length === 0) {
    return { analyzed: 0, failed: 0 };
  }

  let analyzed = 0;
  let failed = 0;

  const systemPrompt = `You are an AI analyst for a business revenue platform. Analyze emails and return JSON with:
- category: one of "lead", "customer", "partner", "support", "billing", "marketing", "internal", "spam", "other"
- sentiment: one of "positive", "negative", "neutral", "urgent"
- priority_score: 1-100 (100 = highest priority for revenue generation)
- insights: object with keys: revenue_signal (bool), action_required (bool), key_topics (string[]), summary (string, 1-2 sentences)
Return ONLY valid JSON, no markdown.`;

  for (const msg of messages) {
    try {
      const bodyPreview = (msg.body_text || msg.snippet || "").substring(
        0,
        2000
      );
      const userPrompt = `Analyze this email:
From: ${msg.from_name || ""} <${msg.from_email || ""}>
Subject: ${msg.subject || "(no subject)"}
Labels: ${(msg.labels || []).join(", ")}
Body: ${bodyPreview}`;

      const result = await callClaude(apiKey, systemPrompt, userPrompt);
      const parsed = JSON.parse(result);

      await supabase
        .from("gmail_messages")
        .update({
          analyzed_at: new Date().toISOString(),
          ai_insights: parsed.insights || parsed,
          ai_category: parsed.category || "other",
          ai_sentiment: parsed.sentiment || "neutral",
          ai_priority_score: parsed.priority_score || 50,
          updated_at: new Date().toISOString(),
        })
        .eq("id", msg.id);

      analyzed++;
    } catch (err) {
      console.error("Failed to analyze email:", msg.id, err);
      failed++;
    }
  }

  return { analyzed, failed };
}

async function analyzeCalendar(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  batchSize: number,
  apiKey: string
): Promise<{ analyzed: number; failed: number }> {
  const { data: events, error } = await supabase
    .from("google_calendar_events")
    .select(
      "id, summary, description, location, start_time, end_time, organizer_email, organizer_name, attendees, ai_attendee_count, ai_external_attendees, meeting_link"
    )
    .eq("tenant_id", tenantId)
    .is("analyzed_at", null)
    .order("start_time", { ascending: false })
    .limit(batchSize);

  if (error || !events || events.length === 0) {
    return { analyzed: 0, failed: 0 };
  }

  let analyzed = 0;
  let failed = 0;

  const systemPrompt = `You are an AI analyst for a business revenue platform. Analyze calendar events and return JSON with:
- category: one of "sales_meeting", "client_call", "internal_meeting", "demo", "onboarding", "review", "planning", "social", "other"
- insights: object with keys: revenue_potential (string: "high", "medium", "low", "none"), is_client_facing (bool), preparation_notes (string, 1-2 sentences), key_topics (string[]), summary (string, 1-2 sentences)
Return ONLY valid JSON, no markdown.`;

  for (const event of events) {
    try {
      const attendeesSummary = (event.attendees || [])
        .slice(0, 10)
        .map(
          (a: Record<string, string>) =>
            `${a.displayName || a.email} (${a.responseStatus})`
        )
        .join(", ");

      const userPrompt = `Analyze this calendar event:
Title: ${event.summary}
When: ${event.start_time} to ${event.end_time}
Organizer: ${event.organizer_name || ""} <${event.organizer_email || ""}>
Location: ${event.location || "N/A"}
Meeting Link: ${event.meeting_link || "N/A"}
Attendees (${event.ai_attendee_count} total, ${event.ai_external_attendees} external): ${attendeesSummary}
Description: ${(event.description || "").substring(0, 1000)}`;

      const result = await callClaude(apiKey, systemPrompt, userPrompt);
      const parsed = JSON.parse(result);

      await supabase
        .from("google_calendar_events")
        .update({
          analyzed_at: new Date().toISOString(),
          ai_insights: parsed.insights || parsed,
          ai_category: parsed.category || "other",
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      analyzed++;
    } catch (err) {
      console.error("Failed to analyze event:", event.id, err);
      failed++;
    }
  }

  return { analyzed, failed };
}

async function analyzeDrive(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  batchSize: number,
  apiKey: string
): Promise<{ analyzed: number; failed: number }> {
  const { data: documents, error } = await supabase
    .from("google_drive_documents")
    .select(
      "id, name, mime_type, document_type, content_preview, full_text_extracted, owner_email, owner_name, shared_with, is_shared, modified_time"
    )
    .eq("tenant_id", tenantId)
    .is("analyzed_at", null)
    .order("modified_time", { ascending: false })
    .limit(batchSize);

  if (error || !documents || documents.length === 0) {
    return { analyzed: 0, failed: 0 };
  }

  let analyzed = 0;
  let failed = 0;

  const systemPrompt = `You are an AI analyst for a business revenue platform. Analyze documents and return JSON with:
- category: one of "proposal", "contract", "invoice", "report", "presentation", "spreadsheet", "template", "meeting_notes", "strategy", "other"
- key_topics: string[] (3-5 main topics)
- summary: string (2-3 sentences describing the document's purpose and content)
- insights: object with keys: revenue_relevance (string: "high", "medium", "low", "none"), action_items (string[]), stakeholders (string[]), document_status (string: "draft", "review", "final", "archived", "unknown")
Return ONLY valid JSON, no markdown.`;

  for (const doc of documents) {
    try {
      const textPreview = (
        doc.full_text_extracted ||
        doc.content_preview ||
        ""
      ).substring(0, 3000);

      const sharedWithSummary = (doc.shared_with || [])
        .slice(0, 5)
        .map(
          (s: Record<string, string>) =>
            `${s.displayName || s.email} (${s.role})`
        )
        .join(", ");

      const userPrompt = `Analyze this document:
Name: ${doc.name}
Type: ${doc.document_type} (${doc.mime_type})
Owner: ${doc.owner_name || ""} <${doc.owner_email || ""}>
Shared: ${doc.is_shared ? "Yes" : "No"}${sharedWithSummary ? ` with ${sharedWithSummary}` : ""}
Last Modified: ${doc.modified_time || "Unknown"}
Content Preview: ${textPreview || "(no text extracted)"}`;

      const result = await callClaude(apiKey, systemPrompt, userPrompt);
      const parsed = JSON.parse(result);

      await supabase
        .from("google_drive_documents")
        .update({
          analyzed_at: new Date().toISOString(),
          ai_insights: parsed.insights || parsed,
          ai_category: parsed.category || "other",
          ai_key_topics: parsed.key_topics || [],
          ai_summary: parsed.summary || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", doc.id);

      analyzed++;
    } catch (err) {
      console.error("Failed to analyze document:", doc.id, err);
      failed++;
    }
  }

  return { analyzed, failed };
}
