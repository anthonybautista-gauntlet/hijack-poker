import {
  Box,
  Card,
  Chip,
  LinearProgress,
  Skeleton,
  Typography,
  Alert,
  Button,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useGetPlayerRewardsQuery } from '../api/rewardsApi';
import { TIER_COLORS, TIER_NAMES } from '../utils/tiers';

function TierSummaryCardSkeleton() {
  return (
    <Card sx={{ p: 3, display: 'flex', gap: 3 }}>
      <Skeleton variant="circular" width={56} height={56} animation="wave" />
      <Box flex={1}>
        <Skeleton variant="text" width="40%" height={32} animation="wave" />
        <Skeleton
          variant="rectangular"
          height={10}
          sx={{ borderRadius: 5, my: 1 }}
          animation="wave"
        />
        <Skeleton variant="text" width="30%" animation="wave" />
      </Box>
      <Skeleton variant="text" width={60} height={48} animation="wave" />
    </Card>
  );
}

export default function TierSummaryCard() {
  const { data, isLoading, isError, refetch } = useGetPlayerRewardsQuery();
  const muiTheme = useTheme();
  const isSmall = useMediaQuery(muiTheme.breakpoints.down('md'));

  if (isLoading) return <TierSummaryCardSkeleton />;

  if (isError) {
    return (
      <Card sx={{ p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={refetch}>
              Retry
            </Button>
          }
        >
          Failed to load rewards summary. Please try again.
        </Alert>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          No rewards data yet
        </Typography>
      </Card>
    );
  }

  const tierLevel = data.currentTier.level;
  const tierColor = TIER_COLORS[tierLevel] || TIER_COLORS[1];
  const tierName = TIER_NAMES[tierLevel] || TIER_NAMES[1];
  const isMaxTier = data.nextTier === null;
  const progressPercent = isMaxTier ? 100 : (data.nextTier?.progressPercent ?? 0);
  const pointsNeeded = data.nextTier?.pointsNeeded ?? 0;
  const nextTierName = data.nextTier?.name ?? '';

  return (
    <Card
      sx={{
        borderLeft: `4px solid ${tierColor}`,
        p: 3,
        display: 'flex',
        alignItems: isSmall ? 'stretch' : 'center',
        flexDirection: isSmall ? 'column' : 'row',
        gap: 3,
      }}
    >
      {/* Tier Badge */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: 100,
        }}
      >
        <EmojiEventsIcon sx={{ fontSize: 40, color: tierColor }} />
        <Chip
          label={tierName}
          sx={{
            mt: 1,
            bgcolor: tierColor,
            color: '#0D1117',
            fontWeight: 700,
            fontSize: '0.8rem',
            letterSpacing: '0.05em',
            px: 1,
          }}
        />
      </Box>

      {/* Points + Progress */}
      <Box sx={{ flex: 1 }}>
        <Typography variant="h4" fontWeight={700}>
          {data.monthlyPoints.toLocaleString()} pts this month
        </Typography>

        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{
            height: 10,
            borderRadius: 5,
            my: 1,
            bgcolor: 'rgba(108, 99, 255, 0.15)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 5,
              bgcolor: 'primary.main',
              transition: 'transform 0.8s ease-in-out',
            },
          }}
        />

        <Typography variant="body2" color="text.secondary">
          {isMaxTier
            ? 'Max tier reached!'
            : `${Math.round(progressPercent)}% to ${nextTierName} (${pointsNeeded.toLocaleString()} pts needed)`}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Lifetime: {data.lifetimePoints.toLocaleString()} pts
        </Typography>
      </Box>

      {/* Multiplier */}
      <Box sx={{ textAlign: 'center', minWidth: 80 }}>
        <Typography variant="h3" fontWeight={700} color="primary.main">
          {data.currentTier.multiplier}x
        </Typography>
        <Typography variant="caption" color="text.secondary">
          multiplier
        </Typography>
      </Box>
    </Card>
  );
}
