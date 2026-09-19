import { Request, Response, NextFunction } from 'express';
import { OAuthCallbackQuerySchema, OAuthErrorQuerySchema } from '@gitleague/validation';
import { OAuthService } from '../services/oauth.service.js';
import { SessionService } from '../services/session.service.js';
import { QueueService } from '../services/queue.service.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { logger } from '../lib/logger.js';

export class AuthController {
  /**
   * GET /api/v1/auth/github
   * Initiate GitHub OAuth Authorization flow
   */
  static async initiateGitHubLogin(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { authorizationUrl } = await OAuthService.getAuthorizationUrl();
      logger.info('OAuth login flow initiated, redirecting to GitHub');
      res.redirect(authorizationUrl);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/github/callback
   * Process GitHub OAuth callback with CSRF state validation, user upsert, and session creation
   */
  static async handleGitHubCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check for OAuth error redirected from GitHub
      const errorValidation = OAuthErrorQuerySchema.safeParse(req.query);
      if (errorValidation.success) {
        const errorDesc = errorValidation.data.error_description || errorValidation.data.error;
        logger.warn({ error: errorValidation.data.error }, 'GitHub OAuth callback returned error');
        return res.redirect(`${env.WEB_ORIGIN}?error=${encodeURIComponent(errorDesc)}`);
      }

      // Validate code & state query parameters
      const validation = OAuthCallbackQuerySchema.safeParse(req.query);
      if (!validation.success) {
        throw AppError.badRequest('Invalid OAuth callback parameters', validation.error.format());
      }

      const { code, state } = validation.data;

      // Exchange code, fetch GitHub identity, encrypt token, upsert user
      const user = await OAuthService.processOAuthCallback(code, state);

      // Create new server-side session
      const { rawToken, expiresAt } = await SessionService.createSessionForUser(user._id.toString(), req);

      // Set secure HttpOnly cookie
      SessionService.setAuthCookie(res, rawToken, expiresAt);

      logger.info({ userId: user._id.toString(), username: user.username }, 'OAuth login successful, session created');

      // Trigger initial background sync
      QueueService.enqueueUserSync(user._id.toString()).catch((syncErr) => {
        logger.warn({ err: syncErr, userId: user._id.toString() }, 'Failed to enqueue post-login sync job');
      });

      // Redirect to frontend application
      res.redirect(env.WEB_ORIGIN);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Return authenticated safe user and session status
   */
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Not authenticated');
      }

      res.status(200).json({
        success: true,
        data: {
          ...req.user,
          sessionExpiresAt: req.session?.expiresAt ?? null,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/logout
   * Invalidate active session and clear cookie (Idempotent)
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawToken =
        req.cookies?.[env.COOKIE_NAME] ||
        (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7).trim() : null);

      if (rawToken) {
        await SessionService.invalidateSession(rawToken);
      }

      SessionService.clearAuthCookie(res);

      logger.info('User logged out successfully');

      res.status(200).json({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
