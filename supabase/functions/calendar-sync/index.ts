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

    const body = await req.json();
    const tenantId = body.tenantId || body.tenant_id;
    const calendarId = body.calendarId || "primary";
    const timeMin =
      body.timeMin || new Date(Date.now() - 30 * 86400000).toISOString();
    const timeMax =
      body.timeMax || new Date(Date.now() + 90 * 86400000).toISOString();
    const maxResults = body.maxResults || 100;

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        job_type: "calendar_sync",
        status: "running",
        sync_params: { calendarId, timeMin, timeMax, maxResults },
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    let itemsProcessed = 0;
    let itemsAdded = 0;
    let itemsUpdated = 0;
    let itemsFailed = 0;

    try {
      // Fetch events from Google Calendar API
      const eventsUrl = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
      );
      eventsUrl.searchParams.set("timeMin", timeMin);
      eventsUrl.searchParams.set("timeMax", timeMax);
      eventsUrl.searchParams.set("maxResults", String(maxResults));
      eventsUrl.searchParams.set("singleEvents", "true");
      eventsUrl.searchParams.set("orderBy", "startTime");

      const eventsResponse = await fetch(eventsUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!eventsResponse.ok) {
        const errBody = await eventsResponse.text();
        throw new Error(
          `Calendar API error: ${eventsResponse.status} ${errBody}`
        );
      }

      const eventsData = await eventsResponse.json();
      const calendarName = eventsData.summary || calendarId;
      const events = eventsData.items || [];

      for (const event of events) {
        try {
          const parsed = parseCalendarEvent(event, calendarId, calendarName);

          const { error: upsertError } = await supabaseAdmin
            .from("google_calendar_events")
            .upsert(
              {
                tenant_id: tenantId,
                event_id: event.id,
                ...parsed,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "tenant_id,event_id" }
            );

          if (upsertError) {
            console.error("Failed to upsert event:", upsertError);
            itemsFailed++;
          } else {
            itemsAdded++;
          }

          itemsProcessed++;
        } catch (eventError) {
          console.error("Error processing event:", event.id, eventError);
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
          calendar_name: calendarName,
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
    console.error("Error in calendar-sync:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parseCalendarEvent(
  event: Record<string, unknown>,
  calendarId: string,
  calendarName: string
): Record<string, unknown> {
  const start = event.start as Record<string, string> | undefined;
  const end = event.end as Record<string, string> | undefined;
  const isAllDay = !!start?.date;

  const startTime = start?.dateTime || start?.date || new Date().toISOString();
  const endTime = end?.dateTime || end?.date || startTime;
  const timezone = start?.timeZone || "UTC";

  const organizer = event.organizer as Record<string, string> | undefined;
  const attendees =
    (event.attendees as Array<Record<string, unknown>>) || [];

  const externalAttendees = attendees.filter((a) => {
    const email = a.email as string;
    const organizerEmail = organizer?.email || "";
    const organizerDomain = organizerEmail.split("@")[1];
    return email && email.split("@")[1] !== organizerDomain;
  });

  // Extract meeting link from conferenceData or hangoutLink
  let meetingLink: string | null = null;
  const conferenceData = event.conferenceData as Record<string, unknown>;
  if (conferenceData) {
    const entryPoints =
      (conferenceData.entryPoints as Array<Record<string, string>>) || [];
    const videoEntry = entryPoints.find(
      (ep) => ep.entryPointType === "video"
    );
    if (videoEntry) meetingLink = videoEntry.uri;
  }
  if (!meetingLink && event.hangoutLink) {
    meetingLink = event.hangoutLink as string;
  }

  const recurrence = (event.recurrence as string[]) || [];

  return {
    calendar_id: calendarId,
    calendar_name: calendarName,
    summary: (event.summary as string) || "(No title)",
    description: (event.description as string) || null,
    location: (event.location as string) || null,
    start_time: startTime,
    end_time: endTime,
    timezone,
    is_all_day: isAllDay,
    organizer_email: organizer?.email || null,
    organizer_name: organizer?.displayName || null,
    attendees: attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName || null,
      responseStatus: a.responseStatus || "needsAction",
      organizer: a.organizer || false,
    })),
    event_type: (event.eventType as string) || "default",
    meeting_link: meetingLink,
    is_recurring: recurrence.length > 0 || !!event.recurringEventId,
    recurrence_rules: recurrence,
    status: (event.status as string) || "confirmed",
    visibility: (event.visibility as string) || "default",
    ai_attendee_count: attendees.length,
    ai_external_attendees: externalAttendees.length,
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
