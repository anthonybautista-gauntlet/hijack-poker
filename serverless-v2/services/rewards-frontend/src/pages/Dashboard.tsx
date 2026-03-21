import { Box, Container, Grid } from '@mui/material';
import TierSummaryCard from '../components/TierSummaryCard';
import PointsHistoryTable from '../components/PointsHistoryTable';

function Dashboard() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TierSummaryCard />
        </Grid>
        <Grid item xs={12}>
          <PointsHistoryTable />
        </Grid>
      </Grid>
    </Container>
  );
}

export default Dashboard;
