import mongoose, { Schema, Document, Model } from 'mongoose';
import { ISession } from '@gitleague/types';

export interface ISessionDocument extends Document, Omit<ISession, '_id'> {}

export const SessionSchema = new Schema<ISessionDocument>(
  {
    sessionHash: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, default: Date.now },
    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// TTL index to automatically purge expired sessions from MongoDB
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel: Model<ISessionDocument> =
  mongoose.models.Session || mongoose.model<ISessionDocument>('Session', SessionSchema);
