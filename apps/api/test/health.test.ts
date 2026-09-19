import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('API Health & Probes', () => {
  const app = createApp();

  it('GET /api/v1/health returns health status payload and x-request-id', async () => {
    const res = await request(app).get('/api/v1/health');

    // In disconnected DB state (unit test environment without running Mongo), health is 503 or 200 with degraded status
    expect([200, 503]).toContain(res.status);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.service).toBe('gitleague-api');
    expect(res.body.data.version).toBeDefined();
    expect(res.body.data.checks).toBeDefined();
    expect(res.body.data.checks.api).toBe('ok');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /api/v1/health/live returns 200 and alive status', async () => {
    const res = await request(app).get('/api/v1/health/live');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alive).toBe(true);
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /api/v1/health/ready responds with readiness status', async () => {
    const res = await request(app).get('/api/v1/health/ready');

    expect([200, 503]).toContain(res.status);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.ready !== undefined).toBe(true);
  });
});
