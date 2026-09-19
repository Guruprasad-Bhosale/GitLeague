import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processUserSync } from '../src/processors/sync.processor.js';
import { UserRepository, encryptToken } from '@gitleague/database';
import {
  GitHubService,
  GitHubAuthenticationError,
  GitHubNotFoundError,
  GitHubForbiddenError,
  GitHubNetworkError,
} from '@gitleague/github';
import type { Job } from 'bullmq';

describe('Worker GitHub API Resilience & Error Categorization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const validToken = encryptToken('gho_valid_mock_token_123');
  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    githubId: '12345',
    username: 'octocat',
    encryptedAccessToken: validToken,
    syncStatus: 'queued',
  };

  const mockJob = {
    id: 'user-sync:507f1f77bcf86cd799439011',
    data: { userId: '507f1f77bcf86cd799439011' },
  } as unknown as Job<{ userId: string }>;

  it('fails fast on 401 Unauthorized (expired/revoked token) without re-throwing for BullMQ retry loops', async () => {
    vi.spyOn(UserRepository, 'findById').mockResolvedValueOnce(mockUser as any);
    const updateSyncStatusSpy = vi.spyOn(UserRepository, 'updateSyncStatus').mockResolvedValue(mockUser as any);

    vi.spyOn(GitHubService.prototype, 'getUserAggregatedData').mockRejectedValueOnce(
      new GitHubAuthenticationError('Bad credentials', { status: 401 })
    );

    // Should resolve with failure status rather than throwing/retrying infinitely
    const result = await processUserSync(mockJob);
    expect(result.success).toBe(false);
    expect(result.xp).toBe(0);

    expect(updateSyncStatusSpy).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'failed',
      expect.objectContaining({
        error: expect.stringContaining('GitHub authorization expired or revoked'),
      })
    );
  });

  it('fails fast on 404 Not Found (deleted user or repo) without re-throwing', async () => {
    vi.spyOn(UserRepository, 'findById').mockResolvedValueOnce(mockUser as any);
    const updateSyncStatusSpy = vi.spyOn(UserRepository, 'updateSyncStatus').mockResolvedValue(mockUser as any);

    vi.spyOn(GitHubService.prototype, 'getUserAggregatedData').mockRejectedValueOnce(
      new GitHubNotFoundError('User not found on GitHub', { status: 404 })
    );

    const result = await processUserSync(mockJob);
    expect(result.success).toBe(false);

    expect(updateSyncStatusSpy).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'failed',
      expect.objectContaining({
        error: expect.stringContaining('not found'),
      })
    );
  });

  it('fails fast on 403 Forbidden without re-throwing', async () => {
    vi.spyOn(UserRepository, 'findById').mockResolvedValueOnce(mockUser as any);
    const updateSyncStatusSpy = vi.spyOn(UserRepository, 'updateSyncStatus').mockResolvedValue(mockUser as any);

    vi.spyOn(GitHubService.prototype, 'getUserAggregatedData').mockRejectedValueOnce(
      new GitHubForbiddenError('Account flagged or access forbidden', { status: 403 })
    );

    const result = await processUserSync(mockJob);
    expect(result.success).toBe(false);

    expect(updateSyncStatusSpy).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'failed',
      expect.objectContaining({
        error: expect.stringContaining('forbidden'),
      })
    );
  });

  it('re-throws transient network/5xx errors so BullMQ triggers backoff retries', async () => {
    vi.spyOn(UserRepository, 'findById').mockResolvedValueOnce(mockUser as any);
    vi.spyOn(UserRepository, 'updateSyncStatus').mockResolvedValue(mockUser as any);

    vi.spyOn(GitHubService.prototype, 'getUserAggregatedData').mockRejectedValueOnce(
      new GitHubNetworkError('ECONNRESET: Connection reset by peer')
    );

    await expect(processUserSync(mockJob)).rejects.toThrow(GitHubNetworkError);
  });
});
