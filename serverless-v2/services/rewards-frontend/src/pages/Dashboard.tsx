import { Container, Grid } from '@mui/material';
import TierSummaryCard from '../components/TierSummaryCard';
import PointsHistoryTable from '../components/PointsHistoryTable';
import LeaderboardWidget from '../components/LeaderboardWidget';
import TierTimeline from '../components/TierTimeline';

function Dashboard() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TierSummaryCard />
        </Grid>
        <Grid item xs={12} md={7}>
          <PointsHistoryTable />
        </Grid>
        <Grid item xs={12} md={5}>
          <LeaderboardWidget />
        </Grid>
        <Grid item xs={12}>
          <TierTimeline />
        </Grid>
      </Grid>
    </Container>
  );
}

export default Dashboard;
