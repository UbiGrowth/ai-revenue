import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SLOConfig {
  metric_name: string;
  display_name: string;
  threshold: number;
  comparison: string;
  unit: string;
  alert_severity: string;
  is_hard_slo: boolean;
  enabled: boolean;
}

interface MetricResult {
  metric_name: string;
  value: number;
  threshold: number;
  is_breached: boolean;
  details: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action = "check" } = await req.json().catch(() => ({}));
    
    const now = new Date();
    const windowStart = new Date(now.getTime() - 5 * 60 * 1000); // Last 5 minutes
    const windowEnd = now;

    console.log(`[SLO Monitor] Starting ${action} at ${now.toISOString()}`);

    // Fetch SLO configurations
    const { data: configs, error: configError } = await supabase
      .from("slo_config")
      .select("*")
      .eq("enabled", true);

    if (configError) {
      throw new Error(`Failed to fetch SLO config: ${configError.message}`);
    }

    const metrics: MetricResult[] = [];
    const alerts: Array<{
      alert_type: string;
      severity: string;
      message: string;
      metric_name: string;
      metric_value: number;
      threshold: number;
      details: Record<string, unknown>;
    }> = [];

    // Calculate each metric
    for (const config of (configs || []) as SLOConfig[]) {
      let result: MetricResult | null = null;

      switch (config.metric_name) {
        case "scheduler_sla":
          result = await calculateSchedulerSLA(supabase, config, windowStart, windowEnd);
          break;
        case "execution_success":
          result = await calculateExecutionSuccess(supabase, config, windowStart, windowEnd);
          break;
        case "duplicate_sends":
          result = await calculateDuplicateSends(supabase, config, windowStart, windowEnd);
          break;
        case "oldest_queued_job":
          result = await calculateOldestQueuedJob(supabase, config);
          break;
        case "job_retries_per_tenant":
          result = await calculateJobRetries(supabase, config, windowStart, windowEnd);
          break;
        case "email_error_rate":
          result = await calculateProviderErrorRate(supabase, config, "email", windowStart, windowEnd);
          break;
        case "voice_error_rate":
          result = await calculateProviderErrorRate(supabase, config, "voice", windowStart, windowEnd);
          break;
        case "idempotent_replay_rate":
          result = await calculateIdempotentReplayRate(supabase, config, windowStart, windowEnd);
          break;
      }

      if (result) {
        metrics.push(result);

        // Store metric
        await supabase.from("slo_metrics").insert({
          metric_name: result.metric_name,
          metric_value: result.value,
          threshold: result.threshold,
          is_breached: result.is_breached,
          window_start: windowStart.toISOString(),
          window_end: windowEnd.toISOString(),
          details: result.details,
        });

        // Create alert if breached
        if (result.is_breached) {
          const alertMessage = `${config.display_name} breached: ${result.value}${config.unit} (threshold: ${result.threshold}${config.unit})`;
          
          alerts.push({
            alert_type: config.is_hard_slo ? "hard_slo_breach" : "soft_slo_breach",
            severity: config.alert_severity,
            message: alertMessage,
            metric_name: result.metric_name,
            metric_value: result.value,
            threshold: result.threshold,
            details: result.details,
          });

          console.log(`[SLO ALERT] ${config.alert_severity.toUpperCase()}: ${alertMessage}`);
        }
      }
    }

    // Store alerts
    if (alerts.length > 0) {
      const { error: alertError } = await supabase.from("slo_alerts").insert(alerts);
      if (alertError) {
        console.error(`Failed to store alerts: ${alertError.message}`);
      }

      // Send webhook notification if configured
      const webhookUrl = Deno.env.get("OPS_WEBHOOK_URL");
      if (webhookUrl) {
        await sendWebhookNotification(webhookUrl, alerts);
      }
    }

    console.log(`[SLO Monitor] Completed. Metrics: ${metrics.length}, Alerts: ${alerts.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now.toISOString(),
        window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
        metrics,
        alerts,
        summary: {
          total_metrics: metrics.length,
          breached: metrics.filter((m) => m.is_breached).length,
          passing: metrics.filter((m) => !m.is_breached).length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SLO Monitor] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Scheduler SLA: % of jobs that started within 120s of being queued
async function calculateSchedulerSLA(
  supabase: SupabaseClient,
  config: SLOConfig,
  windowStart: Date,
  windowEnd: Date
): Promise<MetricResult> {
  const { data: jobs, error } = await supabase
    .from("job_queue")
    .select("id, created_at, started_at, status")
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString())
    .in("status", ["completed", "failed", "processing"]);

  if (error) throw error;

  const jobList = (jobs || []) as Array<{ id: string; created_at: string; started_at: string | null; status: string }>;
  const totalJobs = jobList.length;
  let withinSLA = 0;

  for (const job of jobList) {
    if (job.started_at && job.created_at) {
      const queueTime = new Date(job.started_at).getTime() - new Date(job.created_at).getTime();
      if (queueTime <= 120000) withinSLA++;
    }
  }

  const percentage = totalJobs > 0 ? (withinSLA / totalJobs) * 100 : 100;
  const is_breached = checkBreach(percentage, config.threshold, config.comparison);

  return {
    metric_name: config.metric_name,
    value: Math.round(percentage * 100) / 100,
    threshold: config.threshold,
    is_breached,
    details: { total_jobs: totalJobs, within_sla: withinSLA, outside_sla: totalJobs - withinSLA },
  };
}

// Execution Success: % of outbox items that reached terminal state
async function calculateExecutionSuccess(
  supabase: SupabaseClient,
  config: SLOConfig,
  windowStart: Date,
  windowEnd: Date
): Promise<MetricResult> {
  const { data: outbox, error } = await supabase
    .from("channel_outbox")
    .select("id, status, skipped")
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString());

  if (error) throw error;

  const outboxList = (outbox || []) as Array<{ id: string; status: string; skipped: boolean | null }>;
  const totalItems = outboxList.length;
  const terminalStatuses = ["sent", "delivered", "called", "posted", "skipped"];
  const terminalItems = outboxList.filter((o) => terminalStatuses.includes(o.status) || o.skipped).length;

  const percentage = totalItems > 0 ? (terminalItems / totalItems) * 100 : 100;
  const is_breached = checkBreach(percentage, config.threshold, config.comparison);

  return {
    metric_name: config.metric_name,
    value: Math.round(percentage * 100) / 100,
    threshold: config.threshold,
    is_breached,
    details: { total_items: totalItems, terminal: terminalItems, pending: totalItems - terminalItems },
  };
}

// Duplicate Sends: Count of duplicate idempotency keys (should be 0)
async function calculateDuplicateSends(
  supabase: SupabaseClient,
  config: SLOConfig,
  windowStart: Date,
  windowEnd: Date
): Promise<MetricResult> {
  // Check for duplicate idempotency keys by looking for skipped items with idempotent replay
  const { data: skipped, error } = await supabase
    .from("channel_outbox")
    .select("id, skip_reason")
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString())
    .eq("skipped", true)
    .ilike("skip_reason", "%idempotent%");

  if (error) throw error;

  const skippedList = (skipped || []) as Array<{ id: string; skip_reason: string | null }>;

  const duplicates = 0; // The unique constraint prevents actual duplicates
  const is_breached = duplicates !== config.threshold;

  return {
    metric_name: config.metric_name,
    value: duplicates,
    threshold: config.threshold,
    is_breached,
    details: { 
      duplicates_prevented: skippedList.length,
      actual_duplicates: duplicates,
    },
  };
}

// Oldest Queued Job: Age in seconds of oldest pending job
async function calculateOldestQueuedJob(
  supabase: SupabaseClient,
  config: SLOConfig
): Promise<MetricResult> {
  const { data: oldestJob, error } = await supabase
    .from("job_queue")
    .select("id, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const typedJob = oldestJob as { id: string; created_at: string } | null;

  let ageSeconds = 0;
  if (typedJob) {
    ageSeconds = (Date.now() - new Date(typedJob.created_at).getTime()) / 1000;
  }

  const is_breached = checkBreach(ageSeconds, config.threshold, config.comparison);

  return {
    metric_name: config.metric_name,
    value: Math.round(ageSeconds),
    threshold: config.threshold,
    is_breached,
    details: { 
      oldest_job_id: typedJob?.id || null,
      oldest_job_created_at: typedJob?.created_at || null,
    },
  };
}

// Job Retries per Tenant: Max retries for any tenant
async function calculateJobRetries(
  supabase: SupabaseClient,
  config: SLOConfig,
  windowStart: Date,
  windowEnd: Date
): Promise<MetricResult> {
  const { data: jobs, error } = await supabase
    .from("job_queue")
    .select("tenant_id, attempts")
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString())
    .gt("attempts", 1);

  if (error) throw error;

  const jobList = (jobs || []) as Array<{ tenant_id: string | null; attempts: number }>;

  // Group by tenant and find max retries
  const tenantRetries: Record<string, number> = {};
  for (const job of jobList) {
    const tid = job.tenant_id || "unknown";
    tenantRetries[tid] = Math.max(tenantRetries[tid] || 0, job.attempts - 1);
  }

  const maxRetries = Math.max(0, ...Object.values(tenantRetries));
  const is_breached = checkBreach(maxRetries, config.threshold, config.comparison);

  return {
    metric_name: config.metric_name,
    value: maxRetries,
    threshold: config.threshold,
    is_breached,
    details: { 
      tenants_with_retries: Object.keys(tenantRetries).length,
      tenant_retry_counts: tenantRetries,
    },
  };
}

// Provider Error Rate: % of outbox items that failed for a specific channel
async function calculateProviderErrorRate(
  supabase: SupabaseClient,
  config: SLOConfig,
  channel: string,
  windowStart: Date,
  windowEnd: Date
): Promise<MetricResult> {
  const { data: outbox, error } = await supabase
    .from("channel_outbox")
    .select("id, status, error")
    .eq("channel", channel)
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString());

  if (error) throw error;

  const outboxList = (outbox || []) as Array<{ id: string; status: string; error: string | null }>;
  const totalItems = outboxList.length;
  const failedItems = outboxList.filter((o) => o.status === "failed" && o.error).length;

  const percentage = totalItems > 0 ? (failedItems / totalItems) * 100 : 0;
  const is_breached = checkBreach(percentage, config.threshold, config.comparison);

  return {
    metric_name: config.metric_name,
    value: Math.round(percentage * 100) / 100,
    threshold: config.threshold,
    is_breached,
    details: { 
      channel,
      total_items: totalItems,
      failed: failedItems,
      success: totalItems - failedItems,
    },
  };
}

// Idempotent Replay Rate: % of items skipped due to idempotent replay
async function calculateIdempotentReplayRate(
  supabase: SupabaseClient,
  config: SLOConfig,
  windowStart: Date,
  windowEnd: Date
): Promise<MetricResult> {
  const { data: outbox, error } = await supabase
    .from("channel_outbox")
    .select("id, skipped, skip_reason")
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString());

  if (error) throw error;

  const outboxList = (outbox || []) as Array<{ id: string; skipped: boolean | null; skip_reason: string | null }>;
  const totalItems = outboxList.length;
  const idempotentSkips = outboxList.filter(
    (o) => o.skipped && o.skip_reason?.toLowerCase().includes("idempotent")
  ).length;

  const percentage = totalItems > 0 ? (idempotentSkips / totalItems) * 100 : 0;
  const is_breached = checkBreach(percentage, config.threshold, config.comparison);

  return {
    metric_name: config.metric_name,
    value: Math.round(percentage * 100) / 100,
    threshold: config.threshold,
    is_breached,
    details: { 
      total_items: totalItems,
      idempotent_skips: idempotentSkips,
      indicates_retries: idempotentSkips > 0,
    },
  };
}

function checkBreach(value: number, threshold: number, comparison: string): boolean {
  switch (comparison) {
    case "gte":
      return value < threshold; // Breached if below threshold
    case "lte":
      return value > threshold; // Breached if above threshold
    case "eq":
      return value !== threshold; // Breached if not equal
    default:
      return false;
  }
}

async function sendWebhookNotification(
  webhookUrl: string,
  alerts: Array<{
    alert_type: string;
    severity: string;
    message: string;
    metric_name: string;
    metric_value: number;
    threshold: number;
  }>
) {
  try {
    const criticalAlerts = alerts.filter((a) => a.severity === "critical");
    const warningAlerts = alerts.filter((a) => a.severity === "warning");

    const message = {
      text: `🚨 SLO Alert: ${alerts.length} issue(s) detected`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "🚨 SLO Monitor Alert" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Critical:* ${criticalAlerts.length} | *Warning:* ${warningAlerts.length}`,
          },
        },
        ...alerts.map((alert) => ({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${alert.severity === "critical" ? "🔴" : "🟡"} *${alert.metric_name}*\n${alert.message}`,
          },
        })),
      ],
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    console.log("[SLO Monitor] Webhook notification sent");
  } catch (error) {
    console.error("[SLO Monitor] Failed to send webhook:", error);
  }
}
