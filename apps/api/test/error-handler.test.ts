import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app.js';
import { AppError } from '../src/errors/app-error.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { requestIdMiddleware } from '../src/middleware/request-id.js';
import { z } from 'zod';

describe('API Error Handling & Request IDs', () => {
  const app = createApp();

  it('handles 404 Route Not Found with consistent error structure and request ID', async () => {
    const res = await request(app).get('/api/v1/nonexistent-endpoint');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(res.body.error.message).toContain('nonexistent-endpoint');
    expect(res.body.requestId).toBeDefined();
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it('preserves valid client-supplied x-request-id', async () => {
    const customId = 'client-req-998877';
    const res = await request(app)
      .get('/api/v1/health/live')
      .set('x-request-id', customId);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(customId);
  });

  it('handles operational AppError instances properly', async () => {
    const testApp = express();
    testApp.use(requestIdMiddleware);
    testApp.get('/test-bad-request', () => {
      throw AppError.badRequest('Invalid parameter supplied', { field: 'username' });
    });
    testApp.get('/test-unauthorized', () => {
      throw AppError.unauthorized('Token expired');
    });
    testApp.use(errorHandler);

    const resBadRequest = await request(testApp).get('/test-bad-request');
    expect(resBadRequest.status).toBe(400);
    expect(resBadRequest.body.success).toBe(false);
    expect(resBadRequest.body.error.code).toBe('BAD_REQUEST');
    expect(resBadRequest.body.error.message).toBe('Invalid parameter supplied');
    expect(resBadRequest.body.error.details).toEqual({ field: 'username' });

    const resUnauthorized = await request(testApp).get('/test-unauthorized');
    expect(resUnauthorized.status).toBe(401);
    expect(resUnauthorized.body.error.code).toBe('UNAUTHORIZED');
  });

  it('handles Zod validation errors with field details', async () => {
    const testSchema = z.object({
      username: z.string().min(3),
    });

    const testApp = express();
    testApp.use(express.json());
    testApp.use(requestIdMiddleware);
    testApp.post('/test-zod', (req, _res, next) => {
      try {
        testSchema.parse(req.body);
        _res.status(200).json({ success: true });
      } catch (err) {
        next(err);
      }
    });
    testApp.use(errorHandler);

    const res = await request(testApp).post('/test-zod').send({ username: 'ab' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeInstanceOf(Array);
    expect(res.body.error.details[0].field).toBe('username');
  });

  it('handles malformed JSON request bodies gracefully', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{ "invalidJson": broken }');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
