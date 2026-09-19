import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Request ID Middleware', () => {
  const app = createApp();

  it('generates a secure request ID if none provided by client', async () => {
    const res = await request(app).get('/api/v1/health/live');

    expect(res.status).toBe(200);
    const reqId = res.headers['x-request-id'];
    expect(reqId).toBeDefined();
    expect(reqId).toMatch(/^req_[a-f0-9]{32}$/);
  });

  it('accepts and preserves valid client-supplied x-request-id', async () => {
    const customId = 'trace-id-abc-123_456';
    const res = await request(app)
      .get('/api/v1/health/live')
      .set('x-request-id', customId);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(customId);
  });

  it('replaces malformed client-supplied x-request-id with valid secure format', async () => {
    const invalidId = '<script>bad-id</script>';
    const res = await request(app)
      .get('/api/v1/health/live')
      .set('x-request-id', invalidId);

    expect(res.status).toBe(200);
    const reqId = res.headers['x-request-id'];
    expect(reqId).toBeDefined();
    expect(reqId).not.toBe(invalidId);
    expect(reqId).toMatch(/^req_[a-f0-9]{32}$/);
  });

  it('includes request ID in 404 error responses', async () => {
    const res = await request(app).get('/api/v1/unknown-path-for-request-id-check');

    expect(res.status).toBe(404);
    expect(res.body.requestId).toBeDefined();
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });
});
