import mongoose, { Schema, Document, Model } from 'mongoose';
import { ICollege } from '@gitleague/types';

export interface ICollegeDocument extends Document, Omit<ICollege, '_id'> {
  _id: mongoose.Types.ObjectId;
}

export const CollegeSchema = new Schema<ICollegeDocument>(
  {
    name: { type: String, required: true, trim: true, index: true },
    shortName: { type: String, default: null, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, default: 'India', trim: true },
    verified: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Indexes for directory search and lookup
CollegeSchema.index({ name: 'text', shortName: 'text', city: 'text' });
CollegeSchema.index({ country: 1, state: 1 });

export const CollegeModel: Model<ICollegeDocument> =
  mongoose.models.College || mongoose.model<ICollegeDocument>('College', CollegeSchema);
