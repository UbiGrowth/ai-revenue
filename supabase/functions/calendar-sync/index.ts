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

    // Date range for sync (default: 30 days back, 90 days forward)
    const timeMin = body.time_min || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = body.time_max || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const maxResults = Math.min(body.max_results || 100, 500);

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
        job_type: "calendar_sync",
        status: "running",
        sync_params: { time_min: timeMin, time_max: timeMax, max_results: maxResults },
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    let itemsProcessed = 0;
    let itemsAdded = 0;
    let itemsFailed = 0;

    try {
      // First get list of calendars
      const calendarsResponse = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!calendarsResponse.ok) {
        throw new Error(`Calendar API error: ${calendarsResponse.statusText}`);
      }

      const calendarsData = await calendarsResponse.json();
      const calendars = calendarsData.items || [];

      // Sync events from each calendar
      for (const calendar of calendars) {
        const calendarId = encodeURIComponent(calendar.id);
        const eventsUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
        eventsUrl.searchParams.set("timeMin", timeMin);
        eventsUrl.searchParams.set("timeMax", timeMax);
        eventsUrl.searchParams.set("maxResults", String(maxResults));
        eventsUrl.searchParams.set("singleEvents", "true");
        eventsUrl.searchParams.set("orderBy", "startTime");

        const eventsResponse = await fetch(eventsUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!eventsResponse.ok) {
          console.error(`Failed to fetch events for calendar ${calendar.id}`);
          continue;
        }

        const eventsData = await eventsResponse.json();
        const events = eventsData.items || [];

        for (const event of events) {
          itemsProcessed++;
          try {
            const attendees = (event.attendees || []).map((a: Record<string, unknown>) => ({
              email: a.email,
              name: a.displayName || "",
              response_status: a.responseStatus,
              organizer: a.organizer || false,
              self: a.self || false,
            }));

            const externalAttendees = attendees.filter(
              (a: { email: string }) => !a.email.endsWith("@" + calendar.id.split("@")[1])
            );

            // Detect meeting link
            let meetingLink = "";
            if (event.hangoutLink) {
              meetingLink = event.hangoutLink;
            } else if (event.conferenceData?.entryPoints) {
              const videoEntry = event.conferenceData.entryPoints.find(
                (e: { entryPointType: string }) => e.entryPointType === "video"
              );
              if (videoEntry) meetingLink = videoEntry.uri;
            }

            const startTime = event.start?.dateTime || event.start?.date;
            const endTime = event.end?.dateTime || event.end?.date;
            const isAllDay = !event.start?.dateTime;

            const { error: upsertError } = await adminSupabase
              .from("google_calendar_events")
              .upsert({
                tenant_id: tenantId,
                event_id: event.id,
                calendar_id: calendar.id,
                calendar_name: calendar.summary || "",
                summary: event.summary || "(No title)",
                description: (event.description || "").substring(0, 10000),
                location: event.location || "",
                start_time: startTime,
                end_time: endTime,
                timezone: event.start?.timeZone || "UTC",
                is_all_day: isAllDay,
                organizer_email: event.organizer?.email || "",
                organizer_name: event.organizer?.displayName || "",
                attendees,
                event_type: event.eventType || "default",
                meeting_link: meetingLink,
                is_recurring: !!event.recurringEventId,
                recurrence_rules: event.recurrence || [],
                status: event.status || "confirmed",
                visibility: event.visibility || "default",
                ai_attendee_count: attendees.length,
                ai_external_attendees: externalAttendees.length,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: "tenant_id,event_id",
              });

            if (upsertError) {
              console.error("Failed to upsert event:", upsertError);
              itemsFailed++;
            } else {
              itemsAdded++;
            }
          } catch (eventErr) {
            console.error("Failed to process event:", eventErr);
            itemsFailed++;
          }
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
      calendars_synced: (calendarsData?.items || []).length,
      items_processed: itemsProcessed,
      items_added: itemsAdded,
      items_failed: itemsFailed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in calendar-sync:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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
