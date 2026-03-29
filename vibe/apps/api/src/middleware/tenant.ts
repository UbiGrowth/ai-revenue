import { Response, NextFunction } from 'express';
import { AuthRequest } from '../auth';

/** Decode a JWT payload without verifying the signature. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → base64 → Buffer → string
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = Buffer.from(padded, 'base64').toString('utf-8');
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Middleware: extract tenantId from JWT Bearer token.
 *
 * Resolution order:
 *   1. Authorization: Bearer <jwt>  → claims.tenant_id | claims.tenantId | claims.sub
 *   2. X-Tenant-Id header           (legacy / service-to-service)
 *
 * Returns 401 when no tenant context can be established.
 * Cross-tenant 403s are enforced per-resource via assertTenantOwnership().
 */
export function extractTenantFromJwt() {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = decodeJwtPayload(token);

      if (payload) {
        const tenantId =
          (payload.tenant_id as string | undefined) ||
          (payload.tenantId as string | undefined) ||
          (payload.sub as string | undefined);

        if (tenantId) {
          req.tenantId = String(tenantId);
          next();
          return;
        }
      }
    }

    // Fallback: explicit header (service-to-service or legacy clients)
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    if (headerTenantId) {
      req.tenantId = headerTenantId;
      next();
      return;
    }

    res.status(401).json({ error: 'Authentication required: no tenant context found' });
  };
}

/**
 * Assert that a resource's tenant matches the authenticated tenant.
 *
 * Returns false and sends 403 when the tenants differ; returns true on success.
 * Usage:
 *   if (!assertTenantOwnership(resource.tenant_id, req, res)) return;
 */
export function assertTenantOwnership(
  resourceTenantId: string | undefined,
  req: AuthRequest,
  res: Response,
): boolean {
  if (!resourceTenantId || resourceTenantId !== req.tenantId) {
    res.status(403).json({ error: 'Access denied: resource belongs to a different tenant' });
    return false;
  }
  return true;
}
