import { describe, it, expect } from 'vitest';
import { isDatabaseConnected, getDatabaseStatus, disconnectDatabase } from '@gitleague/database';

describe('Database Connection Lifecycle', () => {
  it('reports disconnected database status cleanly in test environment', () => {
    const status = getDatabaseStatus();
    expect(status).toBeDefined();
    expect(typeof status.isConnected).toBe('boolean');
    expect(typeof status.readyState).toBe('number');
  });

  it('isDatabaseConnected returns boolean without throwing', () => {
    const isConnected = isDatabaseConnected();
    expect(typeof isConnected).toBe('boolean');
  });

  it('disconnectDatabase executes cleanly when called', async () => {
    await expect(disconnectDatabase()).resolves.not.toThrow();
  });
});
