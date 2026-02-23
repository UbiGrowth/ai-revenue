import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxResults = Math.min(body.max_results || 50, 200);
    const labelFilter = body.label || "INBOX";

    // Get access token (refresh if needed)
    const accessToken = await getValidAccessToken(tenantId, serviceRoleKey, supabaseUrl);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No valid Google connection" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create sync job
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: syncJob } = await adminSupabase
      .from("google_workspace_sync_jobs")
      .insert({
        tenant_id: tenantId,
        job_type: "gmail_sync",
        status: "running",
        sync_params: { max_results: maxResults, label: labelFilter },
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    let itemsProcessed = 0;
    let itemsAdded = 0;
    let itemsUpdated = 0;
    let itemsFailed = 0;

    try {
      // Fetch message list from Gmail API
      const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
      listUrl.searchParams.set("maxResults", String(maxResults));
      listUrl.searchParams.set("labelIds", labelFilter);

      const listResponse = await fetch(listUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!listResponse.ok) {
        const err = await listResponse.json();
        throw new Error(`Gmail API error: ${err.error?.message || listResponse.statusText}`);
      }

      const listData = await listResponse.json();
      const messages = listData.messages || [];

      // Fetch each message in detail (batch of 10 at a time)
      for (let i = 0; i < messages.length; i += 10) {
        const batch = messages.slice(i, i + 10);
        const detailPromises = batch.map((msg: { id: string }) =>
          fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }).then(r => r.json())
        );

        const details = await Promise.all(detailPromises);

        for (const detail of details) {
          itemsProcessed++;
          try {
            const parsed = parseGmailMessage(detail);

            const { error: upsertError } = await adminSupabase
              .from("gmail_messages")
              .upsert({
                tenant_id: tenantId,
                message_id: detail.id,
                thread_id: detail.threadId,
                ...parsed,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: "tenant_id,message_id",
              });

            if (upsertError) {
              console.error("Failed to upsert message:", upsertError);
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
            items_updated: itemsUpdated,
            items_failed: itemsFailed,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - new Date(syncJob.id ? Date.now() : 0).getTime(),
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
          })
          .eq("id", syncJob.id);
      }
      throw syncError;
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
  const headers = (detail.payload as Record<string, unknown>)?.headers as Array<{ name: string; value: string }> || [];
  const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";

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
  const payload = detail.payload as Record<string, unknown>;
  let bodyText = "";
  let bodyHtml = "";

  function extractParts(part: Record<string, unknown>) {
    const mimeType = part.mimeType as string;
    const bodyData = (part.body as Record<string, unknown>)?.data as string;

    if (mimeType === "text/plain" && bodyData) {
      bodyText = atob(bodyData.replace(/-/g, "+").replace(/_/g, "/"));
    } else if (mimeType === "text/html" && bodyData) {
      bodyHtml = atob(bodyData.replace(/-/g, "+").replace(/_/g, "/"));
    }

    const parts = part.parts as Array<Record<string, unknown>> | undefined;
    if (parts) {
      for (const subPart of parts) {
        extractParts(subPart);
      }
    }
  }
  extractParts(payload);

  // Check for attachments
  const attachments: Array<{ filename: string; mimeType: string; size: number }> = [];
  function findAttachments(part: Record<string, unknown>) {
    const filename = part.filename as string;
    if (filename) {
      attachments.push({
        filename,
        mimeType: part.mimeType as string,
        size: (part.body as Record<string, unknown>)?.size as number || 0,
      });
    }
    const parts = part.parts as Array<Record<string, unknown>> | undefined;
    if (parts) {
      for (const subPart of parts) {
        findAttachments(subPart);
      }
    }
  }
  findAttachments(payload);

  const labels = detail.labelIds as string[] || [];

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
    received_at: date ? new Date(date).toISOString() : null,
    sent_at: labels.includes("SENT") ? (date ? new Date(date).toISOString() : null) : null,
  };
}

async function getValidAccessToken(tenantId: string, serviceRoleKey: string, supabaseUrl: string): Promise<string | null> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: connection, error } = await supabase
    .from("google_workspace_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  if (error || !connection) return null;

  // Check if token is still valid (with 5 minute buffer)
  const expiresAt = new Date(connection.token_expires_at);
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return connection.access_token;
  }

  // Refresh the token
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    console.error("Token refresh failed:", tokenData);
    return null;
  }

  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabase
    .from("google_workspace_connections")
    .update({
      access_token: tokenData.access_token,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  return tokenData.access_token;
}
