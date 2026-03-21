import { Box, Card, CardHeader, Skeleton, Typography } from '@mui/material';
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

interface TierHistoryPoint {
  monthKey: string;
  tier: number;
  tierName: string;
}

// Mock data for demonstration — will be replaced when tier-history API is available
function getMockTierHistory(): TierHistoryPoint[] {
  const now = new Date();
  const tierNames: Record<number, string> = {
    1: 'Bronze',
    2: 'Silver',
    3: 'Gold',
    4: 'Platinum',
  };
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mockTiers = [1, 1, 2, 2, 3, 3];
  const result: TierHistoryPoint[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const tier = mockTiers[5 - i];
    result.push({
      monthKey: monthNames[d.getMonth()],
      tier,
      tierName: tierNames[tier],
    });
  }

  return result;
}

interface TierTimelineProps {
  data?: TierHistoryPoint[];
  isLoading?: boolean;
}

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

export default function TierTimeline({ data, isLoading }: TierTimelineProps) {
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

  const tierHistory = data && data.length > 0 ? data : getMockTierHistory();

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

  return (
    <Card>
      <CardHeader title="Tier History" />
      <Box sx={{ p: 3, pt: 0 }}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={tierHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
