import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// MIME types that can be exported as text
const EXPORTABLE_MIME_TYPES: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
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
    const extractText = body.extract_text !== false;
    const folderId = body.folder_id || null;

    // Get access token
    const accessToken = await getValidAccessToken(tenantId, serviceRoleKey, supabaseUrl);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No valid Google connection" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Create sync job
    const { data: syncJob } = await adminSupabase
      .from("google_workspace_sync_jobs")
      .insert({
        tenant_id: tenantId,
        job_type: "drive_sync",
        status: "running",
        sync_params: { max_results: maxResults, extract_text: extractText, folder_id: folderId },
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    let itemsProcessed = 0;
    let itemsAdded = 0;
    let itemsFailed = 0;

    try {
      // Build Drive API query
      let query = "trashed=false";
      if (folderId) {
        query += ` and '${folderId}' in parents`;
      }

      const listUrl = new URL("https://www.googleapis.com/drive/v3/files");
      listUrl.searchParams.set("q", query);
      listUrl.searchParams.set("pageSize", String(maxResults));
      listUrl.searchParams.set("fields", "files(id,name,mimeType,webViewLink,size,createdTime,modifiedTime,owners,shared,sharingUser,permissions,parents,fileExtension)");
      listUrl.searchParams.set("orderBy", "modifiedTime desc");

      const listResponse = await fetch(listUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!listResponse.ok) {
        const err = await listResponse.json();
        throw new Error(`Drive API error: ${err.error?.message || listResponse.statusText}`);
      }

      const listData = await listResponse.json();
      const files = listData.files || [];

      for (const file of files) {
        itemsProcessed++;
        try {
          let contentPreview = "";
          let fullTextExtracted = "";

          // Extract text content for supported file types
          if (extractText && EXPORTABLE_MIME_TYPES[file.mimeType]) {
            try {
              const exportMime = EXPORTABLE_MIME_TYPES[file.mimeType];
              const exportUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(exportMime)}`;
              const exportResponse = await fetch(exportUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
              });

              if (exportResponse.ok) {
                fullTextExtracted = await exportResponse.text();
                contentPreview = fullTextExtracted.substring(0, 500);
                // Limit stored text to 100KB
                fullTextExtracted = fullTextExtracted.substring(0, 100000);
              }
            } catch (exportErr) {
              console.error(`Failed to export text for ${file.id}:`, exportErr);
            }
          }

          // Build folder path
          let folderPath = "";
          if (file.parents?.length) {
            try {
              const parentResponse = await fetch(
                `https://www.googleapis.com/drive/v3/files/${file.parents[0]}?fields=name`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              if (parentResponse.ok) {
                const parentData = await parentResponse.json();
                folderPath = parentData.name || "";
              }
            } catch {
              // Folder path is optional
            }
          }

          // Determine document type
          const docType = getDocumentType(file.mimeType, file.fileExtension);

          // Get shared with info
          const sharedWith = (file.permissions || [])
            .filter((p: Record<string, unknown>) => p.type === "user" && !p.role?.toString().includes("owner"))
            .map((p: Record<string, unknown>) => ({
              email: p.emailAddress,
              role: p.role,
              name: p.displayName || "",
            }));

          const owner = file.owners?.[0];

          const { error: upsertError } = await adminSupabase
            .from("google_drive_documents")
            .upsert({
              tenant_id: tenantId,
              file_id: file.id,
              name: file.name,
              mime_type: file.mimeType,
              file_extension: file.fileExtension || "",
              web_view_link: file.webViewLink || "",
              folder_id: file.parents?.[0] || null,
              folder_path: folderPath,
              is_shared: file.shared || false,
              content_preview: contentPreview,
              full_text_extracted: fullTextExtracted || null,
              size_bytes: file.size ? parseInt(file.size) : null,
              created_time: file.createdTime,
              modified_time: file.modifiedTime,
              owner_email: owner?.emailAddress || "",
              owner_name: owner?.displayName || "",
              shared_with: sharedWith,
              document_type: docType,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: "tenant_id,file_id",
            });

          if (upsertError) {
            console.error("Failed to upsert document:", upsertError);
            itemsFailed++;
          } else {
            itemsAdded++;
          }
        } catch (fileErr) {
          console.error("Failed to process file:", fileErr);
          itemsFailed++;
        }
      }

      if (syncJob) {
        await adminSupabase
          .from("google_workspace_sync_jobs")
          .update({
            status: "completed",
            items_processed: itemsProcessed,
            items_added: itemsAdded,
            items_failed: itemsFailed,
            completed_at: new Date().toISOString(),
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
    console.error("Error in drive-sync:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getDocumentType(mimeType: string, extension: string): string {
  const typeMap: Record<string, string> = {
    "application/vnd.google-apps.document": "google_doc",
    "application/vnd.google-apps.spreadsheet": "google_sheet",
    "application/vnd.google-apps.presentation": "google_slides",
    "application/vnd.google-apps.form": "google_form",
    "application/pdf": "pdf",
    "image/png": "image",
    "image/jpeg": "image",
    "image/gif": "image",
    "video/mp4": "video",
    "text/plain": "text",
    "text/csv": "spreadsheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "powerpoint",
  };

  return typeMap[mimeType] || extension || "other";
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

  const expiresAt = new Date(connection.token_expires_at);
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return connection.access_token;
  }

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
  if (!tokenResponse.ok) return null;

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
