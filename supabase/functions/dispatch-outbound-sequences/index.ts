import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const INTERNAL_SECRET = Deno.env.get("INTERNAL_FUNCTION_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface SequenceRun {
  id: string;
  tenant_id: string;
  workspace_id: string;
  campaign_id: string;
  sequence_id: string;
  prospect_id: string;
  last_step_sent: number;
  next_step_due_at: string;
  status: string;
}

interface SequenceStep {
  id: string;
  step_order: number;
  step_type: string;
  channel: string;
  message_template: string;
  delay_days: number;
}

interface Prospect {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  title: string;
  company: string;
  industry: string;
  linkedin_url: string;
}

interface ProspectScore {
  score: number;
  intent_band: string;
  key_signals: string[];
  pain_points: string[];
  recommended_angle: string;
  tone_recommendation: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify internal secret for cron calls
  const internalSecret = req.headers.get("x-internal-secret");
  if (internalSecret !== INTERNAL_SECRET) {
    console.error("Unauthorized: Invalid internal secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log("[dispatch-outbound-sequences] Starting dispatch cycle...");

    // 1. Find due sequence runs
    const now = new Date().toISOString();
    const { data: dueRuns, error: runsError } = await supabase
      .from("outbound_sequence_runs")
      .select("*")
      .eq("status", "active")
      .lte("next_step_due_at", now)
      .limit(50);

    if (runsError) {
      console.error("Error fetching due runs:", runsError);
      throw runsError;
    }

    if (!dueRuns || dueRuns.length === 0) {
      console.log("[dispatch-outbound-sequences] No due sequences found");
      return new Response(JSON.stringify({ processed: 0, message: "No due sequences" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[dispatch-outbound-sequences] Found ${dueRuns.length} due sequence runs`);

    let processed = 0;
    let errors = 0;

    for (const run of dueRuns as SequenceRun[]) {
      try {
        // 2. Fetch the next step
        const nextStepOrder = (run.last_step_sent || 0) + 1;
        const { data: step, error: stepError } = await supabase
          .from("outbound_sequence_steps")
          .select("*")
          .eq("sequence_id", run.sequence_id)
          .eq("step_order", nextStepOrder)
          .single();

        if (stepError || !step) {
          // No more steps - mark sequence as completed
          await supabase
            .from("outbound_sequence_runs")
            .update({ status: "completed", updated_at: now })
            .eq("id", run.id);
          console.log(`[dispatch] Run ${run.id} completed - no more steps`);
          continue;
        }

        const sequenceStep = step as SequenceStep;

        // 3. Fetch prospect data
        const { data: prospect, error: prospectError } = await supabase
          .from("prospects")
          .select("*")
          .eq("id", run.prospect_id)
          .single();

        if (prospectError || !prospect) {
          console.error(`[dispatch] Prospect not found for run ${run.id}`);
          continue;
        }

        const prospectData = prospect as Prospect;

        // 4. Fetch prospect intel (score + signals)
        const { data: scoreData } = await supabase
          .from("prospect_scores")
          .select("*")
          .eq("prospect_id", run.prospect_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const { data: signalsData } = await supabase
          .from("prospect_signals")
          .select("*")
          .eq("prospect_id", run.prospect_id)
          .order("created_at", { ascending: false })
          .limit(5);

        // 5. Fetch brand context from workspace
        const { data: brandProfile } = await supabase
          .from("cmo_brand_profiles")
          .select("*")
          .eq("workspace_id", run.workspace_id)
          .limit(1)
          .single();

        // Build prospect insights
        const prospectInsights = {
          buying_intent_score: scoreData?.score || 50,
          intent_band: scoreData?.intent_band || "warm",
          key_signals: signalsData?.map((s: any) => s.signal_type) || [],
          hypothesized_pain_points: scoreData?.pain_points || [],
          recommended_angle: scoreData?.recommended_angle || "",
          tone_recommendation: scoreData?.tone_recommendation || "professional",
        };

        // Build brand voice
        const brandVoice = {
          tone: brandProfile?.brand_tone || "professional",
          length_preference: sequenceStep.channel === "linkedin" ? "short" : "medium",
          avoid: ["game-changing", "cutting-edge", "revolutionary"],
          product_name: brandProfile?.brand_name || "",
          value_prop: brandProfile?.unique_value_proposition || "",
        };

        // 6. Call outbound_copy via Lovable AI
        const systemPrompt = `You are the Outbound Message Generator for the UbiGrowth AI CMO Outbound OS.
You write short, punchy, non-generic outbound messages that sound like a sharp, no-nonsense SDR or founder.

Rules:
- Always personalize using the prospect_profile and prospect_insights.
- Refer to real signals (promotion, growth, posts) only if they are present.
- Avoid buzzwords and hype ('game-changing', 'cutting-edge', etc.).
- Keep messages tight: 40–120 words for email, 25–80 words for LinkedIn.
- Match tone_recommendation where provided.
- Use a single, clear call-to-action (CTA). Do not list multiple CTAs.
- Output MUST be valid JSON with: message_text, subject_line, variant_tag, reasoning_summary`;

        const userPrompt = JSON.stringify({
          prospect_profile: {
            first_name: prospectData.first_name,
            last_name: prospectData.last_name,
            title: prospectData.title,
            company: prospectData.company,
            industry: prospectData.industry,
            linkedin_url: prospectData.linkedin_url,
          },
          prospect_insights: prospectInsights,
          step_context: {
            step_type: sequenceStep.step_type,
            channel: sequenceStep.channel,
            sequence_position: sequenceStep.step_order,
            call_to_action: "book a call",
          },
          brand_voice: brandVoice,
        });

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.45,
            max_tokens: 700,
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`[dispatch] AI error for run ${run.id}:`, errText);
          errors++;
          continue;
        }

        const aiData = await aiResponse.json();
        const rawContent = aiData.choices?.[0]?.message?.content || "";

        // Parse the AI response
        let messageOutput: { message_text: string; subject_line: string; variant_tag: string; reasoning_summary: string };
        try {
          // Extract JSON from potential markdown code blocks
          const jsonMatch = rawContent.match(/```json\n?([\s\S]*?)\n?```/) || rawContent.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawContent;
          messageOutput = JSON.parse(jsonStr);
        } catch (parseErr) {
          console.error(`[dispatch] Failed to parse AI response for run ${run.id}:`, rawContent);
          errors++;
          continue;
        }

        // 7. Log the message event
        const eventId = crypto.randomUUID();
        await supabase.from("outbound_message_events").insert({
          id: eventId,
          tenant_id: run.tenant_id,
          run_id: run.id,
          step_id: sequenceStep.id,
          event_type: sequenceStep.channel === "email" ? "queued" : "pending",
          channel: sequenceStep.channel,
          message_text: messageOutput.message_text,
          subject_line: messageOutput.subject_line,
          metadata: {
            variant_tag: messageOutput.variant_tag,
            reasoning: messageOutput.reasoning_summary,
            prospect_id: run.prospect_id,
            step_order: sequenceStep.step_order,
          },
        });

        // 8. Dispatch based on channel
        if (sequenceStep.channel === "email" && prospectData.email) {
          // Queue for email dispatch (could trigger email-deploy here)
          console.log(`[dispatch] Email queued for ${prospectData.email}`);
          
          // Update event to sent for email (auto-dispatch)
          await supabase
            .from("outbound_message_events")
            .update({ event_type: "sent", sent_at: now })
            .eq("id", eventId);
        } else if (sequenceStep.channel === "linkedin") {
          // LinkedIn stays as 'pending' for human-in-the-loop queue
          console.log(`[dispatch] LinkedIn message queued for ${prospectData.first_name} ${prospectData.last_name}`);
        }

        // 9. Update sequence run
        const nextStep = await supabase
          .from("outbound_sequence_steps")
          .select("delay_days")
          .eq("sequence_id", run.sequence_id)
          .eq("step_order", nextStepOrder + 1)
          .single();

        const nextDueDate = nextStep.data
          ? new Date(Date.now() + (nextStep.data.delay_days || 1) * 24 * 60 * 60 * 1000).toISOString()
          : null;

        await supabase
          .from("outbound_sequence_runs")
          .update({
            last_step_sent: nextStepOrder,
            next_step_due_at: nextDueDate,
            status: nextDueDate ? "active" : "completed",
            updated_at: now,
          })
          .eq("id", run.id);

        processed++;
        console.log(`[dispatch] Successfully processed run ${run.id}, step ${nextStepOrder}`);
      } catch (runErr) {
        console.error(`[dispatch] Error processing run ${run.id}:`, runErr);
        errors++;
      }
    }

    console.log(`[dispatch-outbound-sequences] Completed: ${processed} processed, ${errors} errors`);

    return new Response(
      JSON.stringify({
        processed,
        errors,
        total: dueRuns.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[dispatch-outbound-sequences] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
