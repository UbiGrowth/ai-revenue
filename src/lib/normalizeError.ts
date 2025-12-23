/**
 * Normalize any error into a string for safe rendering in JSX.
 * 
 * This prevents React error #31 (Objects are not valid as a React child)
 * when API responses return error objects with keys like:
 * { statusCode, message, error, subscriptionLimits }
 */
export function normalizeError(e: unknown): string {
  // Already a string - return as-is
  if (typeof e === 'string') return e;
  
  // Standard Error object
  if (e instanceof Error) return e.message;

  // Supabase / fetch / API JSON error objects
  if (e && typeof e === 'object') {
    const anyE = e as Record<string, unknown>;
    
    // Try common error message fields in priority order
    if (typeof anyE.message === 'string' && anyE.message) return anyE.message;
    if (typeof anyE.error === 'string' && anyE.error) return anyE.error;
    if (typeof anyE.error_description === 'string') return anyE.error_description;
    if (typeof anyE.statusText === 'string') return anyE.statusText;
    
    // Nested error object (Supabase pattern)
    if (anyE.error && typeof anyE.error === 'object') {
      const nestedError = anyE.error as Record<string, unknown>;
      if (typeof nestedError.message === 'string') return nestedError.message;
    }
    
    // Last resort: stringify the object
    try {
      return JSON.stringify(e);
    } catch {
      return 'Unknown error';
    }
  }
  
  // Null, undefined, or other primitives
  return 'Unknown error';
}
