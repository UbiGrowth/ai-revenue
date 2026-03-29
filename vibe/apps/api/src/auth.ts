import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const computed = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === computed;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  tenantId?: string;
}

export function optionalAuth(
  lookupToken: (token: string) => { user_id: string; email: string; expires_at: number } | undefined
) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const session = lookupToken(token);
      if (session && session.expires_at > Date.now()) {
        req.userId = session.user_id;
        req.userEmail = session.email;
      }
    }
    next();
  };
}

export function requireAuth(
  lookupToken: (token: string) => { user_id: string; email: string; expires_at: number } | undefined
) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.slice(7);
    const session = lookupToken(token);
    if (!session || session.expires_at <= Date.now()) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.userId = session.user_id;
    req.userEmail = session.email;
    next();
  };
}

export function requireTenantHeader() {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing required header: X-Tenant-Id' });
    }
    req.tenantId = tenantId;
    next();
  };
}
