import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidAccessToken, verifyWorkspaceMembership, getRequiredEnv } from "../_shared/google-token.ts";

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

// Validate Drive file/folder IDs: alphanumeric, dashes, underscores
const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

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
    const extractText = body.extract_text !== false;
    const folderId = body.folder_id || null;

    // Validate folder_id to prevent API query injection
    if (folderId && !DRIVE_ID_PATTERN.test(folderId)) {
      return new Response(JSON.stringify({ error: "Invalid folder_id format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get access token
    const accessToken = await getValidAccessToken(workspaceId, serviceRoleKey, supabaseUrl);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No valid Google connection" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Create sync job
    const { data: syncJob, error: jobError } = await adminSupabase
      .from("google_workspace_sync_jobs")
      .insert({
        workspace_id: workspaceId,
        job_type: "drive_sync",
        status: "running",
        sync_params: { max_results: maxResults, extract_text: extractText, folder_id: folderId },
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

    // Cache parent folder names to avoid N+1 API calls
    const folderNameCache = new Map<string, string>();

    try {
      // Build Drive API query
      let query = "trashed=false";
      if (folderId) {
        query += ` and '${folderId}' in parents`;
      }

      const listUrl = new URL("https://www.googleapis.com/drive/v3/files");
      listUrl.searchParams.set("q", query);
      listUrl.searchParams.set("pageSize", String(maxResults));
      listUrl.searchParams.set("fields", "files(id,name,mimeType,webViewLink,size,createdTime,modifiedTime,owners,shared,parents,fileExtension)");
      listUrl.searchParams.set("orderBy", "modifiedTime desc");

      const listResponse = await fetch(listUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      });

      if (!listResponse.ok) {
        const errText = await listResponse.text().catch(() => listResponse.statusText);
        throw new Error(`Drive API error (${listResponse.status}): ${errText}`);
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
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Range: "bytes=0-102400", // Limit download to ~100KB
                },
                signal: AbortSignal.timeout(15000),
              });

              if (exportResponse.ok) {
                fullTextExtracted = await exportResponse.text();
                contentPreview = fullTextExtracted.substring(0, 500);
                fullTextExtracted = fullTextExtracted.substring(0, 100000);
              }
            } catch (exportErr) {
              console.error(`Failed to export text for ${file.id}:`, exportErr);
            }
          }

          // Build folder path with caching
          let folderPath = "";
          const parentId = file.parents?.[0];
          if (parentId) {
            if (folderNameCache.has(parentId)) {
              folderPath = folderNameCache.get(parentId)!;
            } else {
              try {
                const parentResponse = await fetch(
                  `https://www.googleapis.com/drive/v3/files/${parentId}?fields=name`,
                  {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    signal: AbortSignal.timeout(5000),
                  }
                );
                if (parentResponse.ok) {
                  const parentData = await parentResponse.json();
                  folderPath = parentData.name || "";
                }
              } catch {
                // Folder path is optional
              }
              folderNameCache.set(parentId, folderPath);
            }
          }

          const docType = getDocumentType(file.mimeType, file.fileExtension || "");
          const owner = file.owners?.[0];

          const { error: upsertError } = await adminSupabase
            .from("google_drive_documents")
            .upsert({
              workspace_id: workspaceId,
              file_id: file.id,
              name: file.name,
              mime_type: file.mimeType,
              file_extension: file.fileExtension || "",
              web_view_link: file.webViewLink || "",
              folder_id: parentId || null,
              folder_path: folderPath,
              is_shared: file.shared || false,
              content_preview: contentPreview,
              full_text_extracted: fullTextExtracted || null,
              size_bytes: file.size ? parseInt(file.size, 10) : null,
              created_time: file.createdTime,
              modified_time: file.modifiedTime,
              owner_email: owner?.emailAddress || "",
              owner_name: owner?.displayName || "",
              document_type: docType,
            }, {
              onConflict: "workspace_id,file_id",
            });

          if (upsertError) {
            console.error("Failed to upsert document:", upsertError.message);
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
