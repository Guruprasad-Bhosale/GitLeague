import { describe, it, expect } from 'vitest';
import { AppError } from '../src/errors/app-error.js';

describe('AppError Hierarchy', () => {
  it('instantiates badRequest correctly', () => {
    const err = AppError.badRequest('Invalid input', { field: 'email' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('Invalid input');
    expect(err.details).toEqual({ field: 'email' });
    expect(err.isOperational).toBe(true);
  });

  it('instantiates unauthorized correctly', () => {
    const err = AppError.unauthorized('Invalid token');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('instantiates forbidden correctly', () => {
    const err = AppError.forbidden('Forbidden action');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('instantiates notFound correctly', () => {
    const err = AppError.notFound('User not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('instantiates rateLimited correctly', () => {
    const err = AppError.rateLimited('Rate limit reached');
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
  });

  it('instantiates internal server error correctly', () => {
    const err = AppError.internal('Database connection failed');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_SERVER_ERROR');
  });
});
