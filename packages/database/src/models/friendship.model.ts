import mongoose, { Schema, Document, Model } from 'mongoose';
import { IFriendship, FriendshipStatus } from '@gitleague/types';

export interface IFriendshipDocument extends Document, Omit<IFriendship, '_id'> {
  _id: mongoose.Types.ObjectId;
}

export const FriendshipSchema = new Schema<IFriendshipDocument>(
  {
    requesterId: { type: String, required: true, index: true },
    recipientId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      required: true,
      index: true,
    },
    pairA: { type: String, required: true, index: true },
    pairB: { type: String, required: true, index: true },
    acceptedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring only one friendship relationship exists between any pair of users
FriendshipSchema.index({ pairA: 1, pairB: 1 }, { unique: true });
FriendshipSchema.index({ recipientId: 1, status: 1 });
FriendshipSchema.index({ requesterId: 1, status: 1 });

export const FriendshipModel: Model<IFriendshipDocument> =
  mongoose.models.Friendship || mongoose.model<IFriendshipDocument>('Friendship', FriendshipSchema);
