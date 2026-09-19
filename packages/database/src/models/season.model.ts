import mongoose, { Schema, Document, Model } from 'mongoose';
import { ISeason } from '@gitleague/types';

export interface ISeasonDocument extends Document, Omit<ISeason, '_id'> {}

export const SeasonSchema = new Schema<ISeasonDocument>(
  {
    seasonNumber: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['upcoming', 'active', 'completed'],
      default: 'active',
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    isArchived: { type: Boolean, default: false },
    participantsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SeasonSchema.index({ status: 1, isActive: 1 });

export const SeasonModel: Model<ISeasonDocument> =
  mongoose.models.Season || mongoose.model<ISeasonDocument>('Season', SeasonSchema);
