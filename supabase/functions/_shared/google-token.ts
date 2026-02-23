import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Get a valid Google access token for a tenant, refreshing if needed.
 * Shared across gmail-sync, calendar-sync, drive-sync.
 */
export async function getValidAccessToken(
  tenantId: string,
  serviceRoleKey: string,
  supabaseUrl: string
): Promise<string | null> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: connection, error } = await supabase
    .from("google_workspace_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  if (error || !connection) {
    console.error("No active Google connection for tenant:", tenantId);
    return null;
  }

  // Check if token is still valid (with 5 minute buffer)
  const expiresAt = new Date(connection.token_expires_at);
  if (!isNaN(expiresAt.getTime()) && expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return connection.access_token;
  }

  // Refresh the token
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET env vars");
    return null;
  }

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
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
  } catch (fetchErr) {
    console.error("Token refresh network error:", fetchErr);
    return null;
  }

  if (!tokenResponse.ok) {
    console.error("Token refresh failed with status:", tokenResponse.status);
    return null;
  }

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    console.error("Token refresh response missing access_token");
    return null;
  }

  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("google_workspace_connections")
    .update({
      access_token: tokenData.access_token,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  if (updateError) {
    console.error("Failed to persist refreshed token:", updateError.message);
    // Still return the token since we got it, but warn
  }

  return tokenData.access_token;
}

/**
 * Verify user belongs to the tenant.
 */
export async function verifyTenantMembership(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("user_id", userId)
    .eq("workspace_id", tenantId)
    .limit(1)
    .single();
  return !!data;
}

/**
 * Get a required environment variable or throw.
 */
export function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Safe date parsing that returns null instead of throwing on invalid dates.
 */
export function safeDateToISO(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

/**
 * Decode base64url (Gmail format) to UTF-8 string.
 */
export function decodeBase64Utf8(b64: string): string {
  const standardB64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  const binaryStr = atob(standardB64);
  const bytes = Uint8Array.from(binaryStr, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
