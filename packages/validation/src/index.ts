import { z } from 'zod';

// ==========================================
// GitLeague Request & Parameter Validation
// ==========================================

export const LeaderboardScopeSchema = z.enum(['global', 'country', 'region', 'college', 'friends']);
export type LeaderboardScope = z.infer<typeof LeaderboardScopeSchema>;

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'GRANDMASTER']).optional(),
  search: z.string().trim().max(100).optional(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const LeaderboardQuerySchema = z.object({
  scope: LeaderboardScopeSchema.default('global'),
  country: z.string().trim().max(100).optional(),
  season: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'GRANDMASTER']).optional(),
  search: z.string().trim().max(100).optional(),
});

export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;

export const UsernameParamSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Username is required')
    .max(39, 'GitHub usernames cannot exceed 39 characters')
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/, 'Invalid GitHub username format'),
});

export type UsernameParam = z.infer<typeof UsernameParamSchema>;

export const SeasonIdParamSchema = z.object({
  seasonId: z.string().trim().min(1, 'Season ID is required'),
});

export type SeasonIdParam = z.infer<typeof SeasonIdParamSchema>;

export const SeasonSlugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Season slug is required')
    .max(50, 'Season slug too long')
    .regex(/^[a-z0-9-]+$/, 'Season slug must be lowercase alphanumeric and hyphens only'),
});

export type SeasonSlugParam = z.infer<typeof SeasonSlugParamSchema>;

export const CreateSeasonSchema = z
  .object({
    seasonNumber: z.coerce.number().int().min(1),
    name: z.string().trim().min(2).max(100),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .regex(/^[a-z0-9-]+$/),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    status: z.enum(['upcoming', 'active', 'completed']).default('upcoming'),
  })
  .refine((data) => data.startDate.getTime() < data.endDate.getTime(), {
    message: 'Season startDate must be strictly before endDate',
    path: ['endDate'],
  });

export type CreateSeasonInput = z.infer<typeof CreateSeasonSchema>;

export const TriggerSyncSchema = z.object({
  force: z.boolean().optional().default(false),
});

export type TriggerSyncInput = z.infer<typeof TriggerSyncSchema>;

export const OAuthCallbackQuerySchema = z.object({
  code: z.string().trim().min(1, 'Authorization code is required'),
  state: z.string().trim().min(1, 'OAuth state is required'),
});

export type OAuthCallbackQuery = z.infer<typeof OAuthCallbackQuerySchema>;

export const OAuthErrorQuerySchema = z.object({
  error: z.string().trim().min(1),
  error_description: z.string().optional(),
  error_uri: z.string().optional(),
});

export type OAuthErrorQuery = z.infer<typeof OAuthErrorQuerySchema>;

// Phase 7: Friends, Colleges, Search & Compare Schemas

export const FriendRequestSchema = z
  .object({
    recipientUsername: z
      .string()
      .trim()
      .min(1, 'Recipient username is required')
      .max(39, 'GitHub usernames cannot exceed 39 characters')
      .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/, 'Invalid GitHub username format')
      .optional(),
    recipientId: z.string().trim().min(1).optional(),
  })
  .refine((data) => Boolean(data.recipientUsername || data.recipientId), {
    message: 'Either recipientUsername or recipientId must be provided',
  });

export type FriendRequestInput = z.infer<typeof FriendRequestSchema>;

export const FriendRequestIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Friend request ID is required'),
});

export type FriendRequestIdParam = z.infer<typeof FriendRequestIdParamSchema>;

export const FriendUserIdParamSchema = z.object({
  userId: z.string().trim().min(1, 'Target user ID is required'),
});

export type FriendUserIdParam = z.infer<typeof FriendUserIdParamSchema>;

export const SelectCollegeSchema = z.object({
  collegeId: z.string().trim().min(1).nullable(),
});

export type SelectCollegeInput = z.infer<typeof SelectCollegeSchema>;

export const CollegeSearchQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CollegeSearchQuery = z.infer<typeof CollegeSearchQuerySchema>;

export const UserSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query cannot be empty').max(50),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type UserSearchQuery = z.infer<typeof UserSearchQuerySchema>;

export const RankHistoryQuerySchema = z.object({
  leaderboardType: z.enum(['lifetime', 'season']).default('lifetime'),
  scope: z.enum(['global', 'country', 'region', 'college', 'friends']).default('global'),
  season: z.string().trim().max(100).optional(),
  range: z.enum(['7d', '30d', 'all']).default('all').optional(),
});

export type RankHistoryQuery = z.infer<typeof RankHistoryQuerySchema>;

