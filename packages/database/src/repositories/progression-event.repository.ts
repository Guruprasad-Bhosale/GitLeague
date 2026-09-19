import mongoose from 'mongoose';
import { ProgressionEventModel, IProgressionEventDocument } from '../models/progression-event.model.js';
import { ProgressionEventType, IProgressionEvent } from '@gitleague/types';

export class ProgressionEventRepository {
  /**
   * Idempotently record a milestone progression event using unique eventKey
   */
  static async recordEvent(data: {
    userId: string;
    type: ProgressionEventType;
    eventKey: string;
    metadata?: Record<string, unknown>;
    occurredAt?: Date;
  }): Promise<boolean> {
    if (mongoose.connection.readyState === 0) return false;
    try {
      const res = await ProgressionEventModel.updateOne(
        {
          userId: data.userId,
          eventKey: data.eventKey,
        },
        {
          $setOnInsert: {
            userId: data.userId,
            type: data.type,
            eventKey: data.eventKey,
            metadata: data.metadata || {},
            occurredAt: data.occurredAt || new Date(),
          },
        },
        { upsert: true }
      );

      return (res.upsertedCount || 0) > 0;
    } catch (err: unknown) {
      // E11000 duplicate key error is gracefully ignored for idempotency
      if ((err as { code?: number })?.code === 11000) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Retrieve recent chronological progression events for a user
   */
  static async getRecentEvents(
    userId: string,
    limit = 10
  ): Promise<IProgressionEvent[]> {
    if (mongoose.connection.readyState === 0) return [];
    const docs = await ProgressionEventModel.find({ userId })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean();

    return docs.map((d) => ({
      id: d._id.toString(),
      userId: d.userId,
      type: d.type,
      eventKey: d.eventKey,
      metadata: d.metadata || {},
      occurredAt: d.occurredAt,
    }));
  }
}
