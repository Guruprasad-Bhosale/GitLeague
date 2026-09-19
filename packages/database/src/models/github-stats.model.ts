import mongoose, { Schema, Document, Model } from 'mongoose';
import { IGitHubStats } from '@gitleague/types';

export interface IGithubStatsDocument extends Document, Omit<IGitHubStats, '_id'> {}

export const GithubStatsSchema = new Schema<IGithubStatsDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    commits: { type: Number, default: 0 },
    pullRequests: { type: Number, default: 0 },
    mergedPullRequests: { type: Number, default: 0 },
    issues: { type: Number, default: 0 },
    repositories: { type: Number, default: 0 },
    stars: { type: Number, default: 0 },
    followers: { type: Number, default: 0 },
    contributionDays: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    languages: { type: Map, of: Number, default: {} },
    activityHistory: [{ date: String, count: Number }],
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const GithubStatsModel: Model<IGithubStatsDocument> =
  mongoose.models.GithubStats || mongoose.model<IGithubStatsDocument>('GithubStats', GithubStatsSchema);
