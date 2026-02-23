import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidAccessToken, verifyWorkspaceMembership, getRequiredEnv, safeDateToISO, decodeBase64Utf8 } from "../_shared/google-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!workspaceId || typeof workspaceId !== "string") {
      return new Response(JSON.stringify({ error: "workspace_id is required" }), {
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

    const maxResults = Math.min(body.max_results ?? 50, 200);
    const labelFilter = body.label || "INBOX";

    // Get access token (refresh if needed)
    const accessToken = await getValidAccessToken(workspaceId, serviceRoleKey, supabaseUrl);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No valid Google connection" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();

    // Create sync job
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: syncJob, error: jobError } = await adminSupabase
      .from("google_workspace_sync_jobs")
      .insert({
        workspace_id: workspaceId,
        job_type: "gmail_sync",
        status: "running",
        sync_params: { max_results: maxResults, label: labelFilter },
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError) {
      console.error("Failed to create sync job:", jobError.message);
    }

    let itemsProcessed = 0;
    let itemsAdded = 0;
    let itemsFailed = 0;

    try {
      // Fetch message list from Gmail API
      const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
      listUrl.searchParams.set("maxResults", String(maxResults));
      listUrl.searchParams.set("labelIds", labelFilter);

      const listResponse = await fetch(listUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      });

      if (!listResponse.ok) {
        const errText = await listResponse.text().catch(() => listResponse.statusText);
        throw new Error(`Gmail API error (${listResponse.status}): ${errText}`);
      }

      const listData = await listResponse.json();
      const messages = listData.messages || [];

      // Fetch each message in detail (batch of 10 at a time) using allSettled
      for (let i = 0; i < messages.length; i += 10) {
        const batch = messages.slice(i, i + 10);
        const detailResults = await Promise.allSettled(
          batch.map((msg: { id: string }) =>
            fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: AbortSignal.timeout(10000),
            }).then(async (r) => {
              if (!r.ok) throw new Error(`Gmail API ${r.status} for message ${msg.id}`);
              return r.json();
            })
          )
        );

        for (const result of detailResults) {
          itemsProcessed++;

          if (result.status === "rejected") {
            console.error("Failed to fetch message:", result.reason);
            itemsFailed++;
            continue;
          }

          const detail = result.value;
          try {
            const parsed = parseGmailMessage(detail);

            const { error: upsertError } = await adminSupabase
              .from("gmail_messages")
              .upsert({
                workspace_id: workspaceId,
                message_id: detail.id,
                thread_id: detail.threadId,
                ...parsed,
              }, {
                onConflict: "workspace_id,message_id",
              });

            if (upsertError) {
              console.error("Failed to upsert message:", upsertError.message);
              itemsFailed++;
            } else {
              itemsAdded++;
            }
          } catch (parseErr) {
            console.error("Failed to parse message:", parseErr);
            itemsFailed++;
          }
        }
      }

      // Update sync job as completed
      if (syncJob) {
        await adminSupabase
          .from("google_workspace_sync_jobs")
          .update({
            status: "completed",
            items_processed: itemsProcessed,
            items_added: itemsAdded,
            items_failed: itemsFailed,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
          })
          .eq("id", syncJob.id);
      }
    } catch (syncError) {
      if (syncJob) {
        await adminSupabase
          .from("google_workspace_sync_jobs")
          .update({
            status: "failed",
            error_message: syncError instanceof Error ? syncError.message : "Unknown error",
            items_processed: itemsProcessed,
            items_added: itemsAdded,
            items_failed: itemsFailed,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
          })
          .eq("id", syncJob.id);
      }

      // Return partial results instead of re-throwing
      return new Response(JSON.stringify({
        success: false,
        error: syncError instanceof Error ? syncError.message : "Sync failed",
        job_id: syncJob?.id,
        items_processed: itemsProcessed,
        items_added: itemsAdded,
        items_failed: itemsFailed,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      job_id: syncJob?.id,
      items_processed: itemsProcessed,
      items_added: itemsAdded,
      items_failed: itemsFailed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in gmail-sync:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parseGmailMessage(detail: Record<string, unknown>) {
  const payload = detail.payload as Record<string, unknown> | undefined;
  if (!payload) {
    return {
      subject: "", from_email: "", from_name: "",
      to_emails: [], cc_emails: [], bcc_emails: [],
      body_text: "", body_html: "", snippet: (detail.snippet as string) || "",
      labels: [], is_read: true, is_starred: false,
      has_attachments: false, attachments: [],
      received_at: null, sent_at: null,
    };
  }

  const headers = Array.isArray(payload.headers) ? payload.headers as Array<{ name: string; value: string }> : [];
  const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

  const subject = getHeader("Subject");
  const from = getHeader("From");
  const to = getHeader("To");
  const cc = getHeader("Cc");
  const bcc = getHeader("Bcc");
  const date = getHeader("Date");

  // Parse from email/name
  const fromMatch = from.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  const fromName = fromMatch?.[1]?.trim() || "";
  const fromEmail = fromMatch?.[2]?.trim() || from;

  // Parse email lists
  const parseEmailList = (str: string) =>
    str ? str.split(",").map(e => e.trim().replace(/^.*<(.*)>$/, "$1")).filter(Boolean) : [];

  // Extract body text
  let bodyText = "";
  let bodyHtml = "";

  function extractParts(part: Record<string, unknown>) {
    if (!part) return;
    const mimeType = part.mimeType as string;
    const bodyData = (part.body as Record<string, unknown>)?.data as string;

    if (mimeType === "text/plain" && bodyData) {
      try {
        bodyText = decodeBase64Utf8(bodyData);
      } catch { bodyText = ""; }
    } else if (mimeType === "text/html" && bodyData) {
      try {
        bodyHtml = decodeBase64Utf8(bodyData);
      } catch { bodyHtml = ""; }
    }

    const parts = part.parts as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(parts)) {
      for (const subPart of parts) {
        extractParts(subPart);
      }
    }
  }
  extractParts(payload);

  // Check for attachments
  const attachments: Array<{ filename: string; mimeType: string; size: number }> = [];
  function findAttachments(part: Record<string, unknown>) {
    if (!part) return;
    const filename = part.filename as string;
    if (filename) {
      attachments.push({
        filename,
        mimeType: (part.mimeType as string) || "",
        size: (part.body as Record<string, unknown>)?.size as number || 0,
      });
    }
    const parts = part.parts as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(parts)) {
      for (const subPart of parts) {
        findAttachments(subPart);
      }
    }
  }
  findAttachments(payload);

  const labels = Array.isArray(detail.labelIds) ? detail.labelIds as string[] : [];

  return {
    subject,
    from_email: fromEmail,
    from_name: fromName,
    to_emails: parseEmailList(to),
    cc_emails: parseEmailList(cc),
    bcc_emails: parseEmailList(bcc),
    body_text: bodyText.substring(0, 50000),
    body_html: bodyHtml.substring(0, 100000),
    snippet: (detail.snippet as string) || "",
    labels,
    is_read: !labels.includes("UNREAD"),
    is_starred: labels.includes("STARRED"),
    has_attachments: attachments.length > 0,
    attachments: attachments,
    received_at: safeDateToISO(date),
    sent_at: labels.includes("SENT") ? safeDateToISO(date) : null,
  };
}
