import dotenv from 'dotenv';
import { z, type ZodIssue } from 'zod';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1024).max(65535).default(4000),
    HOST: z.string().default('0.0.0.0'),
    TRUST_PROXY: z
      .preprocess((val) => {
        if (typeof val === 'string') {
          if (val.toLowerCase() === 'true') return true;
          if (val.toLowerCase() === 'false') return false;
          const num = Number(val);
          if (!isNaN(num) && val.trim() !== '') return num;
        }
        return val;
      }, z.union([z.boolean(), z.number(), z.string()]))
      .default(isProduction ? true : false),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required').default('mongodb://localhost:27017/gitleague'),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().int().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    WEB_ORIGIN: z.string().default('http://localhost:5173'),
    FRONTEND_URL: z.string().optional(),
    API_URL: z.string().optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().default(120),

    // GitHub OAuth Configuration
    GITHUB_CLIENT_ID: z.string().default(isProduction ? '' : 'dev_github_client_id'),
    GITHUB_CLIENT_SECRET: z.string().default(isProduction ? '' : 'dev_github_client_secret'),
    GITHUB_CALLBACK_URL: z.string().default('http://localhost:4000/api/v1/auth/github/callback'),

    // Security & Encryption (AES-256 requires minimum 32 chars)
    TOKEN_ENCRYPTION_SECRET: z
      .string()
      .min(32, 'TOKEN_ENCRYPTION_SECRET must be at least 32 characters')
      .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
    ENCRYPTION_SECRET: z
      .string()
      .min(32)
      .optional(),
    SESSION_SECRET: z
      .string()
      .min(32, 'SESSION_SECRET must be at least 32 characters')
      .default('gitleague-session-secret-key-must-be-32-chars-long!'),

    // Session & Cookie Configuration
    COOKIE_NAME: z.string().default('gitleague_session'),
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SECURE: z
      .string()
      .transform((val) => val === 'true')
      .default(isProduction ? 'true' : 'false'),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production') {
        const encryptionSecret = data.ENCRYPTION_SECRET || data.TOKEN_ENCRYPTION_SECRET;
        const hasValidSecrets =
          data.GITHUB_CLIENT_ID.length > 0 &&
          data.GITHUB_CLIENT_SECRET.length > 0 &&
          !encryptionSecret.startsWith('0123456789abcdef');

        const corsString = data.FRONTEND_URL || data.CORS_ORIGIN;
        const webString = data.FRONTEND_URL || data.WEB_ORIGIN;
        const origins = corsString.split(',').map((o) => o.trim());
        const hasWildcard = origins.includes('*');
        const hasLocalhostOrigin = origins.some((o) => o.includes('localhost') || o.includes('127.0.0.1'));
        const hasLocalhostWeb = webString.includes('localhost') || webString.includes('127.0.0.1');

        return hasValidSecrets && !hasWildcard && !hasLocalhostOrigin && !hasLocalhostWeb;
      }
      return true;
    },
    {
      message:
        'Production requirements failed: Must provide real GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, non-default TOKEN_ENCRYPTION_SECRET, non-localhost WEB_ORIGIN and non-wildcard, non-localhost CORS_ORIGIN.',
    }
  );

export const envSchema = EnvSchema;
export type EnvConfig = z.infer<typeof EnvSchema>;

export function parseCorsOrigins(corsOriginString: string, nodeEnv = process.env.NODE_ENV || 'development'): string[] {
  const origins = corsOriginString
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.includes('*')) {
    throw new Error("Wildcard CORS origin '*' is strictly forbidden when credentials/cookies are enabled.");
  }

  if (nodeEnv === 'production') {
    const hasLocalhost = origins.some((o) => o.includes('localhost') || o.includes('127.0.0.1'));
    if (hasLocalhost) {
      throw new Error('Localhost origin is forbidden in production environment.');
    }
  }

  return origins;
}

export function validateEnv(customEnv?: Record<string, unknown>): EnvConfig {
  const result = EnvSchema.safeParse(customEnv || process.env);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err: ZodIssue) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    // Note: Never log sensitive environment values
    console.error('❌ Environment validation failed:\n' + errorDetails);
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

export const env = validateEnv();
