import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Security Headers & Payload Limits', () => {
  const app = createApp();

  it('sets production security headers on HTTP responses', async () => {
    const res = await request(app).get('/api/v1/health/live');

    expect(res.status).toBe(200);

    // Frameguard / Clickjacking Protection
    expect(res.headers['x-frame-options']).toBe('DENY');

    // MIME Sniffing Protection
    expect(res.headers['x-content-type-options']).toBe('nosniff');

    // Content Security Policy
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");

    // Cross-Origin / Referrer Policies
    expect(res.headers['referrer-policy']).toBeDefined();
  });

  it('rejects request bodies exceeding 100kb limit with 413 Payload Too Large', async () => {
    // Construct payload larger than 100kb
    const largeString = 'a'.repeat(1024 * 110); // 110 KB
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: largeString }));

    expect(res.status).toBe(413);
  });
});
