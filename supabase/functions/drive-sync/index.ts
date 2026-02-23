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
    const folderId = body.folderId || null;
    const maxResults = body.maxResults || 100;
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
        job_type: "drive_sync",
        status: "running",
        sync_params: { folderId, maxResults, query },
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    let itemsProcessed = 0;
    let itemsAdded = 0;
    let itemsUpdated = 0;
    let itemsFailed = 0;

    try {
      // Build Drive API query
      let driveQuery = "trashed = false";
      if (folderId) {
        // Escape single quotes in folderId for Drive API query syntax
        const escapedFolderId = (folderId as string).replace(/'/g, "\\'");
        driveQuery += ` and '${escapedFolderId}' in parents`;
      }
      if (query) {
        // Escape single quotes in query for Drive API query syntax
        const escapedQuery = query.replace(/'/g, "\\'");
        driveQuery += ` and (name contains '${escapedQuery}' or fullText contains '${escapedQuery}')`;
      }

      const filesUrl = new URL(
        "https://www.googleapis.com/drive/v3/files"
      );
      filesUrl.searchParams.set("q", driveQuery);
      filesUrl.searchParams.set("pageSize", String(maxResults));
      filesUrl.searchParams.set(
        "fields",
        "files(id,name,mimeType,fileExtension,webViewLink,parents,shared,size,createdTime,modifiedTime,lastModifyingUser,owners,sharingUser,permissions),nextPageToken"
      );
      filesUrl.searchParams.set("orderBy", "modifiedTime desc");

      const filesResponse = await fetch(filesUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!filesResponse.ok) {
        const errBody = await filesResponse.text();
        throw new Error(
          `Drive API error: ${filesResponse.status} ${errBody}`
        );
      }

      const filesData = await filesResponse.json();
      const files = filesData.files || [];

      for (const file of files) {
        try {
          const parsed = parseDriveFile(file);

          // Attempt to extract text from Google Docs/Sheets/Slides
          let fullTextExtracted: string | null = null;
          const exportableMimeTypes: Record<string, string> = {
            "application/vnd.google-apps.document": "text/plain",
            "application/vnd.google-apps.spreadsheet": "text/csv",
            "application/vnd.google-apps.presentation": "text/plain",
          };

          const exportMime = exportableMimeTypes[file.mimeType];
          if (exportMime) {
            try {
              const exportUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(exportMime)}`;
              const exportResponse = await fetch(exportUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
              });

              if (exportResponse.ok) {
                const text = await exportResponse.text();
                fullTextExtracted = text.substring(0, 100000);
              }
            } catch (exportError) {
              console.error(
                "Error extracting text from:",
                file.name,
                exportError
              );
            }
          }

          const { error: upsertError } = await supabaseAdmin
            .from("google_drive_documents")
            .upsert(
              {
                tenant_id: tenantId,
                file_id: file.id,
                ...parsed,
                full_text_extracted: fullTextExtracted,
                content_preview: fullTextExtracted
                  ? fullTextExtracted.substring(0, 500)
                  : null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "tenant_id,file_id" }
            );

          if (upsertError) {
            console.error("Failed to upsert file:", upsertError);
            itemsFailed++;
          } else {
            itemsAdded++;
          }

          itemsProcessed++;
        } catch (fileError) {
          console.error("Error processing file:", file.id, fileError);
          itemsFailed++;
          itemsProcessed++;
        }
      }

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
    console.error("Error in drive-sync:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parseDriveFile(file: Record<string, unknown>): Record<string, unknown> {
  const owners = (file.owners as Array<Record<string, string>>) || [];
  const primaryOwner = owners[0] || {};

  const permissions =
    (file.permissions as Array<Record<string, unknown>>) || [];
  const sharedWith = permissions
    .filter((p) => p.type === "user" && p.role !== "owner")
    .map((p) => ({
      email: p.emailAddress,
      displayName: p.displayName || null,
      role: p.role,
    }));

  const mimeType = (file.mimeType as string) || "";
  const mimeToDocType: Record<string, string> = {
    "application/vnd.google-apps.document": "google_doc",
    "application/vnd.google-apps.spreadsheet": "google_sheet",
    "application/vnd.google-apps.presentation": "google_slides",
    "application/vnd.google-apps.form": "google_form",
    "application/pdf": "pdf",
    "image/": "image",
    "video/": "video",
    "audio/": "audio",
  };

  let documentType = "other";
  for (const [mime, docType] of Object.entries(mimeToDocType)) {
    if (mimeType.startsWith(mime) || mimeType === mime) {
      documentType = docType;
      break;
    }
  }

  const parents = (file.parents as string[]) || [];
  const lastModifyingUser = file.lastModifyingUser as Record<string, string>;

  return {
    name: (file.name as string) || "Untitled",
    mime_type: mimeType,
    file_extension: (file.fileExtension as string) || null,
    web_view_link: (file.webViewLink as string) || null,
    download_url: null,
    folder_id: parents[0] || null,
    folder_path: null,
    is_shared: (file.shared as boolean) || false,
    size_bytes: file.size ? Number(file.size) : null,
    created_time: (file.createdTime as string) || null,
    modified_time: (file.modifiedTime as string) || null,
    last_modified_by_email: lastModifyingUser?.emailAddress || null,
    owner_email: primaryOwner.emailAddress || null,
    owner_name: primaryOwner.displayName || null,
    shared_with: sharedWith,
    document_type: documentType,
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
