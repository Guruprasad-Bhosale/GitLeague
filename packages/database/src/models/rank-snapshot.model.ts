import mongoose, { Schema, Document, Model } from 'mongoose';
import { IRankSnapshot, LeaderboardType } from '@gitleague/types';

export interface IRankSnapshotDocument extends Document, Omit<IRankSnapshot, '_id'> {}

export const RankSnapshotSchema = new Schema<IRankSnapshotDocument>(
  {
    userId: { type: String, required: true, index: true },
    leaderboardType: {
      type: String,
      enum: ['lifetime', 'season'],
      required: true,
      index: true,
    },
    scope: { type: String, required: true, default: 'global', index: true },
    seasonId: { type: String, default: null },
    rank: { type: Number, required: true },
    xp: { type: Number, required: true },
    capturedAt: { type: Date, default: Date.now },
    periodKey: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

// Idempotency: Exactly one snapshot per user, leaderboard type, scope, and snapshot period
RankSnapshotSchema.index({ userId: 1, leaderboardType: 1, scope: 1, periodKey: 1 }, { unique: true });
RankSnapshotSchema.index({ leaderboardType: 1, scope: 1, periodKey: 1, rank: 1 });

export const RankSnapshotModel: Model<IRankSnapshotDocument> =
  mongoose.models.RankSnapshot || mongoose.model<IRankSnapshotDocument>('RankSnapshot', RankSnapshotSchema);
