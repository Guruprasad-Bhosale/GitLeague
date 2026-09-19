import { SessionModel, ISessionDocument } from '../models/session.model.js';

export interface ICreateSessionData {
  sessionHash: string;
  userId: string;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export class SessionRepository {
  /**
   * Create a new server-side session document
   */
  static async createSession(data: ICreateSessionData): Promise<ISessionDocument> {
    const session = await SessionModel.create({
      sessionHash: data.sessionHash,
      userId: data.userId,
      expiresAt: data.expiresAt,
      userAgent: data.userAgent ?? null,
      ipAddress: data.ipAddress ?? null,
      lastUsedAt: new Date(),
    });
    return session;
  }

  /**
   * Find valid (non-expired) session by its SHA-256 hash
   */
  static async findSessionByHash(sessionHash: string): Promise<ISessionDocument | null> {
    return SessionModel.findOne({
      sessionHash,
      expiresAt: { $gt: new Date() },
    });
  }

  /**
   * Update the lastUsedAt timestamp on active sessions
   */
  static async touchSession(sessionHash: string): Promise<void> {
    await SessionModel.updateOne(
      { sessionHash, expiresAt: { $gt: new Date() } },
      { $set: { lastUsedAt: new Date() } }
    );
  }

  /**
   * Invalidate/delete a session by its token hash
   */
  static async deleteSessionByHash(sessionHash: string): Promise<boolean> {
    const result = await SessionModel.deleteOne({ sessionHash });
    return (result.deletedCount ?? 0) > 0;
  }

  /**
   * Invalidate all sessions for a specific user (e.g. password change, security reset)
   */
  static async deleteSessionsByUserId(userId: string): Promise<number> {
    const result = await SessionModel.deleteMany({ userId });
    return result.deletedCount ?? 0;
  }

  /**
   * Manually prune expired sessions (in addition to MongoDB TTL index)
   */
  static async deleteExpiredSessions(): Promise<number> {
    const result = await SessionModel.deleteMany({ expiresAt: { $lte: new Date() } });
    return result.deletedCount ?? 0;
  }
}
