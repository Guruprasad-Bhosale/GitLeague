import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { OAuthService } from '../src/services/oauth.service.js';
import { SessionService } from '../src/services/session.service.js';
import { UserRepository, OAuthStateRepository, SessionRepository } from '@gitleague/database';
import { env } from '../src/config/env.js';

describe('Authentication & GitHub OAuth Endpoints', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/v1/auth/github', () => {
    it('redirects to GitHub authorization URL with secure state parameter', async () => {
      vi.spyOn(OAuthStateRepository, 'createState').mockResolvedValueOnce();

      const res = await request(app).get('/api/v1/auth/github');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBeDefined();
      expect(res.headers.location).toContain('https://github.com/login/oauth/authorize');
      expect(res.headers.location).toContain(`client_id=${env.GITHUB_CLIENT_ID}`);
      expect(res.headers.location).toContain('state=');
      expect(res.headers.location).toContain('scope=read%3Auser+user%3Aemail');
    });
  });

  describe('GET /api/v1/auth/github/callback', () => {
    it('rejects callback with missing or malformed query parameters (400)', async () => {
      const res = await request(app).get('/api/v1/auth/github/callback');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('rejects callback with invalid, expired, or replayed OAuth state (400)', async () => {
      vi.spyOn(OAuthStateRepository, 'consumeState').mockResolvedValueOnce(false);

      const res = await request(app).get('/api/v1/auth/github/callback?code=fake_code&state=fake_state');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('OAuth state');
    });

    it('successfully processes valid OAuth callback, sets HttpOnly session cookie, and redirects to frontend', async () => {
      const mockUserDoc = {
        _id: '507f1f77bcf86cd799439011',
        githubId: '99887766',
        username: 'devleader',
        displayName: 'Senior Dev',
        avatarUrl: 'https://avatars.githubusercontent.com/u/99887766',
        githubProfileUrl: 'https://github.com/devleader',
        email: 'dev@gitleague.com',
        bio: 'Building open source',
        location: 'Earth',
        company: 'GitLeague',
        lastLoginAt: new Date(),
        lastSyncedAt: null,
      };

      vi.spyOn(OAuthStateRepository, 'consumeState').mockResolvedValueOnce(true);
      vi.spyOn(OAuthService, 'exchangeCodeForToken').mockResolvedValueOnce('gho_mock_valid_token_xyz');
      vi.spyOn(OAuthService, 'fetchGitHubIdentity').mockResolvedValueOnce({
        id: 99887766,
        login: 'devleader',
        name: 'Senior Dev',
        avatar_url: 'https://avatars.githubusercontent.com/u/99887766',
        html_url: 'https://github.com/devleader',
        email: 'dev@gitleague.com',
        bio: 'Building open source',
        location: 'Earth',
        company: 'GitLeague',
      });
      vi.spyOn(UserRepository, 'upsertGitHubUser').mockResolvedValueOnce(mockUserDoc as any);
      vi.spyOn(SessionRepository, 'createSession').mockResolvedValueOnce({
        _id: 'sess_12345',
        sessionHash: 'hashed_token',
        userId: '507f1f77bcf86cd799439011',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(),
        createdAt: new Date(),
      } as any);

      const res = await request(app).get('/api/v1/auth/github/callback?code=valid_code_123&state=valid_state_456');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(env.WEB_ORIGIN);

      // Verify secure session cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes(`${env.COOKIE_NAME}=`) && c.includes('HttpOnly'))).toBe(true);
    });

    it('redirects to frontend with error query parameter when GitHub returns an OAuth error', async () => {
      const res = await request(app).get('/api/v1/auth/github/callback?error=access_denied&error_description=The+user+has+denied+access');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(env.WEB_ORIGIN);
      expect(res.headers.location).toContain('error=The%20user%20has%20denied%20access');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 Unauthorized when unauthenticated without cookie or auth header', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 Unauthorized when session is expired or non-existent in database', async () => {
      vi.spyOn(SessionRepository, 'findSessionByHash').mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', [`${env.COOKIE_NAME}=invalid_or_expired_token`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 200 OK and safe user profile when authenticated with valid session', async () => {
      const mockSession = {
        _id: 'sess_555',
        userId: '507f1f77bcf86cd799439011',
        sessionHash: 'hashed_secret',
        expiresAt: new Date(Date.now() + 100000),
        lastUsedAt: new Date(),
      };

      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        githubId: '1234567',
        username: 'champion_coder',
        displayName: 'Champion',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1234567',
        githubProfileUrl: 'https://github.com/champion_coder',
        email: 'champ@example.com',
        bio: 'Rank 1 aspirant',
        location: 'SF',
        company: 'OpenAI',
        encryptedAccessToken: 'v1:sensitive:encrypted:token',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        lastSyncedAt: null,
      };

      vi.spyOn(SessionRepository, 'findSessionByHash').mockResolvedValueOnce(mockSession as any);
      vi.spyOn(SessionRepository, 'touchSession').mockResolvedValueOnce();
      vi.spyOn(UserRepository, 'findById').mockResolvedValueOnce(mockUser as any);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', [`${env.COOKIE_NAME}=valid_random_session_token`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe('champion_coder');
      expect(res.body.data.githubId).toBe('1234567');
      expect(res.body.data.sessionExpiresAt).toBeDefined();

      // STRICT SECURITY CHECK: Sensitive tokens and hashes must NEVER be returned
      expect(res.body.data.encryptedAccessToken).toBeUndefined();
      expect(res.body.data.sessionHash).toBeUndefined();
      expect(res.body.data.token).toBeUndefined();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('invalidates active session in database, clears cookie, and returns 200 OK', async () => {
      vi.spyOn(SessionRepository, 'deleteSessionByHash').mockResolvedValueOnce(true);

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${env.COOKIE_NAME}=active_token_to_logout`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Logged out successfully');

      // Check cookie cleared
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes(`${env.COOKIE_NAME}=;`))).toBe(true);
    });

    it('is idempotent: returns 200 OK even if no cookie or invalid session', async () => {
      const res = await request(app).post('/api/v1/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
