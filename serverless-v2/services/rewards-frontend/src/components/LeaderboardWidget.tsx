import {
  Box,
  Card,
  CardHeader,
  Chip,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Typography,
  Alert,
  Button,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import { useGetLeaderboardQuery } from '../api/rewardsApi';
import { TIER_COLORS } from '../utils/tiers';

const medalColors: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
};

function LeaderboardSkeleton() {
  return (
    <List disablePadding>
      {Array.from({ length: 10 }).map((_, i) => (
        <ListItem key={i} sx={{ py: 1 }}>
          <Skeleton variant="text" width="80%" animation="wave" />
        </ListItem>
      ))}
    </List>
  );
}

export default function LeaderboardWidget() {
  const { data, isLoading, isError, refetch } = useGetLeaderboardQuery({ limit: 10 });
  const currentPlayerId = localStorage.getItem('playerId');

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Monthly Leaderboard" />
        <LeaderboardSkeleton />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader title="Monthly Leaderboard" />
        <Box sx={{ px: 2, pb: 2 }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={refetch}>
                Retry
              </Button>
            }
          >
            Failed to load leaderboard. Please try again.
          </Alert>
        </Box>
      </Card>
    );
  }

  if (!data || data.leaderboard.length === 0) {
    return (
      <Card>
        <CardHeader title="Monthly Leaderboard" />
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <LeaderboardIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Leaderboard data not available yet.
          </Typography>
        </Box>
      </Card>
    );
  }

  const playerInTop10 = data.leaderboard.some((e) => e.playerId === currentPlayerId);

  return (
    <Card>
      <CardHeader title="Monthly Leaderboard" />
      <List disablePadding>
        {data.leaderboard.map((entry) => {
          const isCurrentPlayer = entry.playerId === currentPlayerId;
          const tierColor = TIER_COLORS[entry.tier.level] || TIER_COLORS[1];

          return (
            <ListItem
              key={entry.playerId}
              sx={{
                borderLeft: isCurrentPlayer ? '3px solid #6C63FF' : '3px solid transparent',
                bgcolor: isCurrentPlayer ? 'rgba(108, 99, 255, 0.08)' : 'transparent',
                '&:hover': {
                  bgcolor: 'rgba(108, 99, 255, 0.04)',
                  transition: 'background-color 0.15s ease',
                },
                py: 1,
                px: 2,
              }}
            >
              {/* Rank */}
              <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 36 }}>
                {entry.rank <= 3 ? (
                  <EmojiEventsIcon sx={{ color: medalColors[entry.rank], fontSize: 20 }} />
                ) : (
                  <Typography variant="body2" fontWeight={600} sx={{ minWidth: 28 }}>
                    #{entry.rank}
                  </Typography>
                )}
              </Box>

              {/* Name + Tier dot */}
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={isCurrentPlayer ? 700 : 400}>
                      {entry.displayName}
                    </Typography>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: tierColor,
                      }}
                    />
                  </Box>
                }
                sx={{ mx: 1 }}
              />

              {/* Tier Chip */}
              <Chip
                label={entry.tier.name}
                size="small"
                sx={{
                  bgcolor: tierColor,
                  color: '#0D1117',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  height: 20,
                  mr: 1,
                }}
              />

              {/* Points */}
              <Typography variant="body2" fontWeight={600} sx={{ minWidth: 60, textAlign: 'right' }}>
                {entry.monthlyPoints.toLocaleString()}
              </Typography>
            </ListItem>
          );
        })}
      </List>

      {/* Player rank footer */}
      {data.playerRank && (
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Your Rank: #{data.playerRank.rank}
            {!playerInTop10 && ` (${data.playerRank.monthlyPoints.toLocaleString()} pts)`}
          </Typography>
        </Box>
      )}
    </Card>
  );
}
