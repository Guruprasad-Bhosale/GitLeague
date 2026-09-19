import mongoose, { Schema, Document, Model } from 'mongoose';
import { ISeasonResult } from '@gitleague/types';

export interface ISeasonResultDocument extends Document, Omit<ISeasonResult, '_id'> {}

export const SeasonResultSchema = new Schema<ISeasonResultDocument>(
  {
    seasonId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    finalRank: { type: Number, required: true },
    finalXP: { type: Number, required: true },
    finalLevel: { type: Number, required: true },
    finalTier: { type: String, required: true },
    country: { type: String, default: null },
    collegeId: { type: String, default: null },
    finalizedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound indexes for uniqueness, leaderboard ordering, and user history lookups
SeasonResultSchema.index({ seasonId: 1, userId: 1 }, { unique: true });
SeasonResultSchema.index({ seasonId: 1, finalRank: 1 });
SeasonResultSchema.index({ userId: 1, finalizedAt: -1 });

export const SeasonResultModel: Model<ISeasonResultDocument> =
  mongoose.models.SeasonResult ||
  mongoose.model<ISeasonResultDocument>('SeasonResult', SeasonResultSchema);
