import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import TierSummaryCard from '../TierSummaryCard';
import type { PlayerRewards } from '../../api/rewardsApi';

// Mock the rewardsApi module
const mockUseGetPlayerRewardsQuery = vi.fn();
vi.mock('../../api/rewardsApi', () => ({
  useGetPlayerRewardsQuery: (...args: unknown[]) => mockUseGetPlayerRewardsQuery(...args),
}));

const theme = createTheme();

function renderWithProviders(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function makeRewardsData(overrides: Partial<PlayerRewards> = {}): PlayerRewards {
  return {
    playerId: 'p1',
    displayName: 'TestPlayer',
    currentTier: { level: 3, name: 'Gold', multiplier: 1.5 },
    monthlyPoints: 2500,
    lifetimePoints: 45000,
    nextTier: {
      level: 4,
      name: 'Platinum',
      threshold: 10000,
      pointsNeeded: 7500,
      progressPercent: 25,
    },
    monthKey: '2026-03',
    ...overrides,
  };
}

describe('TierSummaryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders current tier name as a chip', () => {
    mockUseGetPlayerRewardsQuery.mockReturnValue({
      data: makeRewardsData(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<TierSummaryCard />);
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('displays monthly points correctly formatted', () => {
    mockUseGetPlayerRewardsQuery.mockReturnValue({
      data: makeRewardsData({ monthlyPoints: 2500 }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<TierSummaryCard />);
    expect(screen.getByText('2,500 pts this month')).toBeInTheDocument();
  });

  it('displays lifetime points', () => {
    mockUseGetPlayerRewardsQuery.mockReturnValue({
      data: makeRewardsData({ lifetimePoints: 45000 }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<TierSummaryCard />);
    expect(screen.getByText('Lifetime: 45,000 pts')).toBeInTheDocument();
  });

  it('shows progress bar with correct percentage', () => {
    mockUseGetPlayerRewardsQuery.mockReturnValue({
      data: makeRewardsData(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<TierSummaryCard />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '25');
  });

  it('shows points-to-next-tier text', () => {
    mockUseGetPlayerRewardsQuery.mockReturnValue({
      data: makeRewardsData(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<TierSummaryCard />);
    expect(screen.getByText('25% to Platinum (7,500 pts needed)')).toBeInTheDocument();
  });

  it('handles Platinum tier (max tier reached)', () => {
    const platinumData = makeRewardsData({
      currentTier: { level: 4, name: 'Platinum', multiplier: 2.0 },
      nextTier: null,
    });
    mockUseGetPlayerRewardsQuery.mockReturnValue({
      data: platinumData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<TierSummaryCard />);
    expect(screen.getByText('Platinum')).toBeInTheDocument();
    expect(screen.getByText('Max tier reached!')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '100');
  });

  it('shows loading skeleton when query is loading', () => {
    mockUseGetPlayerRewardsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    const { container } = renderWithProviders(<TierSummaryCard />);
    // MUI Skeleton renders with class MuiSkeleton-root
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error alert when query fails', () => {
    mockUseGetPlayerRewardsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    renderWithProviders(<TierSummaryCard />);
    expect(screen.getByText('Failed to load rewards summary. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('displays the tier multiplier', () => {
    mockUseGetPlayerRewardsQuery.mockReturnValue({
      data: makeRewardsData(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<TierSummaryCard />);
    expect(screen.getByText('1.5x')).toBeInTheDocument();
    expect(screen.getByText('multiplier')).toBeInTheDocument();
  });
});
