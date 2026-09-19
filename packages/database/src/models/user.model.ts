import mongoose, { Schema, Document, Model } from 'mongoose';
import { IUser } from '@gitleague/types';

export interface IUserDocument extends Document, Omit<IUser, '_id'> {
  _id: mongoose.Types.ObjectId;
}

export const UserSchema = new Schema<IUserDocument>(
  {
    githubId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, index: true, lowercase: true, trim: true },
    displayName: { type: String, default: null },
    avatarUrl: { type: String, required: true },
    githubProfileUrl: { type: String, required: true },
    email: { type: String, default: null },
    bio: { type: String, default: null },
    location: { type: String, default: null },
    company: { type: String, default: null },
    collegeId: { type: String, default: null, index: true },
    encryptedAccessToken: { type: String, default: null },
    lastLoginAt: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date, default: null },
    syncStatus: {
      type: String,
      enum: ['never_synced', 'queued', 'syncing', 'completed', 'failed'],
      default: 'never_synced',
      index: true,
    },
    syncStartedAt: { type: Date, default: null },
    syncCompletedAt: { type: Date, default: null },
    syncError: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

// Additional compound/single indexes
UserSchema.index({ location: 1 });

export const UserModel: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);
