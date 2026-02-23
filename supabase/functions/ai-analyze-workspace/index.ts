import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const BATCH_SIZE = 10;

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
    const tenantId = body.tenant_id as string;
    const dataType = body.data_type as string; // "gmail", "calendar", "drive", or "all"

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    const results: Record<string, { analyzed: number; failed: number }> = {};

    const typesToAnalyze = dataType === "all" ? ["gmail", "calendar", "drive"] : [dataType || "gmail"];

    for (const type of typesToAnalyze) {
      switch (type) {
        case "gmail":
          results.gmail = await analyzeGmail(adminSupabase, tenantId, anthropicApiKey);
          break;
        case "calendar":
          results.calendar = await analyzeCalendar(adminSupabase, tenantId, anthropicApiKey);
          break;
        case "drive":
          results.drive = await analyzeDrive(adminSupabase, tenantId, anthropicApiKey);
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
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Claude API error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "{}";

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("No JSON found in Claude response:", text);
    return {};
  }

  return JSON.parse(jsonMatch[0]);
}

async function analyzeGmail(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  apiKey: string
): Promise<{ analyzed: number; failed: number }> {
  let analyzed = 0;
  let failed = 0;

  // Get unanalyzed emails
  const { data: emails, error } = await supabase
    .from("gmail_messages")
    .select("id, subject, from_email, from_name, snippet, body_text, labels")
    .eq("tenant_id", tenantId)
    .is("analyzed_at", null)
    .limit(BATCH_SIZE);

  if (error || !emails?.length) return { analyzed: 0, failed: 0 };

  const systemPrompt = `You are an AI email analyst for a business revenue platform. Analyze the email and return a JSON object with:
{
  "category": "sales_inquiry" | "customer_support" | "partnership" | "newsletter" | "transactional" | "internal" | "spam" | "other",
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "priority_score": 1-10 (10 = highest priority for revenue),
  "key_topics": ["topic1", "topic2"],
  "action_required": true | false,
  "summary": "One sentence summary",
  "revenue_relevance": "high" | "medium" | "low" | "none"
}
Only return the JSON object, no other text.`;

  for (const email of emails) {
    try {
      const content = `Subject: ${email.subject || "(no subject)"}
From: ${email.from_name} <${email.from_email}>
Labels: ${(email.labels || []).join(", ")}
Preview: ${email.snippet || ""}
Body excerpt: ${(email.body_text || "").substring(0, 2000)}`;

      const insights = await callClaude(apiKey, systemPrompt, content);

      await supabase
        .from("gmail_messages")
        .update({
          analyzed_at: new Date().toISOString(),
          ai_insights: insights,
          ai_category: insights.category as string || "other",
          ai_sentiment: insights.sentiment as string || "neutral",
          ai_priority_score: (insights.priority_score as number) || 5,
        })
        .eq("id", email.id);

      analyzed++;
    } catch (err) {
      console.error("Failed to analyze email:", err);
      failed++;
    }
  }

  return { analyzed, failed };
}

async function analyzeCalendar(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  apiKey: string
): Promise<{ analyzed: number; failed: number }> {
  let analyzed = 0;
  let failed = 0;

  const { data: events, error } = await supabase
    .from("google_calendar_events")
    .select("id, summary, description, location, start_time, end_time, attendees, organizer_email, ai_attendee_count, ai_external_attendees, meeting_link")
    .eq("tenant_id", tenantId)
    .is("analyzed_at", null)
    .limit(BATCH_SIZE);

  if (error || !events?.length) return { analyzed: 0, failed: 0 };

  const systemPrompt = `You are an AI calendar analyst for a business revenue platform. Analyze the meeting/event and return a JSON object with:
{
  "category": "sales_meeting" | "customer_call" | "internal_sync" | "demo" | "onboarding" | "review" | "social" | "blocked_time" | "other",
  "revenue_relevance": "high" | "medium" | "low" | "none",
  "meeting_quality_score": 1-10 (10 = most valuable for business),
  "key_topics": ["topic1", "topic2"],
  "preparation_needed": true | false,
  "summary": "One sentence about the meeting purpose"
}
Only return the JSON object, no other text.`;

  for (const event of events) {
    try {
      const attendeeList = (event.attendees || [])
        .map((a: { email: string; name: string }) => `${a.name || a.email}`)
        .join(", ");

      const content = `Meeting: ${event.summary}
Time: ${event.start_time} to ${event.end_time}
Location: ${event.location || "N/A"}
Meeting Link: ${event.meeting_link || "None"}
Organizer: ${event.organizer_email}
Attendees (${event.ai_attendee_count} total, ${event.ai_external_attendees} external): ${attendeeList}
Description: ${(event.description || "").substring(0, 2000)}`;

      const insights = await callClaude(apiKey, systemPrompt, content);

      await supabase
        .from("google_calendar_events")
        .update({
          analyzed_at: new Date().toISOString(),
          ai_insights: insights,
          ai_category: insights.category as string || "other",
        })
        .eq("id", event.id);

      analyzed++;
    } catch (err) {
      console.error("Failed to analyze event:", err);
      failed++;
    }
  }

  return { analyzed, failed };
}

async function analyzeDrive(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  apiKey: string
): Promise<{ analyzed: number; failed: number }> {
  let analyzed = 0;
  let failed = 0;

  const { data: documents, error } = await supabase
    .from("google_drive_documents")
    .select("id, name, mime_type, document_type, content_preview, full_text_extracted, is_shared, owner_email, modified_time")
    .eq("tenant_id", tenantId)
    .is("analyzed_at", null)
    .limit(BATCH_SIZE);

  if (error || !documents?.length) return { analyzed: 0, failed: 0 };

  const systemPrompt = `You are an AI document analyst for a business revenue platform. Analyze the document and return a JSON object with:
{
  "category": "proposal" | "contract" | "report" | "presentation" | "spreadsheet" | "planning" | "marketing" | "technical" | "hr" | "finance" | "other",
  "key_topics": ["topic1", "topic2"],
  "summary": "One sentence summary of the document",
  "revenue_relevance": "high" | "medium" | "low" | "none",
  "business_value_score": 1-10 (10 = most valuable for business),
  "action_items": ["action1", "action2"] or []
}
Only return the JSON object, no other text.`;

  for (const doc of documents) {
    try {
      const textContent = doc.full_text_extracted || doc.content_preview || "";

      const content = `Document: ${doc.name}
Type: ${doc.document_type} (${doc.mime_type})
Shared: ${doc.is_shared ? "Yes" : "No"}
Owner: ${doc.owner_email}
Last Modified: ${doc.modified_time}
Content: ${textContent.substring(0, 3000)}`;

      const insights = await callClaude(apiKey, systemPrompt, content);

      await supabase
        .from("google_drive_documents")
        .update({
          analyzed_at: new Date().toISOString(),
          ai_insights: insights,
          ai_category: insights.category as string || "other",
          ai_key_topics: (insights.key_topics as string[]) || [],
          ai_summary: (insights.summary as string) || "",
        })
        .eq("id", doc.id);

      analyzed++;
    } catch (err) {
      console.error("Failed to analyze document:", err);
      failed++;
    }
  }

  return { analyzed, failed };
}
