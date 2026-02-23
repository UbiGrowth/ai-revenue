import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_REDIRECT_DOMAINS = [
  'ubigrowth.ai',
  'preview--ubigrowth-ai.lovable.app',
  'lovable.app',
  'localhost:5173',
  'localhost:3000',
];

function isRedirectSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_REDIRECT_DOMAINS.some(domain =>
      parsed.hostname === domain ||
      parsed.hostname.endsWith(`.${domain}`) ||
      parsed.host === domain
    );
  } catch {
    return false;
  }
}

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Handle OAuth callback (GET request from Google)
    if (action === "callback") {
      return await handleCallback(url);
    }

    // All other actions require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    switch (body.action || "connect") {
      case "connect":
        return await handleConnect(user.id, body, supabaseUrl);
      case "disconnect":
        return await handleDisconnect(user.id, body.tenant_id, supabase);
      case "status":
        return await handleStatus(user.id, body.tenant_id, supabase);
      case "refresh":
        return await handleRefresh(user.id, body.tenant_id);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: unknown) {
    console.error("Error in google-oauth:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleConnect(userId: string, body: Record<string, unknown>, supabaseUrl: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  if (!clientId) {
    return new Response(JSON.stringify({ error: "Google OAuth not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tenantId = body.tenant_id as string;
  if (!tenantId) {
    return new Response(JSON.stringify({ error: "tenant_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requestedRedirect = typeof body.redirect_url === 'string' ? body.redirect_url : null;
  let finalRedirectUrl = "https://ubigrowth.ai/settings/integrations";
  if (requestedRedirect && isRedirectSafe(requestedRedirect)) {
    finalRedirectUrl = requestedRedirect;
  }

  const redirectUri = `${supabaseUrl}/functions/v1/google-oauth?action=callback`;
  const state = btoa(JSON.stringify({
    user_id: userId,
    tenant_id: tenantId,
    redirect_url: finalRedirectUrl,
  }));

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  console.log("Generated Google Workspace OAuth URL for user:", userId);

  return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCallback(url: URL) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  let userId: string;
  let tenantId: string;
  let redirectUrl = "https://ubigrowth.ai/settings/integrations";

  try {
    if (!state) throw new Error("Missing state");
    const stateData = JSON.parse(atob(state));
    if (!stateData.user_id || !stateData.tenant_id) throw new Error("Invalid state data");
    userId = stateData.user_id;
    tenantId = stateData.tenant_id;
    if (stateData.redirect_url && isRedirectSafe(stateData.redirect_url)) {
      redirectUrl = stateData.redirect_url;
    }
  } catch (stateError) {
    console.error("Invalid state parameter:", stateError);
    return Response.redirect(`${redirectUrl}?workspace_error=invalid_state`);
  }

  if (error) {
    console.error("OAuth error:", error);
    return Response.redirect(`${redirectUrl}?workspace_error=${error}`);
  }

  if (!code) {
    return Response.redirect(`${redirectUrl}?workspace_error=no_code`);
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Exchange code for tokens
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${supabaseUrl}/functions/v1/google-oauth?action=callback`,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    console.error("Token exchange failed:", tokenData);
    return Response.redirect(`${redirectUrl}?workspace_error=token_exchange_failed`);
  }

  const { access_token, refresh_token, expires_in, scope } = tokenData;
  if (!refresh_token) {
    return Response.redirect(`${redirectUrl}?workspace_error=no_refresh_token`);
  }

  // Get user email from Google
  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const userInfo = await userInfoResponse.json();
  const email = userInfo.email;

  if (!email) {
    return Response.redirect(`${redirectUrl}?workspace_error=no_email`);
  }

  const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
  const grantedScopes = scope ? scope.split(" ") : [];

  // Store connection in database
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error: upsertError } = await supabase
    .from("google_workspace_connections")
    .upsert({
      tenant_id: tenantId,
      access_token,
      refresh_token,
      token_expires_at: tokenExpiresAt,
      google_email: email,
      scopes: grantedScopes,
      is_active: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "tenant_id",
    });

  if (upsertError) {
    console.error("Failed to store connection:", upsertError);
    return Response.redirect(`${redirectUrl}?workspace_error=storage_failed`);
  }

  console.log("Google Workspace connected for tenant:", tenantId, "email:", email);
  return Response.redirect(`${redirectUrl}?workspace_connected=true`);
}

async function handleDisconnect(userId: string, tenantId: string, supabase: ReturnType<typeof createClient>) {
  if (!tenantId) {
    return new Response(JSON.stringify({ error: "tenant_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error } = await supabase
    .from("google_workspace_connections")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Failed to disconnect:", error);
    return new Response(JSON.stringify({ error: "Failed to disconnect" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleStatus(userId: string, tenantId: string, supabase: ReturnType<typeof createClient>) {
  if (!tenantId) {
    return new Response(JSON.stringify({ error: "tenant_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("google_workspace_connections")
    .select("google_email, scopes, is_active, connected_at, token_expires_at")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ connected: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    connected: data.is_active,
    email: data.google_email,
    scopes: data.scopes,
    connected_at: data.connected_at,
    token_expires_at: data.token_expires_at,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleRefresh(userId: string, tenantId: string) {
  if (!tenantId) {
    return new Response(JSON.stringify({ error: "tenant_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: connection, error: fetchError } = await supabase
    .from("google_workspace_connections")
    .select("refresh_token")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  if (fetchError || !connection) {
    return new Response(JSON.stringify({ error: "No active connection found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
    return new Response(JSON.stringify({ error: "Token refresh failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabase
    .from("google_workspace_connections")
    .update({
      access_token: tokenData.access_token,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  return new Response(JSON.stringify({
    success: true,
    expires_at: tokenExpiresAt,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
