import { Request, Response, NextFunction } from 'express';
import { GitHubService, GitHubNotFoundError, GitHubRateLimitError } from '@gitleague/github';
import { UsernameParamSchema } from '@gitleague/validation';
import { AppError } from '../errors/app-error.js';

const githubService = new GitHubService();

export class GitHubController {
  /**
   * Retrieves normalized public GitHub user profile for verification.
   */
  static async getUserByUsername(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username } = UsernameParamSchema.parse(req.params);
      const user = await githubService.getUser(username);

      res.status(200).json({
        success: true,
        data: user,
        requestId: req.id,
      });
    } catch (err: unknown) {
      if (err instanceof GitHubNotFoundError) {
        return next(AppError.notFound(err.message));
      }
      if (err instanceof GitHubRateLimitError) {
        return next(AppError.rateLimited(err.message));
      }
      next(err);
    }
  }
}
