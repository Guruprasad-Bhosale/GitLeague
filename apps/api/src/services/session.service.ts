import { type Request, type Response } from 'express';
import { SessionRepository, ISessionDocument } from '@gitleague/database';
import { generateSecureToken, hashSessionToken } from '../lib/crypto.js';
import { env } from '../config/env.js';

export interface ISessionCreationResult {
  rawToken: string;
  session: ISessionDocument;
  expiresAt: Date;
}

export class SessionService {
  /**
   * Create a new server-side session for an authenticated user
   */
  static async createSessionForUser(userId: string, req?: Request): Promise<ISessionCreationResult> {
    const rawToken = generateSecureToken(32);
    const sessionHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const userAgent = req?.headers['user-agent'] ?? null;
    const ipAddress = req?.ip ?? null;

    const session = await SessionRepository.createSession({
      sessionHash,
      userId,
      expiresAt,
      userAgent,
      ipAddress,
    });

    return { rawToken, session, expiresAt };
  }

  /**
   * Validate a raw session token received from the client cookie
   */
  static async validateSession(rawToken: string): Promise<ISessionDocument | null> {
    if (!rawToken || typeof rawToken !== 'string') {
      return null;
    }

    const sessionHash = hashSessionToken(rawToken);
    const session = await SessionRepository.findSessionByHash(sessionHash);

    if (!session) {
      return null;
    }

    // Touch session async to update activity timestamp without blocking
    SessionRepository.touchSession(sessionHash).catch(() => {});

    return session;
  }

  /**
   * Invalidate and delete a session by raw token
   */
  static async invalidateSession(rawToken: string): Promise<boolean> {
    if (!rawToken || typeof rawToken !== 'string') {
      return false;
    }
    const sessionHash = hashSessionToken(rawToken);
    return SessionRepository.deleteSessionByHash(sessionHash);
  }

  /**
   * Set secure authentication cookie on response
   */
  static setAuthCookie(res: Response, rawToken: string, expiresAt: Date): void {
    res.cookie(env.COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAME_SITE,
      domain: env.COOKIE_DOMAIN || undefined,
      path: '/',
      expires: expiresAt,
    });
  }

  /**
   * Clear authentication cookie on response
   */
  static clearAuthCookie(res: Response): void {
    res.clearCookie(env.COOKIE_NAME, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAME_SITE,
      domain: env.COOKIE_DOMAIN || undefined,
      path: '/',
    });
  }
}
