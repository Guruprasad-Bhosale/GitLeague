import mongoose, { Schema, Document, Model } from 'mongoose';
import { IQuestProgress, QuestType } from '@gitleague/types';

export interface IQuestProgressDocument extends Document, Omit<IQuestProgress, '_id'> {}

export const QuestProgressSchema = new Schema<IQuestProgressDocument>(
  {
    userId: { type: String, required: true, index: true },
    questId: { type: String, required: true },
    questType: { type: String, enum: ['daily', 'weekly'], required: true },
    periodKey: { type: String, required: true, index: true },
    progress: { type: Number, default: 0 },
    target: { type: Number, required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    rewardXP: { type: Number, required: true },
    rewardGranted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Idempotency: Exactly one progress tracking document per user, quest, and period
QuestProgressSchema.index({ userId: 1, questId: 1, periodKey: 1 }, { unique: true });
QuestProgressSchema.index({ userId: 1, periodKey: 1 });

export const QuestProgressModel: Model<IQuestProgressDocument> =
  mongoose.models.QuestProgress || mongoose.model<IQuestProgressDocument>('QuestProgress', QuestProgressSchema);
