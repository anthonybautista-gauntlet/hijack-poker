'use strict';

const { calculateBasePoints, applyMultiplier, getStakeBracket } = require('../src/services/points.service');

describe('Points Service', () => {
  describe('calculateBasePoints', () => {
    it('returns 1 for bigBlind < $0.50', () => {
      expect(calculateBasePoints(0.10)).toBe(1);
      expect(calculateBasePoints(0.25)).toBe(1);
      expect(calculateBasePoints(0.49)).toBe(1);
    });

    it('returns 1 for bigBlind = 0 (lowest bracket)', () => {
      expect(calculateBasePoints(0)).toBe(1);
    });

    it('returns 2 for bigBlind $0.50 - $1.99', () => {
      expect(calculateBasePoints(0.50)).toBe(2);
      expect(calculateBasePoints(1.00)).toBe(2);
      expect(calculateBasePoints(1.99)).toBe(2);
    });

    it('returns 5 for bigBlind $2.00 - $9.99', () => {
      expect(calculateBasePoints(2.00)).toBe(5);
      expect(calculateBasePoints(5.00)).toBe(5);
      expect(calculateBasePoints(9.99)).toBe(5);
    });

    it('returns 10 for bigBlind $10.00+', () => {
      expect(calculateBasePoints(10.00)).toBe(10);
      expect(calculateBasePoints(25.00)).toBe(10);
      expect(calculateBasePoints(100.00)).toBe(10);
    });

    it('handles boundary values precisely', () => {
      expect(calculateBasePoints(0.49)).toBe(1);
      expect(calculateBasePoints(0.50)).toBe(2);
      expect(calculateBasePoints(1.99)).toBe(2);
      expect(calculateBasePoints(2.00)).toBe(5);
      expect(calculateBasePoints(9.99)).toBe(5);
      expect(calculateBasePoints(10.00)).toBe(10);
    });

    it('returns 1 for negative bigBlind values', () => {
      expect(calculateBasePoints(-1)).toBe(1);
      expect(calculateBasePoints(-100)).toBe(1);
    });

    it('returns 1 for tiny fractional bigBlind', () => {
      expect(calculateBasePoints(0.01)).toBe(1);
    });

    it('returns 10 for extremely large bigBlind values', () => {
      expect(calculateBasePoints(1000)).toBe(10);
      expect(calculateBasePoints(999999)).toBe(10);
    });
  });

  describe('applyMultiplier', () => {
    it('applies Bronze multiplier (1.0x)', () => {
      expect(applyMultiplier(5, 1)).toBe(5);
    });

    it('applies Silver multiplier (1.25x)', () => {
      expect(applyMultiplier(5, 2)).toBe(6.25);
    });

    it('applies Gold multiplier (1.5x)', () => {
      expect(applyMultiplier(5, 3)).toBe(7.5);
    });

    it('applies Platinum multiplier (2.0x)', () => {
      expect(applyMultiplier(5, 4)).toBe(10);
    });

    it('applies multiplier with base points of 1', () => {
      expect(applyMultiplier(1, 4)).toBe(2);
    });

    it('applies multiplier with base points of 10', () => {
      expect(applyMultiplier(10, 2)).toBe(12.5);
    });

    it('defaults to 1.0x for unknown tier level', () => {
      expect(applyMultiplier(5, 99)).toBe(5);
    });

    it('produces correct floating point results with Silver multiplier', () => {
      expect(applyMultiplier(3, 2)).toBe(3.75); // 3 * 1.25
    });

    it('produces correct floating point results with Gold multiplier', () => {
      expect(applyMultiplier(7, 3)).toBe(10.5); // 7 * 1.5
    });

    it('defaults to 1.0x for tier level 0 (invalid below range)', () => {
      expect(applyMultiplier(5, 0)).toBe(5);
    });

    it('defaults to 1.0x for tier level 5 (invalid above range)', () => {
      expect(applyMultiplier(5, 5)).toBe(5);
    });
  });

  describe('getStakeBracket', () => {
    it('returns "Micro" for bigBlind < $0.50', () => {
      expect(getStakeBracket(0.25)).toBe('Micro');
    });

    it('returns "Low" for bigBlind $0.50 - $1.99', () => {
      expect(getStakeBracket(1.00)).toBe('Low');
    });

    it('returns "Mid" for bigBlind $2.00 - $9.99', () => {
      expect(getStakeBracket(5.00)).toBe('Mid');
    });

    it('returns "High" for bigBlind $10.00+', () => {
      expect(getStakeBracket(25.00)).toBe('High');
    });
  });
});
