import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '@gitleague/database';
import { SessionService } from '../services/session.service.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

/**
 * Extract raw session token from cookie or Authorization header
 */
function extractSessionToken(req: Request): string | null {
  if (req.cookies && req.cookies[env.COOKIE_NAME]) {
    return req.cookies[env.COOKIE_NAME];
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Middleware that requires a valid active session.
 * Rejects unauthenticated requests with 401 Unauthorized.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken = extractSessionToken(req);

    if (!rawToken) {
      throw AppError.unauthorized('Authentication required. Please sign in with GitHub.');
    }

    const session = await SessionService.validateSession(rawToken);
    if (!session) {
      SessionService.clearAuthCookie(res);
      throw AppError.unauthorized('Session has expired or is invalid. Please sign in again.');
    }

    const user = await UserRepository.findById(session.userId);
    if (!user) {
      SessionService.clearAuthCookie(res);
      throw AppError.unauthorized('User account associated with this session no longer exists.');
    }

    req.user = UserRepository.toSafeUser(user);
    req.session = session;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware that optionally attaches user context if a valid session exists.
 * Does not reject unauthenticated requests.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken = extractSessionToken(req);

    if (!rawToken) {
      req.user = null;
      req.session = null;
      return next();
    }

    const session = await SessionService.validateSession(rawToken);
    if (!session) {
      req.user = null;
      req.session = null;
      return next();
    }

    const user = await UserRepository.findById(session.userId);
    if (!user) {
      req.user = null;
      req.session = null;
      return next();
    }

    req.user = UserRepository.toSafeUser(user);
    req.session = session;

    next();
  } catch {
    req.user = null;
    req.session = null;
    next();
  }
}
