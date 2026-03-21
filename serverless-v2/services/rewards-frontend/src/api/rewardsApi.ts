import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// ── Response Types ──────────────────────────────────────────────────────

export interface TierInfo {
  level: number;
  name: string;
  multiplier: number;
}

export interface NextTierInfo {
  level: number;
  name: string;
  threshold: number;
  pointsNeeded: number;
  progressPercent: number;
}

export interface PlayerRewards {
  playerId: string;
  displayName: string;
  currentTier: TierInfo;
  monthlyPoints: number;
  lifetimePoints: number;
  nextTier: NextTierInfo | null;
  monthKey: string;
}

export interface Transaction {
  timestamp: string;
  type: 'gameplay' | 'adjustment' | 'bonus';
  tableStakes: string;
  basePoints: number;
  multiplier: number;
  earnedPoints: number;
  handId: string;
}

export interface Pagination {
  limit: number;
  offset: number;
  total: number;
}

export interface PointsHistoryResponse {
  transactions: Transaction[];
  pagination: Pagination;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  displayName: string;
  tier: { level: number; name: string };
  monthlyPoints: number;
}

export interface PlayerRank {
  rank: number;
  monthlyPoints: number;
}

export interface LeaderboardResponse {
  monthKey: string;
  leaderboard: LeaderboardEntry[];
  playerRank?: PlayerRank;
}

export interface Notification {
  notificationId: string;
  type: 'tier_upgrade' | 'tier_downgrade' | 'milestone';
  title: string;
  message: string;
  dismissed: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export interface TierHistoryEntry {
  monthKey: string;
  tier: number;
  monthlyPoints: number;
  peakTier: number;
}

export interface TierHistoryResponse {
  tierHistory: TierHistoryEntry[];
}

// ── API Definition ──────────────────────────────────────────────────────

export const rewardsApi = createApi({
  reducerPath: 'rewardsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    prepareHeaders: (headers) => {
      const playerId = localStorage.getItem('playerId');
      if (playerId) headers.set('X-Player-Id', playerId);
      return headers;
    },
  }),
  tagTypes: ['Rewards', 'History', 'Leaderboard', 'Notifications'],
  endpoints: (builder) => ({
    getPlayerRewards: builder.query<PlayerRewards, void>({
      query: () => '/api/v1/player/rewards',
      providesTags: ['Rewards'],
    }),
    getPointsHistory: builder.query<PointsHistoryResponse, { limit?: number; offset?: number }>({
      query: ({ limit = 20, offset = 0 }) =>
        `/api/v1/player/rewards/history?limit=${limit}&offset=${offset}`,
      providesTags: ['History'],
    }),
    getLeaderboard: builder.query<LeaderboardResponse, { limit?: number }>({
      query: ({ limit = 10 }) => `/api/v1/leaderboard?limit=${limit}`,
      providesTags: ['Leaderboard'],
    }),
    getNotifications: builder.query<NotificationsResponse, { unread?: boolean } | void>({
      query: (args) => {
        const unread = args && 'unread' in args ? args.unread : undefined;
        return `/api/v1/player/notifications${unread ? '?unread=true' : ''}`;
      },
      providesTags: ['Notifications'],
    }),
    getTierHistory: builder.query<TierHistoryResponse, void>({
      query: () => '/api/v1/player/rewards/tier-history',
      providesTags: ['Rewards'],
    }),
    dismissNotification: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/api/v1/player/notifications/${id}/dismiss`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Notifications'],
    }),
  }),
});

export const {
  useGetPlayerRewardsQuery,
  useGetPointsHistoryQuery,
  useGetLeaderboardQuery,
  useGetNotificationsQuery,
  useGetTierHistoryQuery,
  useDismissNotificationMutation,
} = rewardsApi;
