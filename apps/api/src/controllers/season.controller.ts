import { Request, Response, NextFunction } from 'express';
import { SeasonSlugParamSchema, CreateSeasonSchema } from '@gitleague/validation';
import { SeasonRepository } from '@gitleague/database';
import { ISeasonSummary } from '@gitleague/types';
import { AppError } from '../errors/app-error.js';

export class SeasonController {
  /**
   * GET /api/v1/seasons
   * List all historical and active seasons
   */
  static async listSeasons(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const seasons = await SeasonRepository.listSeasons();

      const summaries: ISeasonSummary[] = seasons.map((s) => ({
        id: s._id.toString(),
        seasonNumber: s.seasonNumber,
        name: s.name,
        slug: s.slug,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        participantsCount: s.participantsCount,
      }));

      res.status(200).json({
        success: true,
        data: summaries,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/seasons/current
   * Retrieve active season details (or null if in off-season)
   */
  static async getCurrentSeason(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const season = await SeasonRepository.findActiveSeason();

      if (!season) {
        res.status(200).json({
          success: true,
          data: null,
          message: 'No active competitive season currently running',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id: season._id.toString(),
          seasonNumber: season.seasonNumber,
          name: season.name,
          slug: season.slug,
          status: season.status,
          startDate: season.startDate,
          endDate: season.endDate,
          participantsCount: season.participantsCount,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/seasons/:slug
   * Retrieve a specific season by its slug
   */
  static async getSeasonBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validation = SeasonSlugParamSchema.safeParse(req.params);
      if (!validation.success) {
        throw AppError.badRequest('Invalid season slug', validation.error.format());
      }

      const { slug } = validation.data;
      const season = await SeasonRepository.findBySlug(slug);

      if (!season) {
        throw AppError.notFound(`Season "${slug}" not found`);
      }

      res.status(200).json({
        success: true,
        data: {
          id: season._id.toString(),
          seasonNumber: season.seasonNumber,
          name: season.name,
          slug: season.slug,
          status: season.status,
          startDate: season.startDate,
          endDate: season.endDate,
          participantsCount: season.participantsCount,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/seasons
   * Explicitly create a new season
   */
  static async createSeason(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validation = CreateSeasonSchema.safeParse(req.body);
      if (!validation.success) {
        throw AppError.badRequest('Invalid season configuration', validation.error.format());
      }

      const season = await SeasonRepository.createSeason(validation.data);

      res.status(201).json({
        success: true,
        data: {
          id: season._id.toString(),
          seasonNumber: season.seasonNumber,
          name: season.name,
          slug: season.slug,
          status: season.status,
          startDate: season.startDate,
          endDate: season.endDate,
          participantsCount: season.participantsCount,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
