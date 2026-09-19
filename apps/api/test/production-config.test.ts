import { describe, it, expect } from 'vitest';
import { parseCorsOrigins, envSchema } from '../src/config/env.js';

describe('Production Configuration & Environment Validation', () => {
  describe('parseCorsOrigins', () => {
    it('parses comma-separated list of origins correctly in production', () => {
      const parsed = parseCorsOrigins('https://gitleague.dev, https://app.gitleague.dev, https://admin.gitleague.dev', 'production');
      expect(parsed).toEqual([
        'https://gitleague.dev',
        'https://app.gitleague.dev',
        'https://admin.gitleague.dev',
      ]);
    });

    it('rejects wildcard origin (*) when credentials are used', () => {
      expect(() => parseCorsOrigins('*', 'production')).toThrow(
        /Wildcard CORS origin '\*' is strictly forbidden/
      );
    });

    it('rejects localhost origins when in production mode', () => {
      expect(() => parseCorsOrigins('http://localhost:3000', 'production')).toThrow(
        /Localhost origin is forbidden in production/
      );
      expect(() => parseCorsOrigins('https://gitleague.dev, http://127.0.0.1:5173', 'production')).toThrow(
        /Localhost origin is forbidden in production/
      );
    });

    it('allows localhost in development and test environments', () => {
      const devOrigins = parseCorsOrigins('http://localhost:3000, http://127.0.0.1:5173', 'development');
      expect(devOrigins).toEqual(['http://localhost:3000', 'http://127.0.0.1:5173']);

      const testOrigins = parseCorsOrigins('http://localhost:3000', 'test');
      expect(testOrigins).toEqual(['http://localhost:3000']);
    });
  });

  describe('envSchema Validation Rules', () => {
    const validBase = {
      NODE_ENV: 'test',
      PORT: '4000',
      HOST: '0.0.0.0',
      MONGODB_URI: 'mongodb://localhost:27017/gitleague',
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: '6379',
      ENCRYPTION_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      SESSION_SECRET: 'session-secret-must-be-at-least-32-chars-long!',
      GITHUB_CLIENT_ID: 'gh_client_id_test',
      GITHUB_CLIENT_SECRET: 'gh_client_secret_test',
      FRONTEND_URL: 'http://localhost:3000',
      API_URL: 'http://localhost:4000',
      TRUST_PROXY: '1',
    };

    it('successfully validates complete valid environment configuration', () => {
      const parsed = envSchema.safeParse(validBase);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.PORT).toBe(4000);
        expect(parsed.data.REDIS_PORT).toBe(6379);
        expect(parsed.data.TRUST_PROXY).toBe(1);
      }
    });

    it('rejects non-64-character hex ENCRYPTION_SECRET', () => {
      const invalid = { ...validBase, ENCRYPTION_SECRET: 'short-secret' };
      const parsed = envSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('rejects short SESSION_SECRET (< 32 characters)', () => {
      const invalid = { ...validBase, SESSION_SECRET: 'short-session-secret' };
      const parsed = envSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('properly converts TRUST_PROXY boolean, number, and string values', () => {
      const boolTrue = envSchema.safeParse({ ...validBase, TRUST_PROXY: 'true' });
      expect(boolTrue.success).toBe(true);
      if (boolTrue.success) expect(boolTrue.data.TRUST_PROXY).toBe(true);

      const boolFalse = envSchema.safeParse({ ...validBase, TRUST_PROXY: 'false' });
      expect(boolFalse.success).toBe(true);
      if (boolFalse.success) expect(boolFalse.data.TRUST_PROXY).toBe(false);

      const numHop = envSchema.safeParse({ ...validBase, TRUST_PROXY: '2' });
      expect(numHop.success).toBe(true);
      if (numHop.success) expect(numHop.data.TRUST_PROXY).toBe(2);
    });
  });
});
