import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyWorkspaceMembership, getRequiredEnv } from "../_shared/google-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_REDIRECT_DOMAINS = [
  'ubigrowth.ai',
  'preview--ubigrowth-ai.lovable.app',
  'localhost:5173',
  'localhost:3000',
];

function isRedirectSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_REDIRECT_DOMAINS.some(domain =>
      parsed.host === domain || parsed.hostname === domain
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

// HMAC-sign state to prevent CSRF/tampering
async function signState(payload: Record<string, unknown>): Promise<string> {
  const secret = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const data = JSON.stringify(payload);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return btoa(JSON.stringify({ d: data, s: sig }));
}

async function verifyState(state: string): Promise<Record<string, unknown>> {
  const secret = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const { d: data, s: sig } = JSON.parse(atob(state));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(data));
  if (!valid) throw new Error("Invalid state signature");
  return JSON.parse(data);
}

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

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseAnonKey = getRequiredEnv("SUPABASE_ANON_KEY");
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

    switch (body.action || "connect") {
      case "connect":
        return await handleConnect(user.id, workspaceId, body, supabaseUrl);
      case "disconnect":
        return await handleDisconnect(workspaceId, supabase);
      case "status":
        return await handleStatus(workspaceId, supabase);
      case "refresh":
        return await handleRefresh(workspaceId);
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

async function handleConnect(userId: string, workspaceId: string, body: Record<string, unknown>, supabaseUrl: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  if (!clientId) {
    return new Response(JSON.stringify({ error: "Google OAuth not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requestedRedirect = typeof body.redirect_url === 'string' ? body.redirect_url : null;
  let finalRedirectUrl = "https://ubigrowth.ai/settings/integrations";
  if (requestedRedirect && isRedirectSafe(requestedRedirect)) {
    finalRedirectUrl = requestedRedirect;
  }

  const redirectUri = `${supabaseUrl}/functions/v1/google-oauth?action=callback`;
  const state = await signState({
    user_id: userId,
    workspace_id: workspaceId,
    redirect_url: finalRedirectUrl,
  });

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCallback(url: URL) {
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  let userId: string;
  let workspaceId: string;
  let redirectUrl = "https://ubigrowth.ai/settings/integrations";

  try {
    if (!stateParam) throw new Error("Missing state");
    const stateData = await verifyState(stateParam);
    if (!stateData.user_id || typeof stateData.user_id !== "string" ||
        !stateData.workspace_id || typeof stateData.workspace_id !== "string") {
      throw new Error("Invalid state data");
    }
    userId = stateData.user_id as string;
    workspaceId = stateData.workspace_id as string;
    const candidateRedirect = stateData.redirect_url as string;
    if (candidateRedirect && isRedirectSafe(candidateRedirect)) {
      redirectUrl = candidateRedirect;
    }
  } catch (stateError) {
    console.error("Invalid state parameter:", stateError);
    return Response.redirect(`${redirectUrl}?workspace_error=invalid_state`);
  }

  if (error) {
    console.error("OAuth error:", error);
    return Response.redirect(`${redirectUrl}?workspace_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return Response.redirect(`${redirectUrl}?workspace_error=no_code`);
  }

  let clientId: string, clientSecret: string, supabaseUrl: string, serviceRoleKey: string;
  try {
    clientId = getRequiredEnv("GOOGLE_CLIENT_ID");
    clientSecret = getRequiredEnv("GOOGLE_CLIENT_SECRET");
    supabaseUrl = getRequiredEnv("SUPABASE_URL");
    serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  } catch {
    return Response.redirect(`${redirectUrl}?workspace_error=server_config_error`);
  }

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
    signal: AbortSignal.timeout(15000),
  });

  if (!tokenResponse.ok) {
    console.error("Token exchange failed with status:", tokenResponse.status);
    return Response.redirect(`${redirectUrl}?workspace_error=token_exchange_failed`);
  }

  const tokenData = await tokenResponse.json();
  const { access_token, refresh_token, expires_in, scope } = tokenData;

  if (!access_token || !refresh_token) {
    return Response.redirect(`${redirectUrl}?workspace_error=no_refresh_token`);
  }

  // Get user email from Google
  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
    signal: AbortSignal.timeout(10000),
  });

  if (!userInfoResponse.ok) {
    console.error("Failed to fetch user info:", userInfoResponse.status);
    return Response.redirect(`${redirectUrl}?workspace_error=no_email`);
  }

  const userInfo = await userInfoResponse.json();
  const email = userInfo.email;
  if (!email) {
    return Response.redirect(`${redirectUrl}?workspace_error=no_email`);
  }

  const tokenExpiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();
  const grantedScopes = scope ? scope.split(" ") : [];

  // Re-verify workspace membership at callback time (TOCTOU protection:
  // user may have been removed from workspace between connect and callback)
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const isMember = await verifyWorkspaceMembership(supabase, userId, workspaceId);
  if (!isMember) {
    console.error("User no longer a member of workspace at callback time:", userId, workspaceId);
    return Response.redirect(`${redirectUrl}?workspace_error=forbidden`);
  }
  const { error: upsertError } = await supabase
    .from("google_workspace_connections")
    .upsert({
      workspace_id: workspaceId,
      user_id: userId,
      access_token,
      refresh_token,
      token_expires_at: tokenExpiresAt,
      google_email: email,
      scopes: grantedScopes,
      is_active: true,
      connected_at: new Date().toISOString(),
    }, {
      onConflict: "workspace_id",
    });

  if (upsertError) {
    console.error("Failed to store connection:", upsertError.message);
    return Response.redirect(`${redirectUrl}?workspace_error=storage_failed`);
  }

  console.log("Google Workspace connected for workspace:", workspaceId);
  return Response.redirect(`${redirectUrl}?workspace_connected=true`);
}

async function handleDisconnect(workspaceId: string, supabase: ReturnType<typeof createClient>) {
  const { error } = await supabase
    .from("google_workspace_connections")
    .update({ is_active: false })
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("Failed to disconnect:", error.message);
    return new Response(JSON.stringify({ error: "Failed to disconnect" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleStatus(workspaceId: string, supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("google_workspace_connections")
    .select("google_email, scopes, is_active, connected_at, token_expires_at")
    .eq("workspace_id", workspaceId)
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

async function handleRefresh(workspaceId: string) {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = getRequiredEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getRequiredEnv("GOOGLE_CLIENT_SECRET");

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: connection, error: fetchError } = await supabase
    .from("google_workspace_connections")
    .select("refresh_token")
    .eq("workspace_id", workspaceId)
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
    signal: AbortSignal.timeout(15000),
  });

  if (!tokenResponse.ok) {
    console.error("Token refresh failed with status:", tokenResponse.status);
    return new Response(JSON.stringify({ error: "Token refresh failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tokenData = await tokenResponse.json();
  const tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("google_workspace_connections")
    .update({
      access_token: tokenData.access_token,
      token_expires_at: tokenExpiresAt,
    })
    .eq("workspace_id", workspaceId);

  if (updateError) {
    console.error("Failed to persist refreshed token:", updateError.message);
    return new Response(JSON.stringify({ error: "Failed to save refreshed token" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    expires_at: tokenExpiresAt,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
