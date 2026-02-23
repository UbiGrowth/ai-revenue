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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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
    const maxResults = body.maxResults || 50;
    const query = body.query || "";

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

    // Get workspace connection
    const { data: connection, error: connError } = await supabaseAdmin
      .from("google_workspace_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: "No active Google Workspace connection" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Refresh token if expired
    let accessToken = connection.access_token;
    if (new Date(connection.token_expires_at) <= new Date()) {
      accessToken = await refreshAccessToken(
        supabaseAdmin,
        connection,
        tenantId
      );
    }

    // Create sync job
    const { data: syncJob } = await supabaseAdmin
      .from("google_workspace_sync_jobs")
      .insert({
        tenant_id: tenantId,
        job_type: "gmail_sync",
        status: "running",
        sync_params: { maxResults, query },
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    let itemsProcessed = 0;
    let itemsAdded = 0;
    let itemsUpdated = 0;
    let itemsFailed = 0;

    try {
      // Fetch messages from Gmail API
      const listUrl = new URL(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages"
      );
      listUrl.searchParams.set("maxResults", String(maxResults));
      if (query) listUrl.searchParams.set("q", query);

      const listResponse = await fetch(listUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!listResponse.ok) {
        const errBody = await listResponse.text();
        throw new Error(`Gmail API error: ${listResponse.status} ${errBody}`);
      }

      const listData = await listResponse.json();
      const messages = listData.messages || [];

      // Fetch each message's details
      for (const msg of messages) {
        try {
          const msgResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!msgResponse.ok) {
            itemsFailed++;
            continue;
          }

          const msgData = await msgResponse.json();
          const parsed = parseGmailMessage(msgData);

          const { error: upsertError } = await supabaseAdmin
            .from("gmail_messages")
            .upsert(
              {
                tenant_id: tenantId,
                message_id: msg.id,
                thread_id: msgData.threadId,
                ...parsed,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "tenant_id,message_id" }
            );

          if (upsertError) {
            console.error("Failed to upsert message:", upsertError);
            itemsFailed++;
          } else {
            itemsAdded++;
          }

          itemsProcessed++;
        } catch (msgError) {
          console.error("Error processing message:", msg.id, msgError);
          itemsFailed++;
          itemsProcessed++;
        }
      }

      // Update sync job as completed
      const duration = syncJob
        ? Date.now() - new Date(syncJob.started_at).getTime()
        : 0;

      if (syncJob) {
        await supabaseAdmin
          .from("google_workspace_sync_jobs")
          .update({
            status: "completed",
            items_processed: itemsProcessed,
            items_added: itemsAdded,
            items_updated: itemsUpdated,
            items_failed: itemsFailed,
            completed_at: new Date().toISOString(),
            duration_ms: duration,
          })
          .eq("id", syncJob.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          job_id: syncJob?.id,
          items_processed: itemsProcessed,
          items_added: itemsAdded,
          items_failed: itemsFailed,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (syncError) {
      // Mark sync job as failed
      if (syncJob) {
        await supabaseAdmin
          .from("google_workspace_sync_jobs")
          .update({
            status: "failed",
            error_message:
              syncError instanceof Error
                ? syncError.message
                : "Unknown error",
            items_processed: itemsProcessed,
            items_added: itemsAdded,
            items_failed: itemsFailed,
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncJob.id);
      }
      throw syncError;
    }
  } catch (error: unknown) {
    console.error("Error in gmail-sync:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parseGmailMessage(msgData: Record<string, unknown>): Record<string, unknown> {
  const headers = ((msgData.payload as Record<string, unknown>)?.headers as Array<{ name: string; value: string }>) || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ||
    null;

  const from = getHeader("From") || "";
  const fromMatch = from.match(/^(?:"?([^"]*)"?\s)?<?([^>]*)>?$/);

  const toRaw = getHeader("To") || "";
  const ccRaw = getHeader("Cc") || "";
  const bccRaw = getHeader("Bcc") || "";

  const parseEmails = (raw: string): string[] =>
    raw
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

  const labels = (msgData.labelIds as string[]) || [];
  const snippet = (msgData.snippet as string) || "";

  // Extract body text
  let bodyText = "";
  let bodyHtml = "";
  const payload = msgData.payload as Record<string, unknown>;

  if (payload) {
    const parts = (payload.parts as Array<Record<string, unknown>>) || [];
    if (parts.length > 0) {
      for (const part of parts) {
        const mimeType = part.mimeType as string;
        const bodyData = (part.body as Record<string, unknown>)?.data as string;
        if (mimeType === "text/plain" && bodyData) {
          bodyText = atob(bodyData.replace(/-/g, "+").replace(/_/g, "/"));
        } else if (mimeType === "text/html" && bodyData) {
          bodyHtml = atob(bodyData.replace(/-/g, "+").replace(/_/g, "/"));
        }
      }
    } else {
      const bodyData = (payload.body as Record<string, unknown>)?.data as string;
      if (bodyData) {
        bodyText = atob(bodyData.replace(/-/g, "+").replace(/_/g, "/"));
      }
    }
  }

  // Check for attachments
  const attachments: Array<{ filename: string; mimeType: string; size: number }> = [];
  const parts = (payload?.parts as Array<Record<string, unknown>>) || [];
  for (const part of parts) {
    const filename = part.filename as string;
    if (filename) {
      attachments.push({
        filename,
        mimeType: (part.mimeType as string) || "application/octet-stream",
        size: Number((part.body as Record<string, unknown>)?.size) || 0,
      });
    }
  }

  const internalDate = msgData.internalDate
    ? new Date(Number(msgData.internalDate)).toISOString()
    : null;

  return {
    subject: getHeader("Subject"),
    from_email: fromMatch ? fromMatch[2] : from,
    from_name: fromMatch ? fromMatch[1] || null : null,
    to_emails: parseEmails(toRaw),
    cc_emails: parseEmails(ccRaw),
    bcc_emails: parseEmails(bccRaw),
    body_text: bodyText.substring(0, 50000),
    body_html: bodyHtml.substring(0, 100000),
    snippet,
    labels,
    is_read: !labels.includes("UNREAD"),
    is_starred: labels.includes("STARRED"),
    has_attachments: attachments.length > 0,
    attachments: attachments,
    received_at: internalDate,
    sent_at: labels.includes("SENT") ? internalDate : null,
  };
}

async function refreshAccessToken(
  supabase: ReturnType<typeof createClient>,
  connection: Record<string, unknown>,
  tenantId: string
): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token as string,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }

  // Validate required fields in the response
  if (!data.access_token || typeof data.access_token !== "string") {
    throw new Error(
      `Invalid token response: missing or invalid access_token. Response: ${JSON.stringify(data)}`
    );
  }

  if (typeof data.expires_in !== "number" || data.expires_in <= 0) {
    throw new Error(
      `Invalid token response: missing or invalid expires_in. Response: ${JSON.stringify(data)}`
    );
  }

  const tokenExpiresAt = new Date(
    Date.now() + data.expires_in * 1000
  ).toISOString();

  await supabase
    .from("google_workspace_connections")
    .update({
      access_token: data.access_token,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  return data.access_token;
}
