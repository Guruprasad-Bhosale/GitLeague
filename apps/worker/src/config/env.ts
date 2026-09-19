import dotenv from 'dotenv';
import { z, type ZodIssue } from 'zod';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

export const WorkerEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required').default('mongodb://localhost:27017/gitleague'),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().int().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    // Security & Encryption (AES-256 requires minimum 32 chars)
    TOKEN_ENCRYPTION_SECRET: z
      .string()
      .min(32, 'TOKEN_ENCRYPTION_SECRET must be at least 32 characters')
      .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production') {
        return !data.TOKEN_ENCRYPTION_SECRET.startsWith('0123456789abcdef');
      }
      return true;
    },
    {
      message: 'In production, worker requires a real non-default TOKEN_ENCRYPTION_SECRET.',
    }
  );

export type WorkerEnvConfig = z.infer<typeof WorkerEnvSchema>;

export function validateWorkerEnv(customEnv?: Record<string, unknown>): WorkerEnvConfig {
  const result = WorkerEnvSchema.safeParse(customEnv || process.env);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err: ZodIssue) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    console.error('❌ Worker environment validation failed:\n' + errorDetails);
    throw new Error('Invalid worker environment configuration');
  }
  return result.data;
}

export const workerEnv = validateWorkerEnv();
