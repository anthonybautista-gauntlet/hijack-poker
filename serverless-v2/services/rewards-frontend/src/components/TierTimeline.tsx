import { Box, Card, CardHeader, Skeleton, Typography, Alert, Button } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useGetTierHistoryQuery } from '../api/rewardsApi';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const tierTickFormatter = (val: number): string => {
  const labels: Record<number, string> = { 1: 'Bronze', 2: 'Silver', 3: 'Gold', 4: 'Platinum' };
  return labels[val] || '';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tooltipFormatter = (value: any): [string, string] => {
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  const labels: Record<number, string> = { 1: 'Bronze', 2: 'Silver', 3: 'Gold', 4: 'Platinum' };
  return [labels[num] || String(num), 'Tier'];
};

function formatMonthKey(monthKey: string): string {
  const parts = monthKey.split('-');
  if (parts.length === 2) {
    const monthIdx = parseInt(parts[1], 10) - 1;
    return MONTH_NAMES[monthIdx] || monthKey;
  }
  return monthKey;
}

export default function TierTimeline() {
  const { data, isLoading, isError, refetch } = useGetTierHistoryQuery();

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Tier History" />
        <Box sx={{ p: 3 }}>
          <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1 }} animation="wave" />
        </Box>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader title="Tier History" />
        <Box sx={{ p: 3 }}>
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={refetch}>Retry</Button>}
          >
            Failed to load tier history.
          </Alert>
        </Box>
      </Card>
    );
  }

  const tierHistory = data?.tierHistory;
  if (!tierHistory || tierHistory.length === 0) {
    return (
      <Card>
        <CardHeader title="Tier History" />
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <TimelineIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Tier history will appear after your first month.
          </Typography>
        </Box>
      </Card>
    );
  }

  const chartData = [...tierHistory].reverse().map((entry) => ({
    monthKey: formatMonthKey(entry.monthKey),
    tier: entry.tier,
  }));

  return (
    <Card>
      <CardHeader title="Tier History" />
      <Box sx={{ p: 3, pt: 0 }}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="tierGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6C63FF" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="monthKey"
              stroke="#8B949E"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            />
            <YAxis
              domain={[0, 5]}
              ticks={[1, 2, 3, 4]}
              tickFormatter={tierTickFormatter}
              stroke="#8B949E"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{
                backgroundColor: '#161B22',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 13,
              }}
              labelStyle={{ color: '#E6EDF3' }}
            />
            <Area
              type="stepAfter"
              dataKey="tier"
              stroke="#6C63FF"
              strokeWidth={2}
              fill="url(#tierGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Card>
  );
}
