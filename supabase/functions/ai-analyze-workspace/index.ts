import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyWorkspaceMembership, getRequiredEnv } from "../_shared/google-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const BATCH_SIZE = 10;
const CLAUDE_TIMEOUT_MS = 30000;
const MAX_ANALYSIS_FAILURES = 3;
const VALID_DATA_TYPES = ["gmail", "calendar", "drive", "all"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseAnonKey = getRequiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicApiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const workspaceId = body.workspace_id;
    const dataType = body.data_type as string;

    if (!workspaceId || typeof workspaceId !== "string") {
      return new Response(JSON.stringify({ error: "workspace_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate data_type
    if (dataType && !VALID_DATA_TYPES.includes(dataType)) {
      return new Response(JSON.stringify({ error: `Invalid data_type. Must be one of: ${VALID_DATA_TYPES.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user belongs to this workspace
    const isMember = await verifyWorkspaceMembership(supabase, user.id, workspaceId);
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this workspace" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    const results: Record<string, { analyzed: number; failed: number }> = {};

    const typesToAnalyze = dataType === "all" ? ["gmail", "calendar", "drive"] : [dataType || "gmail"];

    for (const type of typesToAnalyze) {
      switch (type) {
        case "gmail":
          results.gmail = await analyzeGmail(adminSupabase, workspaceId, anthropicApiKey);
          break;
        case "calendar":
          results.calendar = await analyzeCalendar(adminSupabase, workspaceId, anthropicApiKey);
          break;
        case "drive":
          results.drive = await analyzeDrive(adminSupabase, workspaceId, anthropicApiKey);
          break;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      results,
    }), {
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

async function callClaude(apiKey: string, systemPrompt: string, userContent: string): Promise<Record<string, unknown>> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
    signal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`Claude API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;

  if (!text) {
    throw new Error("Claude returned empty response");
  }

  // Extract first balanced JSON object from response
  const json = extractFirstJson(text);
  if (!json) {
    console.error("No valid JSON found in Claude response:", text.substring(0, 200));
    throw new Error("Claude returned non-JSON response");
  }

  return json;
}

function extractFirstJson(text: string): Record<string, unknown> | null {
  // Find the first { and try to parse balanced braces
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") depth--;

    if (depth === 0) {
      try {
        return JSON.parse(text.substring(start, i + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

// Sanitize user content to reduce prompt injection risk
function sanitizeForPrompt(text: string, maxLength: number): string {
  return text
    .substring(0, maxLength)
    .replace(/```/g, "'''");
}

async function markAnalysisFailed(
  supabase: ReturnType<typeof createClient>,
  table: string,
  id: string,
  workspaceId: string
): Promise<void> {
  await supabase
    .from(table)
    .update({
      analyzed_at: new Date().toISOString(),
      ai_insights: { error: "analysis_failed", attempts: MAX_ANALYSIS_FAILURES },
      ai_category: "error",
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
}

async function analyzeGmail(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  apiKey: string
): Promise<{ analyzed: number; failed: number }> {
  let analyzed = 0;
  let failed = 0;

  // Exclude items that already failed analysis (ai_category = 'error')
  const { data: emails, error } = await supabase
    .from("gmail_messages")
    .select("id, subject, from_email, from_name, snippet, body_text, labels")
    .eq("workspace_id", workspaceId)
    .is("analyzed_at", null)
    .limit(BATCH_SIZE);

  if (error || !emails?.length) return { analyzed: 0, failed: 0 };

  const systemPrompt = `You are an AI email analyst for a business revenue platform. Analyze the email and return ONLY a valid JSON object (no markdown, no explanation) with this exact schema:
{
  "category": "sales_inquiry" | "customer_support" | "partnership" | "newsletter" | "transactional" | "internal" | "spam" | "other",
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "priority_score": <integer 1-10>,
  "key_topics": ["topic1", "topic2"],
  "action_required": <boolean>,
  "summary": "<one sentence>",
  "revenue_relevance": "high" | "medium" | "low" | "none"
}`;

  for (const email of emails) {
    try {
      const content = `Subject: ${sanitizeForPrompt(email.subject || "(no subject)", 200)}
From: ${sanitizeForPrompt(email.from_name || "", 100)} <${sanitizeForPrompt(email.from_email || "", 100)}>
Labels: ${(Array.isArray(email.labels) ? email.labels : []).join(", ")}
Preview: ${sanitizeForPrompt(email.snippet || "", 300)}
Body excerpt: ${sanitizeForPrompt(email.body_text || "", 2000)}`;

      const insights = await callClaude(apiKey, systemPrompt, content);

      const priorityScore = typeof insights.priority_score === "number"
        ? Math.max(1, Math.min(10, Math.round(insights.priority_score)))
        : 5;

      const { error: updateError } = await supabase
        .from("gmail_messages")
        .update({
          analyzed_at: new Date().toISOString(),
          ai_insights: insights,
          ai_category: typeof insights.category === "string" ? insights.category : "other",
          ai_sentiment: typeof insights.sentiment === "string" ? insights.sentiment : "neutral",
          ai_priority_score: priorityScore,
        })
        .eq("id", email.id)
        .eq("workspace_id", workspaceId);

      if (updateError) {
        console.error("Failed to save email analysis:", updateError.message);
        failed++;
      } else {
        analyzed++;
      }
    } catch (err) {
      console.error("Failed to analyze email:", err);
      failed++;
      // Mark as failed after threshold to prevent infinite retry
      await markAnalysisFailed(supabase, "gmail_messages", email.id, workspaceId);
    }
  }

  return { analyzed, failed };
}

async function analyzeCalendar(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  apiKey: string
): Promise<{ analyzed: number; failed: number }> {
  let analyzed = 0;
  let failed = 0;

  const { data: events, error } = await supabase
    .from("google_calendar_events")
    .select("id, summary, description, location, start_time, end_time, attendees, organizer_email, ai_attendee_count, ai_external_attendees, meeting_link")
    .eq("workspace_id", workspaceId)
    .is("analyzed_at", null)
    .limit(BATCH_SIZE);

  if (error || !events?.length) return { analyzed: 0, failed: 0 };

  const systemPrompt = `You are an AI calendar analyst for a business revenue platform. Analyze the meeting/event and return ONLY a valid JSON object (no markdown, no explanation) with this exact schema:
{
  "category": "sales_meeting" | "customer_call" | "internal_sync" | "demo" | "onboarding" | "review" | "social" | "blocked_time" | "other",
  "revenue_relevance": "high" | "medium" | "low" | "none",
  "meeting_quality_score": <integer 1-10>,
  "key_topics": ["topic1", "topic2"],
  "preparation_needed": <boolean>,
  "summary": "<one sentence>"
}`;

  for (const event of events) {
    try {
      const attendeeList = (Array.isArray(event.attendees) ? event.attendees : [])
        .map((a: { email?: string; name?: string }) => `${a.name || a.email || "unknown"}`)
        .join(", ");

      const content = `Meeting: ${sanitizeForPrompt(event.summary || "", 200)}
Time: ${event.start_time} to ${event.end_time}
Location: ${sanitizeForPrompt(event.location || "N/A", 200)}
Meeting Link: ${event.meeting_link || "None"}
Organizer: ${sanitizeForPrompt(event.organizer_email || "", 100)}
Attendees (${event.ai_attendee_count || 0} total, ${event.ai_external_attendees || 0} external): ${sanitizeForPrompt(attendeeList, 500)}
Description: ${sanitizeForPrompt(event.description || "", 2000)}`;

      const insights = await callClaude(apiKey, systemPrompt, content);

      const { error: updateError } = await supabase
        .from("google_calendar_events")
        .update({
          analyzed_at: new Date().toISOString(),
          ai_insights: insights,
          ai_category: typeof insights.category === "string" ? insights.category : "other",
        })
        .eq("id", event.id)
        .eq("workspace_id", workspaceId);

      if (updateError) {
        console.error("Failed to save event analysis:", updateError.message);
        failed++;
      } else {
        analyzed++;
      }
    } catch (err) {
      console.error("Failed to analyze event:", err);
      failed++;
      await markAnalysisFailed(supabase, "google_calendar_events", event.id, workspaceId);
    }
  }

  return { analyzed, failed };
}

async function analyzeDrive(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  apiKey: string
): Promise<{ analyzed: number; failed: number }> {
  let analyzed = 0;
  let failed = 0;

  const { data: documents, error } = await supabase
    .from("google_drive_documents")
    .select("id, name, mime_type, document_type, content_preview, full_text_extracted, is_shared, owner_email, modified_time")
    .eq("workspace_id", workspaceId)
    .is("analyzed_at", null)
    .limit(BATCH_SIZE);

  if (error || !documents?.length) return { analyzed: 0, failed: 0 };

  const systemPrompt = `You are an AI document analyst for a business revenue platform. Analyze the document and return ONLY a valid JSON object (no markdown, no explanation) with this exact schema:
{
  "category": "proposal" | "contract" | "report" | "presentation" | "spreadsheet" | "planning" | "marketing" | "technical" | "hr" | "finance" | "other",
  "key_topics": ["topic1", "topic2"],
  "summary": "<one sentence>",
  "revenue_relevance": "high" | "medium" | "low" | "none",
  "business_value_score": <integer 1-10>,
  "action_items": ["action1"] or []
}`;

  for (const doc of documents) {
    try {
      const textContent = doc.full_text_extracted || doc.content_preview || "";

      const content = `Document: ${sanitizeForPrompt(doc.name || "", 200)}
Type: ${doc.document_type || "unknown"} (${doc.mime_type || "unknown"})
Shared: ${doc.is_shared ? "Yes" : "No"}
Owner: ${sanitizeForPrompt(doc.owner_email || "", 100)}
Last Modified: ${doc.modified_time || "unknown"}
Content: ${sanitizeForPrompt(textContent, 3000)}`;

      const insights = await callClaude(apiKey, systemPrompt, content);

      const { error: updateError } = await supabase
        .from("google_drive_documents")
        .update({
          analyzed_at: new Date().toISOString(),
          ai_insights: insights,
          ai_category: typeof insights.category === "string" ? insights.category : "other",
          ai_key_topics: Array.isArray(insights.key_topics) ? insights.key_topics : [],
          ai_summary: typeof insights.summary === "string" ? insights.summary : "",
        })
        .eq("id", doc.id)
        .eq("workspace_id", workspaceId);

      if (updateError) {
        console.error("Failed to save document analysis:", updateError.message);
        failed++;
      } else {
        analyzed++;
      }
    } catch (err) {
      console.error("Failed to analyze document:", err);
      failed++;
      await markAnalysisFailed(supabase, "google_drive_documents", doc.id, workspaceId);
    }
  }

  return { analyzed, failed };
}
