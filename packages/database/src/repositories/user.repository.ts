import { UserModel, IUserDocument } from '../models/user.model.js';
import { ISafeUser } from '@gitleague/types';

export interface IUpsertGitHubUserData {
  githubId: string;
  username: string;
  displayName?: string | null;
  avatarUrl: string;
  githubProfileUrl: string;
  email?: string | null;
  bio?: string | null;
  location?: string | null;
  company?: string | null;
  encryptedAccessToken?: string | null;
}

export class UserRepository {
  /**
   * Find or create user by stable GitHub ID and update mutable identity data
   */
  static async upsertGitHubUser(data: IUpsertGitHubUserData): Promise<IUserDocument> {
    const updatePayload: Record<string, unknown> = {
      username: data.username.toLowerCase().trim(),
      displayName: data.displayName ?? null,
      avatarUrl: data.avatarUrl,
      githubProfileUrl: data.githubProfileUrl,
      email: data.email ?? null,
      bio: data.bio ?? null,
      location: data.location ?? null,
      company: data.company ?? null,
      lastLoginAt: new Date(),
    };

    if (data.encryptedAccessToken) {
      updatePayload.encryptedAccessToken = data.encryptedAccessToken;
    }

    const user = await UserModel.findOneAndUpdate(
      { githubId: data.githubId },
      {
        $set: updatePayload,
        $setOnInsert: {
          githubId: data.githubId,
          lastSyncedAt: null,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    return user;
  }

  static async findById(id: string): Promise<IUserDocument | null> {
    return UserModel.findById(id);
  }

  static async findByGitHubId(githubId: string): Promise<IUserDocument | null> {
    return UserModel.findOne({ githubId });
  }

  static async findByUsername(username: string): Promise<IUserDocument | null> {
    return UserModel.findOne({ username: username.toLowerCase().trim() });
  }

  static async updateLastLogin(id: string): Promise<void> {
    await UserModel.findByIdAndUpdate(id, { $set: { lastLoginAt: new Date() } });
  }

  static async updateEncryptedToken(id: string, encryptedAccessToken: string): Promise<void> {
    await UserModel.findByIdAndUpdate(id, { $set: { encryptedAccessToken } });
  }

  static async updateSyncStatus(
    id: string,
    status: 'never_synced' | 'queued' | 'syncing' | 'completed' | 'failed',
    metadata?: {
      startedAt?: Date;
      completedAt?: Date;
      error?: string | null;
    }
  ): Promise<IUserDocument | null> {
    const update: Record<string, unknown> = { syncStatus: status };
    if (metadata?.startedAt) update.syncStartedAt = metadata.startedAt;
    if (metadata?.completedAt) {
      update.syncCompletedAt = metadata.completedAt;
      update.lastSyncedAt = metadata.completedAt;
    }
    if (metadata?.error !== undefined) update.syncError = metadata.error;

    return UserModel.findByIdAndUpdate(id, { $set: update }, { new: true });
  }

  /**
   * Strips all internal and sensitive fields (tokens, hashes, db version)
   */
  static toSafeUser(user: IUserDocument): ISafeUser {
    return {
      id: user._id.toString(),
      githubId: user.githubId,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      githubProfileUrl: user.githubProfileUrl,
      email: user.email,
      bio: user.bio,
      location: user.location,
      company: user.company,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      lastSyncedAt: user.lastSyncedAt,
      syncStatus: user.syncStatus || 'never_synced',
      syncStartedAt: user.syncStartedAt ?? null,
      syncCompletedAt: user.syncCompletedAt ?? null,
      syncError: user.syncError ?? null,
    };
  }
}
