import mongoose, { Schema, Document, Model } from 'mongoose';
import { IGameProfile } from '@gitleague/types';

export interface IGameProfileDocument extends Document, Omit<IGameProfile, '_id'> {}

export const GameProfileSchema = new Schema<IGameProfileDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    xp: { type: Number, default: 0, index: -1 },
    githubXP: { type: Number, default: 0 },
    questXP: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    tier: {
      type: String,
      enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'GRANDMASTER'],
      default: 'BRONZE',
      index: true,
    },
    currentRank: { type: Number, default: 0, index: 1 },
    previousRank: { type: Number, default: 0 },
    seasonXP: { type: Number, default: 0, index: -1 },
    stats: {
      coding: { type: Number, default: 10 },
      consistency: { type: Number, default: 10 },
      builder: { type: Number, default: 10 },
      openSource: { type: Number, default: 10 },
    },
    achievements: [
      {
        id: { type: String, required: true },
        unlockedAt: { type: Date, default: Date.now },
        progress: { type: Number, default: 0 },
        isUnlocked: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

export const GameProfileModel: Model<IGameProfileDocument> =
  mongoose.models.GameProfile || mongoose.model<IGameProfileDocument>('GameProfile', GameProfileSchema);
