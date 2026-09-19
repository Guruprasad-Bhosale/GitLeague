import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Express } from 'express';

describe('Part 0: Production API Root & Service Discovery', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  it('GET / returns 200 with standard API response envelope and service metadata', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.service).toBe('GitLeague API');
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.version).toBe('v1');
  });

  it('GET / does not expose sensitive credentials, environment variables, or paths', async () => {
    const res = await request(app).get('/');

    const bodyString = JSON.stringify(res.body);
    expect(bodyString).not.toContain('mongodb://');
    expect(bodyString).not.toContain('redis://');
    expect(bodyString).not.toContain('secret');
    expect(bodyString).not.toContain('password');
    expect(bodyString).not.toContain('process.env');
    expect(bodyString).not.toContain('C:\\');
    expect(bodyString).not.toContain('/home/');
  });

  it('GET / does not require authentication headers or cookies', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });

  it('Unknown routes continue to return 404 ROUTE_NOT_FOUND', async () => {
    const res = await request(app).get('/does-not-exist-xyz');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(res.body.error.message).toContain('GET /does-not-exist-xyz');
  });

  it('GET / does not interfere with direct /health and /health/live probes', async () => {
    const resLive = await request(app).get('/health/live');
    expect(resLive.status).toBe(200);
    expect(resLive.body.success).toBe(true);
    expect(resLive.body.data.alive).toBe(true);
  });

  it('GET / does not interfere with /api/v1 versioned endpoints', async () => {
    const res = await request(app).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
