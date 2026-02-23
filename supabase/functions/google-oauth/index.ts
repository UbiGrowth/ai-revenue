import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_REDIRECT_DOMAINS = [
  "ubigrowth.ai",
  "preview--ubigrowth-ai.lovable.app",
  "lovable.app",
  "localhost:5173",
  "localhost:3000",
];

function isRedirectSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_REDIRECT_DOMAINS.some(
      (domain) =>
        parsed.hostname === domain ||
        parsed.hostname.endsWith(`.${domain}`) ||
        parsed.host === domain
    );
  } catch {
    return false;
  }
}

const GOOGLE_WORKSPACE_SCOPES = [
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

    if (action === "callback") {
      return await handleCallback(url);
    }

    return await handleStart(req);
  } catch (error: unknown) {
    console.error("Error in google-oauth:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleStart(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify user via service role
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    console.error("Auth error:", authError);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  if (!clientId) {
    console.error("GOOGLE_CLIENT_ID not configured");
    return new Response(
      JSON.stringify({ error: "Google OAuth not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const body = await req.json().catch(() => ({}));
  const tenantId = body.tenantId || body.tenant_id;
  const requestedRedirect =
    typeof body.redirectUrl === "string" ? body.redirectUrl : null;
  const requestedScopes =
    typeof body.scopes === "string" ? body.scopes : GOOGLE_WORKSPACE_SCOPES;

  if (!tenantId) {
    return new Response(JSON.stringify({ error: "tenant_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let finalRedirectUrl = "https://ubigrowth.ai/settings/integrations";
  if (requestedRedirect && isRedirectSafe(requestedRedirect)) {
    finalRedirectUrl = requestedRedirect;
  } else if (requestedRedirect) {
    console.warn("Rejected unsafe redirect URL:", requestedRedirect);
  }

  const redirectUri = `${supabaseUrl}/functions/v1/google-oauth?action=callback`;

  const state = btoa(
    JSON.stringify({
      user_id: user.id,
      tenant_id: tenantId,
      redirect_url: finalRedirectUrl,
    })
  );

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", requestedScopes);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  console.log(
    "Generated Google Workspace OAuth URL for user:",
    user.id,
    "tenant:",
    tenantId
  );

  return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCallback(url: URL): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  let userId: string;
  let tenantId: string;
  let redirectUrl = "https://ubigrowth.ai/settings/integrations";

  try {
    if (!state) throw new Error("Missing state parameter");
    const stateData = JSON.parse(atob(state));

    if (
      !stateData.user_id ||
      typeof stateData.user_id !== "string" ||
      stateData.user_id.length < 32 ||
      stateData.user_id.length > 256
    ) {
      throw new Error("Invalid user_id in state");
    }
    if (!stateData.tenant_id) {
      throw new Error("Missing tenant_id in state");
    }

    userId = stateData.user_id;
    tenantId = stateData.tenant_id;

    const candidateRedirect = stateData.redirect_url || redirectUrl;
    if (isRedirectSafe(candidateRedirect)) {
      redirectUrl = candidateRedirect;
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
    console.error("No authorization code received");
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
    return Response.redirect(
      `${redirectUrl}?workspace_error=token_exchange_failed`
    );
  }

  const { access_token, refresh_token, expires_in, scope } = tokenData;

  if (!refresh_token) {
    console.error("No refresh token received");
    return Response.redirect(
      `${redirectUrl}?workspace_error=no_refresh_token`
    );
  }

  // Get user email from Google
  const userInfoResponse = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  const userInfo = await userInfoResponse.json();
  const email = userInfo.email;

  if (!email) {
    console.error("Could not get user email from Google");
    return Response.redirect(`${redirectUrl}?workspace_error=no_email`);
  }

  const tokenExpiresAt = new Date(
    Date.now() + expires_in * 1000
  ).toISOString();
  const grantedScopes = scope ? scope.split(" ") : [];

  // Store connection in database
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error: upsertError } = await supabase
    .from("google_workspace_connections")
    .upsert(
      {
        tenant_id: tenantId,
        access_token,
        refresh_token,
        token_expires_at: tokenExpiresAt,
        google_email: email,
        scopes: grantedScopes,
        is_active: true,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );

  if (upsertError) {
    console.error("Failed to store workspace connection:", upsertError);
    return Response.redirect(
      `${redirectUrl}?workspace_error=storage_failed`
    );
  }

  console.log(
    "Google Workspace connected for tenant:",
    tenantId,
    "email:",
    email,
    "scopes:",
    grantedScopes.length
  );

  return Response.redirect(`${redirectUrl}?workspace_connected=true`);
}
