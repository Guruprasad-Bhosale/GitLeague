import { describe, it, expect } from 'vitest';
import {
  getSeasonStatus,
  isSeasonActive,
  isSeasonUpcoming,
  isSeasonCompleted,
  isValidSeasonTransition,
  sortSeasonParticipantsDeterministically,
  calculateSeasonPersonalBests,
} from '../src/seasons.js';
import type { IUserSeasonHistoryItem } from '@gitleague/types';

describe('Game Engine: Season Domain Logic', () => {
  const startDate = new Date('2026-01-01T00:00:00.000Z');
  const endDate = new Date('2026-03-31T23:59:59.999Z');

  describe('UTC Boundary & Status Evaluation', () => {
    it('returns "upcoming" before startDate', () => {
      const ref = new Date('2025-12-31T23:59:59.999Z');
      expect(getSeasonStatus(startDate, endDate, ref)).toBe('upcoming');
      expect(isSeasonUpcoming(startDate, endDate, ref)).toBe(true);
      expect(isSeasonActive(startDate, endDate, ref)).toBe(false);
      expect(isSeasonCompleted(startDate, endDate, ref)).toBe(false);
    });

    it('returns "active" exactly at startDate and within bounds', () => {
      expect(getSeasonStatus(startDate, endDate, startDate)).toBe('active');
      expect(isSeasonActive(startDate, endDate, startDate)).toBe(true);

      const midDate = new Date('2026-02-15T12:00:00.000Z');
      expect(getSeasonStatus(startDate, endDate, midDate)).toBe('active');
      expect(isSeasonActive(startDate, endDate, midDate)).toBe(true);
    });

    it('returns "completed" at and after endDate', () => {
      expect(getSeasonStatus(startDate, endDate, endDate)).toBe('completed');
      expect(isSeasonCompleted(startDate, endDate, endDate)).toBe(true);

      const afterDate = new Date('2026-04-01T00:00:00.000Z');
      expect(getSeasonStatus(startDate, endDate, afterDate)).toBe('completed');
      expect(isSeasonActive(startDate, endDate, afterDate)).toBe(false);
    });
  });

  describe('Season State Transitions', () => {
    it('allows valid progressive lifecycle transitions', () => {
      expect(isValidSeasonTransition('upcoming', 'active')).toBe(true);
      expect(isValidSeasonTransition('active', 'completed')).toBe(true);
      expect(isValidSeasonTransition('upcoming', 'completed')).toBe(true);
      expect(isValidSeasonTransition('active', 'active')).toBe(true);
      expect(isValidSeasonTransition('completed', 'completed')).toBe(true);
    });

    it('rejects backward or illegal lifecycle transitions', () => {
      expect(isValidSeasonTransition('completed', 'active')).toBe(false);
      expect(isValidSeasonTransition('completed', 'upcoming')).toBe(false);
      expect(isValidSeasonTransition('active', 'upcoming')).toBe(false);
    });
  });

  describe('Deterministic Participant Ranking Sort', () => {
    it('sorts primarily by seasonXP DESC', () => {
      const participants = [
        { userId: 'user-1', seasonXP: 1000, level: 10 },
        { userId: 'user-2', seasonXP: 2500, level: 5 },
        { userId: 'user-3', seasonXP: 1800, level: 8 },
      ];

      const sorted = sortSeasonParticipantsDeterministically(participants);
      expect(sorted.map((p) => p.userId)).toEqual(['user-2', 'user-3', 'user-1']);
    });

    it('breaks ties secondarily by level DESC', () => {
      const participants = [
        { userId: 'user-1', seasonXP: 2000, level: 12 },
        { userId: 'user-2', seasonXP: 2000, level: 18 },
        { userId: 'user-3', seasonXP: 2000, level: 8 },
      ];

      const sorted = sortSeasonParticipantsDeterministically(participants);
      expect(sorted.map((p) => p.userId)).toEqual(['user-2', 'user-1', 'user-3']);
    });

    it('breaks secondary ties tertiarily by userId ASC (lexicographical)', () => {
      const participants = [
        { userId: 'charlie', seasonXP: 2000, level: 10 },
        { userId: 'alice', seasonXP: 2000, level: 10 },
        { userId: 'bob', seasonXP: 2000, level: 10 },
      ];

      const sorted = sortSeasonParticipantsDeterministically(participants);
      expect(sorted.map((p) => p.userId)).toEqual(['alice', 'bob', 'charlie']);
    });
  });

  describe('Season Personal Bests Calculation', () => {
    it('returns empty personal bests for empty history', () => {
      const pb = calculateSeasonPersonalBests([]);
      expect(pb.bestRank).toBeNull();
      expect(pb.bestXP).toBeNull();
      expect(pb.seasonsParticipated).toBe(0);
    });

    it('computes lowest rank and highest XP across completed seasons', () => {
      const history: IUserSeasonHistoryItem[] = [
        {
          season: {
            id: 's1',
            seasonNumber: 1,
            name: 'Season 01',
            slug: 'season-01',
            status: 'completed',
            startDate,
            endDate,
          },
          finalRank: 42,
          finalXP: 8200,
          finalLevel: 25,
          finalTier: 'PLATINUM',
        },
        {
          season: {
            id: 's2',
            seasonNumber: 2,
            name: 'Season 02',
            slug: 'season-02',
            status: 'completed',
            startDate,
            endDate,
          },
          finalRank: 12,
          finalXP: 14500,
          finalLevel: 32,
          finalTier: 'DIAMOND',
        },
        {
          season: {
            id: 's3',
            seasonNumber: 3,
            name: 'Season 03',
            slug: 'season-03',
            status: 'completed',
            startDate,
            endDate,
          },
          finalRank: 18,
          finalXP: 9500,
          finalLevel: 35,
          finalTier: 'DIAMOND',
        },
      ];

      const pb = calculateSeasonPersonalBests(history);
      expect(pb.seasonsParticipated).toBe(3);
      expect(pb.bestRank).toEqual({
        seasonSlug: 'season-02',
        seasonName: 'Season 02',
        rank: 12,
      });
      expect(pb.bestXP).toEqual({
        seasonSlug: 'season-02',
        seasonName: 'Season 02',
        xp: 14500,
      });
    });
  });
});
