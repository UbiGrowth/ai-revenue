// supabase/functions/_shared/workspace-password.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Workspace-level password protection for public forms (per-tenant gating).
 * Passwords are stored as bcrypt hashes using pgcrypto in workspaces.public_form_password_hash
 * 
 * To set a password (run via SQL):
 * ```sql
 * UPDATE public.workspaces
 * SET public_form_password_hash = crypt('MyPassword123', gen_salt('bf'))
 * WHERE id = '<workspace-uuid>';
 * ```
 * 
 * Usage in edge function:
 * ```typescript
 * import { verifyWorkspacePassword, extractPasswordFromRequest } from "../_shared/workspace-password.ts";
 * 
 * const password = extractPasswordFromRequest(req, body);
 * const result = await verifyWorkspacePassword(workspaceId, password);
 * if (!result.valid) {
 *   return new Response(JSON.stringify({ error: result.error }), { status: 401 });
 * }
 * ```
 */

export interface WorkspacePasswordResult {
  valid: boolean;
  error?: string;
  requiresPassword?: boolean;
}

/**
 * Verify workspace password using pgcrypto's crypt() function
 */
export async function verifyWorkspacePassword(
  workspaceId: string,
  providedPassword: string | null
): Promise<WorkspacePasswordResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    console.error('[workspace-password] Missing Supabase credentials');
    return { valid: false, error: 'Server configuration error' };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // First check if workspace exists and has a password
  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('public_form_password_hash')
    .eq('id', workspaceId)
    .single();

  if (error || !workspace) {
    console.error('[workspace-password] Workspace not found:', workspaceId);
    return { valid: false, error: 'Workspace not found' };
  }

  const storedHash = workspace.public_form_password_hash;

  // No password set = no protection required
  if (!storedHash) {
    console.log('[workspace-password] No password configured for workspace');
    return { valid: true, requiresPassword: false };
  }

  // Password required but not provided
  if (!providedPassword) {
    console.log('[workspace-password] Password required but not provided');
    return { valid: false, error: 'Password required', requiresPassword: true };
  }

  // Verify password using pgcrypto's crypt() function via RPC
  // crypt(password, hash) = hash if password matches
  const { data: verifyResult, error: verifyError } = await supabase.rpc(
    'verify_workspace_password',
    { 
      workspace_uuid: workspaceId, 
      password_input: providedPassword 
    }
  );

  if (verifyError) {
    console.error('[workspace-password] Verification error:', verifyError);
    return { valid: false, error: 'Verification failed' };
  }

  if (verifyResult === true) {
    console.log('[workspace-password] Password verified successfully');
    return { valid: true, requiresPassword: true };
  }

  console.log('[workspace-password] Invalid password');
  return { valid: false, error: 'Invalid password', requiresPassword: true };
}

/**
 * Extract password from request (header or body)
 */
export function extractPasswordFromRequest(req: Request, body?: Record<string, unknown>): string | null {
  // Check X-Form-Password header
  const headerPassword = req.headers.get('X-Form-Password');
  if (headerPassword) return headerPassword;

  // Check body.formPassword
  if (body && typeof body.formPassword === 'string') {
    return body.formPassword;
  }

  return null;
}
