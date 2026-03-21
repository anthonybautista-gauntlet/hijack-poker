import { useState } from 'react';
import {
  Box,
  Card,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  Chip,
  Skeleton,
  Alert,
  Button,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useGetPointsHistoryQuery } from '../api/rewardsApi';
import { POINTS_POSITIVE, POINTS_NEGATIVE } from '../utils/tiers';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getTypeChipColor(type: string): 'default' | 'primary' | 'warning' {
  switch (type) {
    case 'bonus':
      return 'primary';
    case 'adjustment':
      return 'warning';
    default:
      return 'default';
  }
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton variant="text" animation="wave" /></TableCell>
          <TableCell><Skeleton variant="text" width={70} animation="wave" /></TableCell>
          <TableCell><Skeleton variant="text" width={50} animation="wave" /></TableCell>
          <TableCell><Skeleton variant="text" width={40} animation="wave" /></TableCell>
          <TableCell><Skeleton variant="text" width={40} animation="wave" /></TableCell>
          <TableCell><Skeleton variant="text" width={50} animation="wave" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function PointsHistoryTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { data, isLoading, isError, refetch } = useGetPointsHistoryQuery({
    limit: rowsPerPage,
    offset: page * rowsPerPage,
  });

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Card>
      <CardHeader title="Points History" />

      {isError && (
        <Box sx={{ px: 2, pb: 2 }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={refetch}>
                Retry
              </Button>
            }
          >
            Failed to load points history. Please try again.
          </Alert>
        </Box>
      )}

      {!isError && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 160 }}>Date</TableCell>
                <TableCell sx={{ width: 100 }}>Type</TableCell>
                <TableCell sx={{ width: 80 }} align="center">Table</TableCell>
                <TableCell sx={{ width: 70 }} align="right">Base</TableCell>
                <TableCell sx={{ width: 90 }} align="right">Multiplier</TableCell>
                <TableCell sx={{ width: 80 }} align="right">Earned</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && <SkeletonRows count={5} />}

              {!isLoading && data && data.transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ borderBottom: 0 }}>
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <ReceiptLongIcon
                        sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5 }}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        No transactions yet. Start playing to earn points!
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}

              {!isLoading &&
                data &&
                data.transactions.map((tx) => (
                  <TableRow
                    key={tx.handId}
                    sx={{
                      '&:hover': {
                        bgcolor: 'rgba(108, 99, 255, 0.04)',
                        transition: 'background-color 0.15s ease',
                      },
                      '&:last-child td': { borderBottom: 0 },
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2">
                        {dateFormatter.format(new Date(tx.timestamp))}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={formatType(tx.type)}
                        size="small"
                        variant="outlined"
                        color={getTypeChipColor(tx.type)}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">{tx.tableStakes || '-'}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{tx.basePoints}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{tx.multiplier}x</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{
                          color: tx.earnedPoints >= 0 ? POINTS_POSITIVE : POINTS_NEGATIVE,
                        }}
                      >
                        {tx.earnedPoints >= 0 ? '+' : ''}
                        {tx.earnedPoints}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!isError && data && data.pagination.total > 0 && (
        <TablePagination
          component="div"
          count={data.pagination.total}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50]}
        />
      )}
    </Card>
  );
}
