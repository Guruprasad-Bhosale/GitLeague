import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env, parseCorsOrigins } from './config/env.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import { generalLimiter, authLimiter, syncLimiter, searchLimiter } from './middleware/rate-limit.js';
import { HealthController } from './controllers/health.controller.js';
import apiRouter from './routes/index.js';

export function createApp(): Express {
  const app = express();

  // Configure reverse proxy trust (Render, Railway, Nginx)
  if (env.TRUST_PROXY) {
    app.set('trust proxy', env.TRUST_PROXY);
  }

  // Production-Tuned Security Headers via Helmet
  const allowedOrigins = parseCorsOrigins(env.CORS_ORIGIN);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", ...allowedOrigins, 'https://api.github.com'],
          imgSrc: ["'self'", 'data:', 'https://avatars.githubusercontent.com', 'https://*.githubusercontent.com', 'https://github.com'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts:
        env.NODE_ENV === 'production'
          ? {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
            }
          : false,
      frameguard: { action: 'deny' },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // Multi-Origin CORS Configuration
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!requestOrigin) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(requestOrigin) || (env.NODE_ENV !== 'production' && requestOrigin.startsWith('http://localhost:'))) {
          return callback(null, true);
        }

        return callback(new Error(`CORS policy rejection: Origin ${requestOrigin} is not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
      exposedHeaders: ['x-request-id'],
    })
  );

  // Request ID Middleware (must be before logging and rate limiting)
  app.use(requestIdMiddleware);

  // Global Baseline Rate Limiter
  app.use(generalLimiter);

  // Route-Specific Rate Limiters
  app.use('/api/v1/auth', authLimiter);
  app.use('/api/v1/me/sync', syncLimiter);
  app.use('/api/v1/users/search', searchLimiter);

  // JSON Body and URL-encoded Parsers with Strict Size Limits
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(cookieParser());

  // Structured Request Logging
  app.use(requestLogger);

  // Root Service Discovery Endpoint: GET /
  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        service: 'GitLeague API',
        status: 'ok',
        version: 'v1',
      },
    });
  });

  // Direct Health / Liveness / Readiness aliases for load balancers & container probes
  app.get('/health', HealthController.getHealth);
  app.get('/health/ready', HealthController.getReadiness);
  app.get('/health/live', HealthController.getLiveness);

  // Mount API Endpoints under /api
  app.use('/api', apiRouter);

  // 404 Route Handler
  app.use(notFoundHandler);

  // Centralized Error Handler (must be last)
  app.use(errorHandler);

  return app;
}

