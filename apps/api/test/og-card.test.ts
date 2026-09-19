import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { UserProfileRepository } from '@gitleague/database';
import type { Express } from 'express';

describe('Open Graph Profile Card API', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 404 if developer profile does not exist', async () => {
    vi.spyOn(UserProfileRepository, 'getPublicProfileByUsername').mockResolvedValueOnce(null);

    const res = await request(app).get('/api/v1/og/profile/nonexistent-user');
    expect(res.status).toBe(404);
  });

  it('returns valid SVG with safe XML entity escaping for special characters', async () => {
    vi.spyOn(UserProfileRepository, 'getPublicProfileByUsername').mockResolvedValueOnce({
      userId: 'user-1',
      username: 'hacker-dev',
      displayName: 'Hacker <script>alert(1)</script> & Developer <tag>',
      avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
      githubProfileUrl: 'https://github.com/hacker-dev',
      bio: 'test bio',
      location: 'India',
      company: 'GitLeague',
      college: null,
      friendsCount: 5,
      friendshipStatus: 'none',
      level: 42,
      xp: 12500,
      tier: 'DIAMOND',
      tierTitle: 'Diamond III',
      tierProgress: {} as any,
      levelProgress: {} as any,
      globalRank: 15,
      countryRank: 3,
      percentile: 98.5,
      currentStreak: 14,
      longestStreak: 30,
      commits: 1200,
      pullRequests: 45,
      mergedPullRequests: 40,
      issues: 10,
      repositories: 25,
      stars: 350,
      followers: 120,
      languages: {},
      stats: { coding: 85, consistency: 90, builder: 80, openSource: 75 },
      achievements: [],
      lastSyncedAt: new Date(),
    });

    const res = await request(app).get('/api/v1/og/profile/hacker-dev');

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('image/svg+xml');
    const svgText = res.text || (res.body ? res.body.toString('utf-8') : '');
    expect(svgText).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(svgText).toContain('Hacker &lt;script&gt;alert(1)&lt;/script&gt; &amp; Developer &lt;tag&gt;');
    expect(svgText).toContain('Diamond III');
    expect(svgText).toContain('LEVEL 42');
    expect(svgText).toContain('12,500 XP');
    expect(svgText).toContain('#15');
    expect(svgText).toContain('#3');
  });



});
