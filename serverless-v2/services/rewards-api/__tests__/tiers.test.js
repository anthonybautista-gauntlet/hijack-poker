'use strict';

const {
  TIERS,
  getTierInfo,
  getTierForPoints,
  checkTierAdvancement,
  calculateResetTier,
} = require('../src/services/tier.service');

const {
  createTierChangeNotification,
  checkMilestones,
} = require('../src/services/notification.service');

describe('Tier Service', () => {
  describe('TIERS constant', () => {
    it('has 4 tiers defined', () => {
      expect(TIERS).toHaveLength(4);
    });

    it('has correct tier definitions', () => {
      expect(TIERS[0]).toEqual({ level: 1, name: 'Bronze', threshold: 0, multiplier: 1.0 });
      expect(TIERS[1]).toEqual({ level: 2, name: 'Silver', threshold: 500, multiplier: 1.25 });
      expect(TIERS[2]).toEqual({ level: 3, name: 'Gold', threshold: 2000, multiplier: 1.5 });
      expect(TIERS[3]).toEqual({ level: 4, name: 'Platinum', threshold: 10000, multiplier: 2.0 });
    });
  });

  describe('getTierInfo', () => {
    it('returns correct tier for each level', () => {
      expect(getTierInfo(1).name).toBe('Bronze');
      expect(getTierInfo(2).name).toBe('Silver');
      expect(getTierInfo(3).name).toBe('Gold');
      expect(getTierInfo(4).name).toBe('Platinum');
    });

    it('returns null for invalid tier level', () => {
      expect(getTierInfo(0)).toBeNull();
      expect(getTierInfo(5)).toBeNull();
    });
  });

  describe('getTierForPoints', () => {
    it('returns Bronze (1) for 0 points', () => {
      expect(getTierForPoints(0)).toBe(1);
    });

    it('returns Bronze (1) for 499 points', () => {
      expect(getTierForPoints(499)).toBe(1);
    });

    it('returns Silver (2) for 500 points', () => {
      expect(getTierForPoints(500)).toBe(2);
    });

    it('returns Silver (2) for 1999 points', () => {
      expect(getTierForPoints(1999)).toBe(2);
    });

    it('returns Gold (3) for 2000 points', () => {
      expect(getTierForPoints(2000)).toBe(3);
    });

    it('returns Gold (3) for 9999 points', () => {
      expect(getTierForPoints(9999)).toBe(3);
    });

    it('returns Platinum (4) for 10000 points', () => {
      expect(getTierForPoints(10000)).toBe(4);
    });

    it('returns Platinum (4) for very high points', () => {
      expect(getTierForPoints(999999)).toBe(4);
    });

    it('returns Bronze (1) for negative points', () => {
      expect(getTierForPoints(-1)).toBe(1);
      expect(getTierForPoints(-1000)).toBe(1);
    });
  });

  describe('checkTierAdvancement', () => {
    it('returns advancement when crossing Silver threshold', () => {
      const result = checkTierAdvancement(1, 500);
      expect(result).not.toBeNull();
      expect(result.advanced).toBe(true);
      expect(result.newTier).toBe(2);
      expect(result.tierInfo.name).toBe('Silver');
    });

    it('returns advancement when crossing Gold threshold', () => {
      const result = checkTierAdvancement(2, 2000);
      expect(result).not.toBeNull();
      expect(result.advanced).toBe(true);
      expect(result.newTier).toBe(3);
    });

    it('returns advancement when crossing Platinum threshold', () => {
      const result = checkTierAdvancement(3, 10000);
      expect(result).not.toBeNull();
      expect(result.advanced).toBe(true);
      expect(result.newTier).toBe(4);
    });

    it('returns advancement skipping tiers (Bronze to Gold)', () => {
      const result = checkTierAdvancement(1, 2000);
      expect(result).not.toBeNull();
      expect(result.advanced).toBe(true);
      expect(result.newTier).toBe(3);
    });

    it('returns null when not crossing a threshold', () => {
      expect(checkTierAdvancement(1, 499)).toBeNull();
      expect(checkTierAdvancement(2, 1999)).toBeNull();
      expect(checkTierAdvancement(3, 9999)).toBeNull();
    });

    it('returns null when already at max tier', () => {
      expect(checkTierAdvancement(4, 50000)).toBeNull();
    });

    it('returns Platinum when points jump from 0 to 10000 (multi-tier skip)', () => {
      const result = checkTierAdvancement(1, 10000);
      expect(result).not.toBeNull();
      expect(result.advanced).toBe(true);
      expect(result.newTier).toBe(4);
      expect(result.tierInfo.name).toBe('Platinum');
    });
  });

  describe('calculateResetTier', () => {
    it('drops Platinum (4) to Gold (3)', () => {
      expect(calculateResetTier(4)).toBe(3);
    });

    it('drops Gold (3) to Silver (2)', () => {
      expect(calculateResetTier(3)).toBe(2);
    });

    it('drops Silver (2) to Bronze (1)', () => {
      expect(calculateResetTier(2)).toBe(1);
    });

    it('keeps Bronze (1) at Bronze (1)', () => {
      expect(calculateResetTier(1)).toBe(1);
    });

    it('is idempotent — calling twice on Bronze gives same result', () => {
      const first = calculateResetTier(1);
      const second = calculateResetTier(first);
      expect(first).toBe(1);
      expect(second).toBe(1);
    });
  });
});

