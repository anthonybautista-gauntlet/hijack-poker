import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import PointsHistoryTable from '../PointsHistoryTable';
import type { PointsHistoryResponse, Transaction } from '../../api/rewardsApi';
import { POINTS_POSITIVE, POINTS_NEGATIVE } from '../../utils/tiers';

// Mock the rewardsApi module
const mockUseGetPointsHistoryQuery = vi.fn();
vi.mock('../../api/rewardsApi', () => ({
  useGetPointsHistoryQuery: (...args: unknown[]) => mockUseGetPointsHistoryQuery(...args),
}));

const theme = createTheme();

function renderWithProviders(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    timestamp: '2026-03-15T14:30:00Z',
    type: 'gameplay',
    tableStakes: '1/2',
    basePoints: 10,
    multiplier: 1.5,
    earnedPoints: 15,
    handId: 'h-001',
    ...overrides,
  };
}

function makeHistoryData(
  transactions: Transaction[] = [],
  total?: number,
): PointsHistoryResponse {
  return {
    transactions,
    pagination: {
      limit: 10,
      offset: 0,
      total: total ?? transactions.length,
    },
  };
}

describe('PointsHistoryTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders transaction rows with correct data', () => {
    const tx = makeTransaction({
      basePoints: 10,
      multiplier: 1.5,
      earnedPoints: 15,
      tableStakes: '1/2',
    });
    mockUseGetPointsHistoryQuery.mockReturnValue({
      data: makeHistoryData([tx]),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<PointsHistoryTable />);
    expect(screen.getByText('1/2')).toBeInTheDocument();
    // basePoints rendered inside a table cell - use getAllByText since '10' also appears in pagination
    const allTens = screen.getAllByText('10');
    expect(allTens.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1.5x')).toBeInTheDocument();
    expect(screen.getByText('+15')).toBeInTheDocument();
  });

  it('shows correct column headers', () => {
    mockUseGetPointsHistoryQuery.mockReturnValue({
      data: makeHistoryData([]),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<PointsHistoryTable />);
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('Multiplier')).toBeInTheDocument();
    expect(screen.getByText('Earned')).toBeInTheDocument();
  });

  it('color-codes positive points green and negative points red', () => {
    const positiveTx = makeTransaction({
      earnedPoints: 15,
      handId: 'h-pos',
    });
    const negativeTx = makeTransaction({
      earnedPoints: -5,
      handId: 'h-neg',
      type: 'adjustment',
    });
    mockUseGetPointsHistoryQuery.mockReturnValue({
      data: makeHistoryData([positiveTx, negativeTx]),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<PointsHistoryTable />);

    const positiveEl = screen.getByText('+15');
    const negativeEl = screen.getByText('-5');

    // Check inline style color via sx -> computed style
    expect(positiveEl).toHaveStyle({ color: POINTS_POSITIVE });
    expect(negativeEl).toHaveStyle({ color: POINTS_NEGATIVE });
  });

  it('shows empty state message when no transactions', () => {
    mockUseGetPointsHistoryQuery.mockReturnValue({
      data: makeHistoryData([]),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<PointsHistoryTable />);
    expect(
      screen.getByText('No transactions yet. Start playing to earn points!'),
    ).toBeInTheDocument();
  });

  it('shows loading skeletons when loading', () => {
    mockUseGetPointsHistoryQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    const { container } = renderWithProviders(<PointsHistoryTable />);
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    // 5 skeleton rows * 6 columns = 30 skeletons
    expect(skeletons.length).toBe(30);
  });

  it('pagination controls are visible when there are transactions', () => {
    const transactions = Array.from({ length: 3 }, (_, i) =>
      makeTransaction({ handId: `h-${i}`, earnedPoints: 10 + i }),
    );
    mockUseGetPointsHistoryQuery.mockReturnValue({
      data: makeHistoryData(transactions, 25),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<PointsHistoryTable />);
    // MUI TablePagination renders "Rows per page:" text
    expect(screen.getByText('Rows per page:')).toBeInTheDocument();
    // Shows count like "1-3 of 25" — MUI may use en-dash or hyphen
    expect(screen.getByText(/of 25/)).toBeInTheDocument();
  });

  it('formats dates correctly', () => {
    const tx = makeTransaction({
      timestamp: '2026-03-15T14:30:00Z',
    });
    mockUseGetPointsHistoryQuery.mockReturnValue({
      data: makeHistoryData([tx]),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<PointsHistoryTable />);
    // Intl.DateTimeFormat with dateStyle: 'medium' and timeStyle: 'short'
    // Should produce something like "Mar 15, 2026, 2:30 PM" (locale dependent)
    // We check for the date portion
    expect(screen.getByText(/Mar 15, 2026/)).toBeInTheDocument();
  });

  it('shows error alert when query fails', () => {
    mockUseGetPointsHistoryQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    renderWithProviders(<PointsHistoryTable />);
    expect(
      screen.getByText('Failed to load points history. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders type chip with correct label', () => {
    const tx = makeTransaction({ type: 'bonus', handId: 'h-bonus' });
    mockUseGetPointsHistoryQuery.mockReturnValue({
      data: makeHistoryData([tx]),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<PointsHistoryTable />);
    expect(screen.getByText('Bonus')).toBeInTheDocument();
  });
});
