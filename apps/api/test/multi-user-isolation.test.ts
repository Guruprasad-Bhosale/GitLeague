import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { UserRepository, SessionRepository } from '@gitleague/database';
import { hashSessionToken } from '../src/lib/crypto.js';
import { env } from '../src/config/env.js';

describe('Multi-User Security & Session Isolation', () => {
  const app = createApp();

  const userA = {
    _id: 'user_id_aaaa_1111',
    githubId: '10001',
    username: 'alice_hacker',
    displayName: 'Alice Dev',
    avatarUrl: 'https://avatars.githubusercontent.com/u/10001',
    githubProfileUrl: 'https://github.com/alice_hacker',
    email: 'alice@example.com',
    bio: 'Rust & TypeScript fanatic',
    location: 'Berlin',
    company: 'Alpha Corp',
    encryptedAccessToken: 'v1:enc:alice:token',
    createdAt: new Date(),
    lastLoginAt: new Date(),
    lastSyncedAt: null,
  };

  const userB = {
    _id: 'user_id_bbbb_2222',
    githubId: '20002',
    username: 'bob_builder',
    displayName: 'Bob The Builder',
    avatarUrl: 'https://avatars.githubusercontent.com/u/20002',
    githubProfileUrl: 'https://github.com/bob_builder',
    email: 'bob@example.com',
    bio: 'Kubernetes and Go wizard',
    location: 'Tokyo',
    company: 'Beta Inc',
    encryptedAccessToken: 'v1:enc:bob:token',
    createdAt: new Date(),
    lastLoginAt: new Date(),
    lastSyncedAt: null,
  };

  const rawTokenA = 'raw_session_token_alice_secret_11111111111111111111111111111111';
  const rawTokenB = 'raw_session_token_bob_secret_2222222222222222222222222222222222';

  const hashA = hashSessionToken(rawTokenA);
  const hashB = hashSessionToken(rawTokenB);

  const sessionA = {
    _id: 'sess_aaaa',
    sessionHash: hashA,
    userId: userA._id,
    expiresAt: new Date(Date.now() + 86400000),
    lastUsedAt: new Date(),
  };

  const sessionB = {
    _id: 'sess_bbbb',
    sessionHash: hashB,
    userId: userB._id,
    expiresAt: new Date(Date.now() + 86400000),
    lastUsedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('guarantees User A session strictly resolves User A and User B session strictly resolves User B', async () => {
    vi.spyOn(SessionRepository, 'findSessionByHash').mockImplementation(async (hash) => {
      if (hash === hashA) return sessionA as any;
      if (hash === hashB) return sessionB as any;
      return null;
    });

    vi.spyOn(SessionRepository, 'touchSession').mockResolvedValue();

    vi.spyOn(UserRepository, 'findById').mockImplementation(async (id) => {
      if (id === userA._id) return userA as any;
      if (id === userB._id) return userB as any;
      return null;
    });

    // Request 1: User A
    const resA = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [`${env.COOKIE_NAME}=${rawTokenA}`]);

    expect(resA.status).toBe(200);
    expect(resA.body.data.username).toBe('alice_hacker');
    expect(resA.body.data.id).toBe(userA._id);
    expect(resA.body.data.email).toBe('alice@example.com');

    // Request 2: User B
    const resB = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [`${env.COOKIE_NAME}=${rawTokenB}`]);

    expect(resB.status).toBe(200);
    expect(resB.body.data.username).toBe('bob_builder');
    expect(resB.body.data.id).toBe(userB._id);
    expect(resB.body.data.email).toBe('bob@example.com');

    // Cross-check: No data leak across users
    expect(resA.body.data.username).not.toBe(resB.body.data.username);
  });

  it('invalidating Session A logs out User A without affecting User B active session', async () => {
    let sessionAActive = true;

    vi.spyOn(SessionRepository, 'findSessionByHash').mockImplementation(async (hash) => {
      if (hash === hashA && sessionAActive) return sessionA as any;
      if (hash === hashB) return sessionB as any;
      return null;
    });

    vi.spyOn(SessionRepository, 'touchSession').mockResolvedValue();

    vi.spyOn(SessionRepository, 'deleteSessionByHash').mockImplementation(async (hash) => {
      if (hash === hashA) {
        sessionAActive = false;
        return true;
      }
      return false;
    });

    vi.spyOn(UserRepository, 'findById').mockImplementation(async (id) => {
      if (id === userA._id) return userA as any;
      if (id === userB._id) return userB as any;
      return null;
    });

    // User A logs out
    const logoutResA = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${env.COOKIE_NAME}=${rawTokenA}`]);

    expect(logoutResA.status).toBe(200);

    // User A tries to access /me -> 401
    const resAAfterLogout = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [`${env.COOKIE_NAME}=${rawTokenA}`]);

    expect(resAAfterLogout.status).toBe(401);

    // User B still has valid session -> 200
    const resBActive = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [`${env.COOKIE_NAME}=${rawTokenB}`]);

    expect(resBActive.status).toBe(200);
    expect(resBActive.body.data.username).toBe('bob_builder');
  });
});
