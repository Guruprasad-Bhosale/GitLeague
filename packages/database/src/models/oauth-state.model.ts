import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOAuthState {
  _id: string;
  state: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface IOAuthStateDocument extends Document, Omit<IOAuthState, '_id'> {}

export const OAuthStateSchema = new Schema<IOAuthStateDocument>(
  {
    state: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// TTL index to automatically purge expired OAuth states after expiry
OAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthStateModel: Model<IOAuthStateDocument> =
  mongoose.models.OAuthState || mongoose.model<IOAuthStateDocument>('OAuthState', OAuthStateSchema);
