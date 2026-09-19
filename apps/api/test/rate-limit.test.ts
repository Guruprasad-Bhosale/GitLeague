import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { Request } from 'express';
import { resolveClientIp, authLimiter } from '../src/middleware/rate-limit.js';

describe('Distributed & Proxy-Aware Rate Limiting', () => {
  describe('resolveClientIp', () => {
    it('extracts primary client IP from X-Forwarded-For header with multiple proxy hops', () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
        },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      const ip = resolveClientIp(mockReq);
      expect(ip).toBe('203.0.113.195');
    });

    it('falls back to req.ip or socket.remoteAddress when header is absent', () => {
      const mockReq = {
        headers: {},
        ip: '198.51.100.1',
        socket: { remoteAddress: '198.51.100.1' },
      } as unknown as Request;

      const ip = resolveClientIp(mockReq);
      expect(ip).toBe('198.51.100.1');
    });
  });

  describe('Rate Limiter HTTP Middleware', () => {
    it('enforces 429 Too Many Requests when threshold exceeded', async () => {
      const testApp = express();
      testApp.set('trust proxy', 1);

      // Create a test route with a strict 2-request limiter for fast testing
      const strictLimiter = authLimiter;
      testApp.get('/test-auth-limit', strictLimiter, (_req, res) => {
        res.status(200).json({ success: true });
      });

      // Send requests with a simulated client IP
      const clientIp = '192.0.2.42';
      let lastStatus = 200;

      for (let i = 0; i < 25; i++) {
        const res = await request(testApp)
          .get('/test-auth-limit')
          .set('X-Forwarded-For', clientIp);
        lastStatus = res.status;
        if (lastStatus === 429) {
          expect(res.body.error).toBeDefined();
          expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
          break;
        }
      }

      expect(lastStatus).toBe(429);
    });
  });
});