describe('Notification Service', () => {
  describe('createTierChangeNotification', () => {
    it('creates upgrade notification', () => {
      const notification = createTierChangeNotification('player-1', 1, 2);
      expect(notification.type).toBe('tier_upgrade');
      expect(notification.title).toBe('Tier Upgrade!');
      expect(notification.message).toContain('Silver');
      expect(notification.playerId).toBe('player-1');
    });

    it('creates downgrade notification', () => {
      const notification = createTierChangeNotification('player-1', 3, 2);
      expect(notification.type).toBe('tier_downgrade');
      expect(notification.title).toBe('Tier Reset');
      expect(notification.message).toContain('Silver');
      expect(notification.playerId).toBe('player-1');
    });
  });

  describe('checkMilestones', () => {
    it('detects crossing 100 point milestone', () => {
      const milestones = checkMilestones(100, 99);
      expect(milestones).toHaveLength(1);
      expect(milestones[0].type).toBe('milestone');
      expect(milestones[0].message).toContain('100');
    });

    it('detects crossing multiple milestones at once', () => {
      const milestones = checkMilestones(1001, 95);
      expect(milestones).toHaveLength(3);
      const points = milestones.map(m => m.points);
      expect(points).toContain(100);
      expect(points).toContain(500);
      expect(points).toContain(1000);
    });

    it('returns empty array when no milestones crossed', () => {
      const milestones = checkMilestones(50, 40);
      expect(milestones).toHaveLength(0);
    });

    it('does not re-trigger already passed milestones', () => {
      const milestones = checkMilestones(600, 200);
      expect(milestones).toHaveLength(1);
      expect(milestones[0].points).toBe(500);
    });

    it('detects all milestones from 0 to 10000+', () => {
      const milestones = checkMilestones(10001, 0);
      expect(milestones).toHaveLength(5);
    });

    it('returns exactly [100] milestone when reaching 100 from 0', () => {
      const milestones = checkMilestones(100, 0);
      expect(milestones).toHaveLength(1);
      expect(milestones[0].points).toBe(100);
    });

    it('returns empty when just below 100 milestone', () => {
      const milestones = checkMilestones(99, 0);
      expect(milestones).toHaveLength(0);
    });

    it('returns only [500] when crossing 500 but not others', () => {
      const milestones = checkMilestones(600, 400);
      expect(milestones).toHaveLength(1);
      expect(milestones[0].points).toBe(500);
    });

    it('returns empty when already at milestone (no crossing)', () => {
      const milestones = checkMilestones(100, 100);
      expect(milestones).toHaveLength(0);
    });
  });
});
