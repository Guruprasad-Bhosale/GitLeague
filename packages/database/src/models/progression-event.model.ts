import mongoose, { Schema, Document, Model } from 'mongoose';
import { IProgressionEvent, ProgressionEventType } from '@gitleague/types';

export interface IProgressionEventDocument extends Document, Omit<IProgressionEvent, 'id'> {}

export const ProgressionEventSchema = new Schema<IProgressionEventDocument>(
  {
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['LEVEL_UP', 'TIER_UP', 'ACHIEVEMENT_UNLOCKED', 'QUEST_COMPLETED', 'RANK_MILESTONE'],
      required: true,
      index: true,
    },
    eventKey: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, default: Date.now, index: -1 },
  },
  { timestamps: true }
);

// Idempotency: Duplicate sync jobs cannot produce duplicate milestone events
ProgressionEventSchema.index({ userId: 1, eventKey: 1 }, { unique: true });
ProgressionEventSchema.index({ userId: 1, occurredAt: -1 });

export const ProgressionEventModel: Model<IProgressionEventDocument> =
  mongoose.models.ProgressionEvent || mongoose.model<IProgressionEventDocument>('ProgressionEvent', ProgressionEventSchema);
