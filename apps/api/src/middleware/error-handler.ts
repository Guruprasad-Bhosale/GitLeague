import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.id;

  // Handle known operational AppError
  if (err instanceof AppError) {
    logger.warn({ err, requestId }, `AppError: ${err.message}`);
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      requestId,
    });
    return;
  }

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    logger.warn({ errors: formattedErrors, requestId }, 'Validation Error');
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters or payload',
        details: formattedErrors,
      },
      requestId,
    });
    return;
  }

  // Handle Body-Parser / Malformed JSON Syntax Errors
  if ('type' in err && (err as { type: string }).type === 'entity.parse.failed') {
    logger.warn({ err, requestId }, 'Malformed JSON in request body');
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload in request body',
      },
      requestId,
    });
    return;
  }

  // Handle Body-Parser Payload Too Large (413)
  if (
    ('type' in err && (err as { type: string }).type === 'entity.too.large') ||
    ('status' in err && (err as { status: number }).status === 413)
  ) {
    logger.warn({ err, requestId }, 'Request payload too large');
    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds the maximum allowed size of 100kb',
      },
      requestId,
    });
    return;
  }

  // Unhandled / Internal Server Error
  logger.error({ err, requestId }, 'Unhandled Server Error');

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'An internal error occurred. Please try again later.'
          : err.message || 'Internal server error',
    },
    requestId,
  });
}
