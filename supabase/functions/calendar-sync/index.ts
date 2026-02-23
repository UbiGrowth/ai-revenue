import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidAccessToken, verifyWorkspaceMembership, getRequiredEnv } from "../_shared/google-token.ts";

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

    // Date range for sync (default: 30 days back, 90 days forward)
    const timeMin = body.time_min || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = body.time_max || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const maxResults = Math.min(body.max_results ?? 100, 500);

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
        job_type: "calendar_sync",
        status: "running",
        sync_params: { time_min: timeMin, time_max: timeMax, max_results: maxResults },
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
    let calendarsSynced = 0;

    try {
      // First get list of calendars
      const calendarsResponse = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!calendarsResponse.ok) {
        const errText = await calendarsResponse.text().catch(() => calendarsResponse.statusText);
        throw new Error(`Calendar API error (${calendarsResponse.status}): ${errText}`);
      }

      const calendarsData = await calendarsResponse.json();
      const calendars = calendarsData.items || [];
      calendarsSynced = calendars.length;

      // Sync events from each calendar
      for (const calendar of calendars) {
        const calendarId = encodeURIComponent(calendar.id);
        const eventsUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
        eventsUrl.searchParams.set("timeMin", timeMin);
        eventsUrl.searchParams.set("timeMax", timeMax);
        eventsUrl.searchParams.set("maxResults", String(maxResults));
        eventsUrl.searchParams.set("singleEvents", "true");
        eventsUrl.searchParams.set("orderBy", "startTime");

        let eventsResponse: Response;
        try {
          eventsResponse = await fetch(eventsUrl.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(15000),
          });
        } catch (fetchErr) {
          console.error(`Failed to fetch events for calendar ${calendar.id}:`, fetchErr);
          continue;
        }

        if (!eventsResponse.ok) {
          console.error(`Calendar API ${eventsResponse.status} for calendar ${calendar.id}`);
          continue;
        }

        const eventsData = await eventsResponse.json();
        const events = eventsData.items || [];

        for (const event of events) {
          itemsProcessed++;
          try {
            const attendees = (event.attendees || []).map((a: Record<string, unknown>) => ({
              email: a.email || "",
              name: a.displayName || "",
              response_status: a.responseStatus || "",
              organizer: a.organizer || false,
              self: a.self || false,
            }));

            // Count external attendees using organizer's email domain
            const orgDomain = (event.organizer?.email || "").split("@")[1];
            const externalAttendees = orgDomain
              ? attendees.filter((a: { email: string }) => {
                  const aDomain = a.email.split("@")[1];
                  return aDomain && aDomain !== orgDomain;
                })
              : [];

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

            const eventStartTime = event.start?.dateTime || event.start?.date;
            const eventEndTime = event.end?.dateTime || event.end?.date;
            const isAllDay = !event.start?.dateTime;

            if (!eventStartTime || !eventEndTime) {
              console.error("Event missing start/end time:", event.id);
              itemsFailed++;
              continue;
            }

            const { error: upsertError } = await adminSupabase
              .from("google_calendar_events")
              .upsert({
                workspace_id: workspaceId,
                event_id: event.id,
                calendar_id: calendar.id,
                calendar_name: calendar.summary || "",
                summary: event.summary || "(No title)",
                description: (event.description || "").substring(0, 10000),
                location: event.location || "",
                start_time: eventStartTime,
                end_time: eventEndTime,
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
              }, {
                onConflict: "workspace_id,event_id,calendar_id",
              });

            if (upsertError) {
              console.error("Failed to upsert event:", upsertError.message);
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
            duration_ms: Date.now() - startTime,
          })
          .eq("id", syncJob.id)
          .eq("workspace_id", workspaceId);
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
          .eq("id", syncJob.id)
          .eq("workspace_id", workspaceId);
      }

      return new Response(JSON.stringify({
        success: false,
        error: syncError instanceof Error ? syncError.message : "Sync failed",
        job_id: syncJob?.id,
        calendars_synced: calendarsSynced,
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
      calendars_synced: calendarsSynced,
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
