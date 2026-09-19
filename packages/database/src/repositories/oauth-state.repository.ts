import { OAuthStateModel } from '../models/oauth-state.model.js';

export class OAuthStateRepository {
  /**
   * Persist a cryptographically random OAuth state with TTL
   * @param state Cryptographically secure state string
   * @param ttlSeconds Lifetime in seconds (default 600s = 10 minutes)
   */
  static async createState(state: string, ttlSeconds = 600): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await OAuthStateModel.create({
      state,
      expiresAt,
    });
  }

  /**
   * Atomically validate and consume (delete) an OAuth state to prevent reuse
   * Returns true if valid and consumed, false if invalid or expired.
   */
  static async consumeState(state: string): Promise<boolean> {
    const record = await OAuthStateModel.findOneAndDelete({
      state,
      expiresAt: { $gt: new Date() },
    });
    return !!record;
  }
}
