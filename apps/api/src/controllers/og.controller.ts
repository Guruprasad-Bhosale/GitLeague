import { Request, Response, NextFunction } from 'express';
import { UsernameParamSchema } from '@gitleague/validation';
import { UserProfileRepository } from '@gitleague/database';
import { AppError } from '../errors/app-error.js';

/**
 * Escapes XML/SVG special characters to prevent injection
 */
function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class OgController {
  /**
   * GET /api/v1/og/profile/:username
   * Generates a lightweight, secure, beautiful deterministic SVG Open Graph image card.
   */
  static async getProfileCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validation = UsernameParamSchema.safeParse(req.params);
      if (!validation.success) {
        throw AppError.badRequest('Invalid GitHub username', validation.error.format());
      }

      const { username } = validation.data;
      const profile = await UserProfileRepository.getPublicProfileByUsername(username);

      if (!profile) {
        throw AppError.notFound(`Developer @${username} not found`);
      }

      const safeUsername = escapeXml(profile.username);
      const safeDisplayName = escapeXml(profile.displayName || profile.username);
      const safeLevel = escapeXml(profile.level.toString());
      const safeTier = escapeXml(profile.tierTitle || profile.tier);
      const safeXP = escapeXml(profile.xp.toLocaleString());
      const safeGlobalRank = escapeXml(profile.globalRank ? `#${profile.globalRank}` : '—');
      const safeCountryRank = escapeXml(profile.countryRank ? `#${profile.countryRank}` : '—');
      const safeStreak = escapeXml(`${profile.currentStreak}d`);
      const safeCommits = escapeXml(profile.commits.toLocaleString());
      const safePRs = escapeXml(profile.pullRequests.toLocaleString());

      // Tier-specific accent colors
      const tierColors: Record<string, string> = {
        BRONZE: '#CD7F32',
        SILVER: '#94A3B8',
        GOLD: '#F59E0B',
        PLATINUM: '#06B6D4',
        DIAMOND: '#3B82F6',
        MASTER: '#8B5CF6',
        GRANDMASTER: '#EF4444',
      };
      const accentColor = tierColors[profile.tier] || '#10B981';

      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background with subtle gradient -->
  <rect width="1200" height="630" fill="#0A0D14"/>
  <rect width="1200" height="630" fill="url(#grid-pattern)" opacity="0.15"/>
  <circle cx="1050" cy="150" r="300" fill="${accentColor}" opacity="0.12" filter="blur(100px)"/>
  <circle cx="150" cy="500" r="250" fill="#10B981" opacity="0.08" filter="blur(80px)"/>

  <!-- Outer Card Frame -->
  <rect x="40" y="40" width="1120" height="550" rx="24" fill="#111622" stroke="#1E293B" stroke-width="2"/>

  <!-- Header Branding -->
  <g transform="translate(80, 85)">
    <text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#10B981" letter-spacing="4">&gt;_ GITLEAGUE</text>
    <text x="180" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="500" fill="#64748B">| COMPETITIVE DEVELOPER IDENTITY</text>
  </g>

  <!-- Developer Identity Section -->
  <g transform="translate(80, 150)">
    <!-- Identity Info -->
    <text y="40" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="800" fill="#F8FAFC">${safeDisplayName}</text>
    <text y="80" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="500" fill="#94A3B8">@${safeUsername}</text>

    <!-- Tier & Level Badges -->
    <g transform="translate(0, 120)">
      <rect width="160" height="42" rx="8" fill="#1E293B" stroke="${accentColor}" stroke-width="1.5"/>
      <text x="80" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="${accentColor}" text-anchor="middle" letter-spacing="1.5">${safeTier}</text>

      <rect x="180" width="140" height="42" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1"/>
      <text x="250" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="#F8FAFC" text-anchor="middle">LEVEL ${safeLevel}</text>

      <rect x="340" width="160" height="42" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1"/>
      <text x="420" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="#10B981" text-anchor="middle">${safeXP} XP</text>
    </g>
  </g>

  <!-- Key Metrics Row -->
  <g transform="translate(80, 390)">
    <!-- Global Rank -->
    <rect x="0" width="220" height="130" rx="16" fill="#161F30" stroke="#1E293B" stroke-width="1"/>
    <text x="24" y="40" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#64748B" letter-spacing="1">GLOBAL RANK</text>
    <text x="24" y="90" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="36" font-weight="800" fill="#F8FAFC">${safeGlobalRank}</text>

    <!-- Country Rank -->
    <rect x="240" width="220" height="130" rx="16" fill="#161F30" stroke="#1E293B" stroke-width="1"/>
    <text x="264" y="40" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#64748B" letter-spacing="1">COUNTRY RANK</text>
    <text x="264" y="90" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="36" font-weight="800" fill="#F8FAFC">${safeCountryRank}</text>

    <!-- Commits -->
    <rect x="480" width="220" height="130" rx="16" fill="#161F30" stroke="#1E293B" stroke-width="1"/>
    <text x="504" y="40" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#64748B" letter-spacing="1">TOTAL COMMITS</text>
    <text x="504" y="90" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="36" font-weight="800" fill="#F8FAFC">${safeCommits}</text>

    <!-- Pull Requests & Streak -->
    <rect x="720" width="220" height="130" rx="16" fill="#161F30" stroke="#1E293B" stroke-width="1"/>
    <text x="744" y="40" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#64748B" letter-spacing="1">ACTIVE STREAK</text>
    <text x="744" y="90" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="36" font-weight="800" fill="#10B981">${safeStreak}</text>
  </g>

  <!-- Subtle Footer Info -->
  <text x="1080" y="555" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#475569" text-anchor="end">gitleague.dev/profile/${safeUsername}</text>
</svg>`;

      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
      res.status(200).send(svg);
    } catch (err) {
      next(err);
    }
  }
}
