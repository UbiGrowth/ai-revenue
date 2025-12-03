// supabase/functions/_shared/svix-verify.ts

/**
 * Svix webhook signature verification for Resend webhooks.
 * Resend uses Svix for webhook delivery and signing.
 * 
 * Usage:
 * ```typescript
 * import { verifySvixSignature } from "../_shared/svix-verify.ts";
 * 
 * const isValid = await verifySvixSignature({
 *   req,
 *   rawBody,
 *   secretEnv: "RESEND_WEBHOOK_SECRET",
 * });
 * 
 * if (!isValid) {
 *   return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
 * }
 * ```
 */

export interface SvixVerifyOptions {
  req: Request;
  rawBody: string;
  secretEnv: string;           // e.g. "RESEND_WEBHOOK_SECRET"
  toleranceSeconds?: number;   // Default: 300 (5 minutes)
}

/**
 * Verify Svix webhook signature
 * Svix signatures use HMAC-SHA256 with base64 encoding
 */
export async function verifySvixSignature(opts: SvixVerifyOptions): Promise<boolean> {
  const {
    req,
    rawBody,
    secretEnv,
    toleranceSeconds = 300,
  } = opts;

  const secret = Deno.env.get(secretEnv);
  
  // If no secret configured, allow (opt-in security)
  if (!secret) {
    console.log(`[svix-verify] No ${secretEnv} configured, skipping verification`);
    return true;
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("[svix-verify] Missing Svix headers");
    return false;
  }

  // Verify timestamp is within tolerance
  const timestampSeconds = parseInt(svixTimestamp, 10);
  if (isNaN(timestampSeconds)) {
    console.error("[svix-verify] Invalid timestamp format");
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampSeconds) > toleranceSeconds) {
    console.error("[svix-verify] Timestamp outside tolerance window");
    return false;
  }

  // Svix secret format: whsec_<base64>
  // We need to extract the base64 part and decode it
  let secretBytes: Uint8Array;
  if (secret.startsWith("whsec_")) {
    const base64Secret = secret.slice(6);
    try {
      secretBytes = base64ToUint8Array(base64Secret);
    } catch (e) {
      console.error("[svix-verify] Failed to decode secret:", e);
      return false;
    }
  } else {
    // Assume raw secret
    secretBytes = new TextEncoder().encode(secret);
  }

  // Build signed content: "{svix-id}.{svix-timestamp}.{body}"
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;

  // Compute expected signature
  const keyBuffer = new ArrayBuffer(secretBytes.length);
  new Uint8Array(keyBuffer).set(secretBytes);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent)
  );

  const expectedSignature = "v1," + uint8ArrayToBase64(new Uint8Array(signatureBytes));

  // Svix sends multiple signatures separated by space (for key rotation)
  const providedSignatures = svixSignature.split(" ");

  for (const sig of providedSignatures) {
    if (timingSafeEqual(sig.trim(), expectedSignature)) {
      console.log("[svix-verify] Signature verified successfully");
      return true;
    }
  }

  console.error("[svix-verify] No matching signature found");
  return false;
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    let dummy = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      dummy |= (a.charCodeAt(i % a.length) || 0) ^ (a.charCodeAt(i % a.length) || 0);
    }
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
