import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase admin client using the service role key.
 * The service key must never be logged or returned in API responses.
 */
export function createSupabaseAdminClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Returns a Supabase admin client from environment variables, or null if not configured.
 */
export function getDefaultSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) return null;
  return createSupabaseAdminClient(url, serviceKey);
}
