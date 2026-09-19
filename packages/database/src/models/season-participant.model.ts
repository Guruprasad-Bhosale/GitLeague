import mongoose, { Schema, Document, Model } from 'mongoose';
import { ISeasonParticipant } from '@gitleague/types';

export interface ISeasonParticipantDocument extends Document, Omit<ISeasonParticipant, '_id'> {}

export const SeasonParticipantSchema = new Schema<ISeasonParticipantDocument>(
  {
    seasonId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    lifetimeXPAtSeasonStart: { type: Number, default: 0 },
    lifetimeXPAtLastSync: { type: Number, default: 0 },
    seasonXP: { type: Number, default: 0, index: -1 },
    finalRank: { type: Number, default: null },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound indexes for participant query performance and uniqueness
SeasonParticipantSchema.index({ seasonId: 1, userId: 1 }, { unique: true });
SeasonParticipantSchema.index({ seasonId: 1, seasonXP: -1, lifetimeXPAtLastSync: -1 });

export const SeasonParticipantModel: Model<ISeasonParticipantDocument> =
  mongoose.models.SeasonParticipant ||
  mongoose.model<ISeasonParticipantDocument>('SeasonParticipant', SeasonParticipantSchema);
