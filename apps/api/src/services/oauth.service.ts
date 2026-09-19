import { OAuthStateRepository, UserRepository, IUserDocument } from '@gitleague/database';
import { generateOAuthState, encryptToken } from '../lib/crypto.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { logger } from '../lib/logger.js';

export interface IGitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

export interface IGitHubUserProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  email: string | null;
  bio: string | null;
  location: string | null;
  company: string | null;
}

export interface IGitHubUserEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

export class OAuthService {
  /**
   * Generate GitHub OAuth Authorization URL with CSRF protection state
   */
  static async getAuthorizationUrl(): Promise<{ authorizationUrl: string; state: string }> {
    const state = generateOAuthState();

    // Store state in database with TTL (10 minutes)
    await OAuthStateRepository.createState(state, 600);

    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: env.GITHUB_CALLBACK_URL,
      scope: 'read:user user:email',
      state,
      allow_signup: 'true',
    });

    const authorizationUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

    return { authorizationUrl, state };
  }

  /**
   * Exchange authorization code for GitHub OAuth access token
   */
  static async exchangeCodeForToken(code: string): Promise<string> {
    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'GitLeague-Platform',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: env.GITHUB_CALLBACK_URL,
        }),
      });

      if (!response.ok) {
        throw AppError.unauthorized('Failed to communicate with GitHub OAuth token endpoint');
      }

      const data = (await response.json()) as IGitHubTokenResponse;

      if (data.error || !data.access_token) {
        logger.warn({ error: data.error }, 'GitHub OAuth token exchange rejected');
        throw AppError.badRequest(data.error_description || data.error || 'Invalid authorization code');
      }

      return data.access_token;
    } catch (err: unknown) {
      if (err instanceof AppError) {
        throw err;
      }
      logger.error('Unexpected error during GitHub token exchange');
      throw AppError.unauthorized('OAuth token exchange failed');
    }
  }

  /**
   * Retrieve authenticated GitHub user identity and verified primary email
   */
  static async fetchGitHubIdentity(accessToken: string): Promise<IGitHubUserProfile> {
    try {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GitLeague-Platform',
      };

      const userRes = await fetch('https://api.github.com/user', { headers });

      if (!userRes.ok) {
        throw AppError.unauthorized('Failed to retrieve GitHub user profile');
      }

      const userData = (await userRes.json()) as IGitHubUserProfile;

      // If email is not public, fetch primary verified email from /user/emails
      let primaryEmail = userData.email;
      if (!primaryEmail) {
        try {
          const emailsRes = await fetch('https://api.github.com/user/emails', { headers });
          if (emailsRes.ok) {
            const emails = (await emailsRes.json()) as IGitHubUserEmail[];
            const primary = emails.find((e) => e.primary && e.verified);
            if (primary) {
              primaryEmail = primary.email;
            }
          }
        } catch {
          // Non-critical, ignore email lookup failure
        }
      }

      return {
        ...userData,
        email: primaryEmail ?? null,
      };
    } catch (err: unknown) {
      if (err instanceof AppError) {
        throw err;
      }
      logger.error('Failed to fetch GitHub identity');
      throw AppError.unauthorized('Failed to verify GitHub identity');
    }
  }

  /**
   * Full OAuth Callback Processing:
   * 1. Validate and consume OAuth state
   * 2. Exchange code for access token
   * 3. Fetch GitHub identity
   * 4. Encrypt access token at rest
   * 5. Upsert User in database
   */
  static async processOAuthCallback(code: string, state: string): Promise<IUserDocument> {
    // 1. Consume state atomically (prevents replay/CSRF)
    const isStateValid = await OAuthStateRepository.consumeState(state);
    if (!isStateValid) {
      throw AppError.badRequest('Invalid, expired, or previously used OAuth state parameter');
    }

    // 2. Exchange code for token
    const accessToken = await this.exchangeCodeForToken(code);

    // 3. Fetch GitHub Identity
    const profile = await this.fetchGitHubIdentity(accessToken);

    // 4. Encrypt access token at rest
    const encryptedAccessToken = encryptToken(accessToken);

    // 5. Upsert user document
    const user = await UserRepository.upsertGitHubUser({
      githubId: String(profile.id),
      username: profile.login,
      displayName: profile.name,
      avatarUrl: profile.avatar_url,
      githubProfileUrl: profile.html_url,
      email: profile.email,
      bio: profile.bio,
      location: profile.location,
      company: profile.company,
      encryptedAccessToken,
    });

    return user;
  }
}
