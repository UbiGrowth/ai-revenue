// supabase/functions/_shared/password-auth.ts

/**
 * Simple password protection for public endpoints and preview surfaces.
 * Supports both HTTP Basic Auth and X-Password header patterns.
 * 
 * Usage:
 * 1. Set environment variable (e.g., PREVIEW_PASSWORD, ENDPOINT_PASSWORD)
 * 2. Call verifyPassword() at the start of your handler
 * 
 * Client can authenticate via:
 * - Authorization: Basic base64(username:password) - username is ignored
 * - X-Password: <password>
 * - ?password=<password> query param (not recommended for sensitive endpoints)
 */

export interface PasswordAuthOptions {
  req: Request;
  secretEnv: string;           // e.g. "PREVIEW_PASSWORD"
  allowQueryParam?: boolean;   // Allow ?password= (default: false)
  realm?: string;              // Basic auth realm (default: "Protected")
}

export interface PasswordAuthResult {
  authenticated: boolean;
  response?: Response;         // Pre-built 401 response if not authenticated
}

export async function verifyPassword(opts: PasswordAuthOptions): Promise<PasswordAuthResult> {
  const {
    req,
    secretEnv,
    allowQueryParam = false,
    realm = "Protected",
  } = opts;

  const expectedPassword = Deno.env.get(secretEnv);
  
  // If no password is configured, allow access (opt-in protection)
  if (!expectedPassword) {
    console.log(`[password-auth] No ${secretEnv} configured, allowing access`);
    return { authenticated: true };
  }

  let providedPassword: string | null = null;

  // 1. Check HTTP Basic Auth header
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Basic ")) {
    try {
      const base64Credentials = authHeader.slice(6);
      const credentials = atob(base64Credentials);
      // Format: username:password - we only care about password
      const colonIndex = credentials.indexOf(":");
      if (colonIndex !== -1) {
        providedPassword = credentials.slice(colonIndex + 1);
      }
    } catch (e) {
      console.error("[password-auth] Failed to decode Basic auth header");
    }
  }

  // 2. Check X-Password header
  if (!providedPassword) {
    providedPassword = req.headers.get("X-Password");
  }

  // 3. Check query param (only if explicitly allowed)
  if (!providedPassword && allowQueryParam) {
    const url = new URL(req.url);
    providedPassword = url.searchParams.get("password");
  }

  // Validate password
  if (!providedPassword) {
    console.log("[password-auth] No password provided");
    return {
      authenticated: false,
      response: new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": `Basic realm="${realm}"`,
          },
        }
      ),
    };
  }

  // Constant-time comparison
  if (!timingSafeEqual(providedPassword, expectedPassword)) {
    console.log("[password-auth] Invalid password");
    return {
      authenticated: false,
      response: new Response(
        JSON.stringify({ error: "Invalid password" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": `Basic realm="${realm}"`,
          },
        }
      ),
    };
  }

  console.log("[password-auth] Password verified successfully");
  return { authenticated: true };
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do the comparison to avoid timing leaks on length
    let dummy = 0;
    for (let i = 0; i < a.length; i++) {
      dummy |= a.charCodeAt(i) ^ a.charCodeAt(i);
    }
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Helper to add CORS headers to password-protected responses
 */
export function addCorsHeaders(response: Response, corsHeaders: Record<string, string>): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
