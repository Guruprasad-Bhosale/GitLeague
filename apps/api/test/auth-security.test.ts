import { describe, it, expect } from 'vitest';
import { UserRepository } from '@gitleague/database';
import { IUserDocument } from '@gitleague/database';

describe('Authentication Security Guarantees & Safe Representations', () => {
  it('UserRepository.toSafeUser strips all sensitive token and provider secrets', () => {
    const internalUserDoc = {
      _id: '507f1f77bcf86cd799439011',
      githubId: '123456',
      username: 'secret_dev',
      displayName: 'Secret Developer',
      avatarUrl: 'https://avatars.githubusercontent.com/u/123456',
      githubProfileUrl: 'https://github.com/secret_dev',
      email: 'dev@secret.io',
      bio: 'Top secret projects',
      location: 'Moon',
      company: 'Antigravity Corp',
      encryptedAccessToken: 'v1:random_iv:auth_tag:ultra_sensitive_github_token_data',
      createdAt: new Date(),
      lastLoginAt: new Date(),
      lastSyncedAt: null,
    } as unknown as IUserDocument;

    const safeUser = UserRepository.toSafeUser(internalUserDoc);

    expect(safeUser.id).toBe('507f1f77bcf86cd799439011');
    expect(safeUser.username).toBe('secret_dev');
    expect(safeUser.email).toBe('dev@secret.io');

    // Verify sensitive keys are NOT in safe user representation
    expect((safeUser as any).encryptedAccessToken).toBeUndefined();
    expect((safeUser as any).accessToken).toBeUndefined();
    expect((safeUser as any).password).toBeUndefined();
    expect((safeUser as any).token).toBeUndefined();
    expect((safeUser as any)._id).toBeUndefined();
  });
});
