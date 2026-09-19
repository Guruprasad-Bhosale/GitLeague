import { Request, Response } from 'express';
import { getDatabaseStatus } from '@gitleague/database';
import { APP_CONFIG } from '@gitleague/config';

export class HealthController {
  /**
   * Main service health check reporting overall system status.
   */
  static async getHealth(_req: Request, res: Response): Promise<void> {
    const dbStatus = getDatabaseStatus();
    const isHealthy = dbStatus.isConnected;

    const response = {
      status: isHealthy ? 'ok' : 'degraded',
      service: 'gitleague-api',
      version: APP_CONFIG.VERSION,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        api: 'ok',
        database: dbStatus.isConnected ? 'ok' : 'disconnected',
      },
    };

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      data: response,
    });
  }

  /**
   * Readiness probe for container orchestrators (e.g., Kubernetes, Render).
   */
  static async getReadiness(_req: Request, res: Response): Promise<void> {
    const dbStatus = getDatabaseStatus();

    if (!dbStatus.isConnected) {
      res.status(503).json({
        success: false,
        data: {
          ready: false,
          database: 'disconnected',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ready: true,
        database: 'connected',
      },
    });
  }

  /**
   * Liveness probe to verify that the HTTP event loop is responding.
   */
  static async getLiveness(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: {
        alive: true,
      },
    });
  }
}
