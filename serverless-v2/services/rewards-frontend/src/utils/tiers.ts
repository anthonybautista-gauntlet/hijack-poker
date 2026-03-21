/** Tier colors for visual indicators (badges, progress bars, etc.) */
export const TIER_COLORS: Record<number, string> = {
  1: '#CD7F32', // Bronze
  2: '#C0C0C0', // Silver
  3: '#FFD700', // Gold
  4: '#E5E4E2', // Platinum
};

/** Human-readable tier names */
export const TIER_NAMES: Record<number, string> = {
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
  4: 'Platinum',
};

/** Monthly points required to reach each tier */
export const TIER_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 500,
  3: 2000,
  4: 10000,
};

/** Tier multipliers applied to base points */
export const TIER_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 1.25,
  3: 1.5,
  4: 2.0,
};

/** Points color indicators */
export const POINTS_POSITIVE = '#3FB950'; // green — earned points
export const POINTS_NEGATIVE = '#F85149'; // red — deducted points / adjustments
