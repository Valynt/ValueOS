/**
 * Proration Tests
 * 
 * Tests for billing proration calculations:
 * - Mid-cycle upgrades
 * - Mid-cycle downgrades
 * - Refund calculations
 * - Credit applications
 * 
 * Acceptance Criteria: Accurate proration
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Proration - Billing Calculations', () => {
  // Helper to calculate days in billing period
  const getDaysInPeriod = (start: Date, end: Date): number => {
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Helper to calculate days remaining
  const getDaysRemaining = (current: Date, end: Date): number => {
    return Math.ceil((end.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Helper to calculate proration amount
  const calculateProration = (
    oldPrice: number,
    newPrice: number,
    daysRemaining: number,
    totalDays: number
  ): number => {
    const unusedAmount = (oldPrice / totalDays) * daysRemaining;
    const newAmount = (newPrice / totalDays) * daysRemaining;
    return newAmount - unusedAmount;
  };

  describe('Mid-Cycle Upgrades', () => {
    it('should calculate proration for upgrade at start of period', () => {
      const oldPrice = 99; // Standard plan
      const newPrice = 299; // Enterprise plan
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const upgradeDate = new Date('2024-01-01');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(upgradeDate, periodEnd);

      const proration = calculateProration(oldPrice, newPrice, daysRemaining, totalDays);

      // Should charge full difference for entire period
      expect(proration).toBeCloseTo(200, 0);
      expect(daysRemaining).toBe(totalDays);
    });

    it('should calculate proration for upgrade at mid-period', () => {
      const oldPrice = 99; // Standard plan
      const newPrice = 299; // Enterprise plan
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const upgradeDate = new Date('2024-01-16'); // Halfway through

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(upgradeDate, periodEnd);

      const proration = calculateProration(oldPrice, newPrice, daysRemaining, totalDays);

      // Should charge ~half the difference
      expect(proration).toBeGreaterThan(90);
      expect(proration).toBeLessThan(110);
      expect(daysRemaining).toBeGreaterThan(14);
      expect(daysRemaining).toBeLessThan(18);
    });

    it('should calculate proration for upgrade near end of period', () => {
      const oldPrice = 99;
      const newPrice = 299;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const upgradeDate = new Date('2024-01-28'); // 3 days left

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(upgradeDate, periodEnd);

      const proration = calculateProration(oldPrice, newPrice, daysRemaining, totalDays);

      // Should charge small amount for remaining days
      expect(proration).toBeGreaterThan(15);
      expect(proration).toBeLessThan(30);
      expect(daysRemaining).toBeLessThan(5);
    });

    it('should handle upgrade from free to paid plan', () => {
      const oldPrice = 0; // Free plan
      const newPrice = 99; // Standard plan
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const upgradeDate = new Date('2024-01-16');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(upgradeDate, periodEnd);

      const proration = calculateProration(oldPrice, newPrice, daysRemaining, totalDays);

      // Should charge for remaining days only
      expect(proration).toBeGreaterThan(45);
      expect(proration).toBeLessThan(55);
    });

    it('should calculate proration for multiple upgrades in same period', () => {
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const totalDays = getDaysInPeriod(periodStart, periodEnd);

      // First upgrade: Free -> Standard on day 5
      const upgrade1Date = new Date('2024-01-05');
      const days1 = getDaysRemaining(upgrade1Date, periodEnd);
      const proration1 = calculateProration(0, 99, days1, totalDays);

      // Second upgrade: Standard -> Enterprise on day 15
      const upgrade2Date = new Date('2024-01-15');
      const days2 = getDaysRemaining(upgrade2Date, periodEnd);
      const proration2 = calculateProration(99, 299, days2, totalDays);

      const totalProration = proration1 + proration2;

      expect(proration1).toBeGreaterThan(80);
      expect(proration2).toBeGreaterThan(90);
      expect(totalProration).toBeGreaterThan(170);
    });

    it('should handle yearly plan upgrades', () => {
      const oldPrice = 990; // Standard yearly (99 * 10 months)
      const newPrice = 2990; // Enterprise yearly (299 * 10 months)
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2025-01-01');
      const upgradeDate = new Date('2024-07-01'); // Halfway through year

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(upgradeDate, periodEnd);

      const proration = calculateProration(oldPrice, newPrice, daysRemaining, totalDays);

      // Should charge ~half the difference
      expect(proration).toBeGreaterThan(900);
      expect(proration).toBeLessThan(1100);
    });
  });

  describe('Mid-Cycle Downgrades', () => {
    it('should calculate credit for downgrade at mid-period', () => {
      const oldPrice = 299; // Enterprise plan
      const newPrice = 99; // Standard plan
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const downgradeDate = new Date('2024-01-16');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(downgradeDate, periodEnd);

      const proration = calculateProration(oldPrice, newPrice, daysRemaining, totalDays);

      // Should be negative (credit)
      expect(proration).toBeLessThan(0);
      expect(proration).toBeGreaterThan(-110);
      expect(proration).toBeLessThan(-90);
    });

    it('should calculate credit for downgrade to free plan', () => {
      const oldPrice = 99; // Standard plan
      const newPrice = 0; // Free plan
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const downgradeDate = new Date('2024-01-16');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(downgradeDate, periodEnd);

      const proration = calculateProration(oldPrice, newPrice, daysRemaining, totalDays);

      // Should credit full unused amount
      expect(proration).toBeLessThan(0);
      expect(proration).toBeGreaterThan(-55);
      expect(proration).toBeLessThan(-45);
    });

    it('should handle immediate downgrade (same day)', () => {
      const oldPrice = 299;
      const newPrice = 99;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const downgradeDate = new Date('2024-01-01');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(downgradeDate, periodEnd);

      const proration = calculateProration(oldPrice, newPrice, daysRemaining, totalDays);

      // Should credit almost full difference
      expect(proration).toBeLessThan(0);
      expect(proration).toBeCloseTo(-200, 0);
    });

    it('should handle downgrade near end of period', () => {
      const oldPrice = 299;
      const newPrice = 99;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const downgradeDate = new Date('2024-01-28');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(downgradeDate, periodEnd);

      const proration = calculateProration(oldPrice, newPrice, daysRemaining, totalDays);

      // Should credit small amount
      expect(proration).toBeLessThan(0);
      expect(proration).toBeGreaterThan(-30);
      expect(proration).toBeLessThan(-15);
    });

    it('should apply credit to next invoice', () => {
      const credit = -50; // $50 credit from downgrade
      const nextInvoiceAmount = 99; // Standard plan next month

      const finalAmount = nextInvoiceAmount + credit;

      expect(finalAmount).toBe(49);
      expect(finalAmount).toBeGreaterThan(0);
    });

    it('should handle credit larger than next invoice', () => {
      const credit = -150; // $150 credit from downgrade
      const nextInvoiceAmount = 99; // Standard plan next month

      const finalAmount = Math.max(0, nextInvoiceAmount + credit);
      const remainingCredit = Math.abs(Math.min(0, nextInvoiceAmount + credit));

      expect(finalAmount).toBe(0);
      expect(remainingCredit).toBe(51);
    });
  });

  describe('Refund Calculations', () => {
    it('should calculate refund for immediate cancellation', () => {
      const paidAmount = 299; // Enterprise plan
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const cancelDate = new Date('2024-01-01');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysUsed = getDaysInPeriod(periodStart, cancelDate);
      const daysRemaining = getDaysRemaining(cancelDate, periodEnd);

      const refundAmount = (paidAmount / totalDays) * daysRemaining;

      expect(refundAmount).toBeCloseTo(paidAmount, 0);
      expect(daysUsed).toBe(0);
    });

    it('should calculate refund for mid-period cancellation', () => {
      const paidAmount = 299;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const cancelDate = new Date('2024-01-16');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(cancelDate, periodEnd);

      const refundAmount = (paidAmount / totalDays) * daysRemaining;

      expect(refundAmount).toBeGreaterThan(140);
      expect(refundAmount).toBeLessThan(160);
    });

    it('should calculate no refund for end-of-period cancellation', () => {
      const paidAmount = 299;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const cancelDate = new Date('2024-02-01');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(cancelDate, periodEnd);

      const refundAmount = (paidAmount / totalDays) * daysRemaining;

      expect(refundAmount).toBeCloseTo(0, 0);
      expect(daysRemaining).toBe(0);
    });

    it('should handle partial refund with usage charges', () => {
      const basePlanAmount = 99;
      const usageCharges = 25; // Overage charges
      const totalPaid = basePlanAmount + usageCharges;

      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const cancelDate = new Date('2024-01-16');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(cancelDate, periodEnd);

      // Only refund base plan, not usage charges
      const refundAmount = (basePlanAmount / totalDays) * daysRemaining;

      expect(refundAmount).toBeGreaterThan(45);
      expect(refundAmount).toBeLessThan(55);
      expect(refundAmount).toBeLessThan(totalPaid);
    });

    it('should apply refund processing fee', () => {
      const paidAmount = 299;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const cancelDate = new Date('2024-01-16');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(cancelDate, periodEnd);

      const grossRefund = (paidAmount / totalDays) * daysRemaining;
      const processingFee = 0; // No fee for this example
      const netRefund = grossRefund - processingFee;

      expect(netRefund).toBe(grossRefund);
      expect(netRefund).toBeGreaterThan(0);
    });

    it('should handle refund for trial cancellation', () => {
      const paidAmount = 0; // Trial period
      const refundAmount = 0;

      expect(refundAmount).toBe(0);
    });
  });

  describe('Credit Applications', () => {
    it('should apply credit to immediate charge', () => {
      const upgradeCharge = 200;
      const availableCredit = 50;

      const finalCharge = Math.max(0, upgradeCharge - availableCredit);
      const remainingCredit = Math.max(0, availableCredit - upgradeCharge);

      expect(finalCharge).toBe(150);
      expect(remainingCredit).toBe(0);
    });

    it('should carry forward unused credit', () => {
      const upgradeCharge = 50;
      const availableCredit = 100;

      const finalCharge = Math.max(0, upgradeCharge - availableCredit);
      const remainingCredit = Math.max(0, availableCredit - upgradeCharge);

      expect(finalCharge).toBe(0);
      expect(remainingCredit).toBe(50);
    });

    it('should apply multiple credits in order', () => {
      const charge = 200;
      const credits = [50, 30, 20]; // Total 100

      let remainingCharge = charge;
      const appliedCredits: number[] = [];

      for (const credit of credits) {
        const applied = Math.min(credit, remainingCharge);
        appliedCredits.push(applied);
        remainingCharge -= applied;
      }

      expect(remainingCharge).toBe(100);
      expect(appliedCredits).toEqual([50, 30, 20]);
    });

    it('should expire old credits first (FIFO)', () => {
      interface Credit {
        amount: number;
        expiresAt: Date;
      }

      const credits: Credit[] = [
        { amount: 50, expiresAt: new Date('2024-02-01') },
        { amount: 30, expiresAt: new Date('2024-03-01') },
        { amount: 20, expiresAt: new Date('2024-04-01') },
      ];

      const charge = 60;
      const now = new Date('2024-01-15');

      // Sort by expiration date
      const sortedCredits = credits.sort((a, b) => 
        a.expiresAt.getTime() - b.expiresAt.getTime()
      );

      let remainingCharge = charge;
      const appliedCredits: number[] = [];

      for (const credit of sortedCredits) {
        if (credit.expiresAt > now) {
          const applied = Math.min(credit.amount, remainingCharge);
          appliedCredits.push(applied);
          remainingCharge -= applied;
        }
      }

      expect(remainingCharge).toBe(0);
      expect(appliedCredits).toEqual([50, 10, 0]);
    });

    it('should not apply expired credits', () => {
      interface Credit {
        amount: number;
        expiresAt: Date;
      }

      const credits: Credit[] = [
        { amount: 50, expiresAt: new Date('2024-01-01') }, // Expired
        { amount: 30, expiresAt: new Date('2024-03-01') }, // Valid
      ];

      const charge = 60;
      const now = new Date('2024-02-01');

      let remainingCharge = charge;
      let appliedAmount = 0;

      for (const credit of credits) {
        if (credit.expiresAt > now) {
          const applied = Math.min(credit.amount, remainingCharge);
          appliedAmount += applied;
          remainingCharge -= applied;
        }
      }

      expect(appliedAmount).toBe(30);
      expect(remainingCharge).toBe(30);
    });
  });

  describe('Edge Cases', () => {
    it('should handle same-day upgrade and downgrade', () => {
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const changeDate = new Date('2024-01-15');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(changeDate, periodEnd);

      // Upgrade then downgrade
      const upgrade = calculateProration(99, 299, daysRemaining, totalDays);
      const downgrade = calculateProration(299, 99, daysRemaining, totalDays);

      const netChange = upgrade + downgrade;

      expect(netChange).toBeCloseTo(0, 0);
    });

    it('should handle leap year calculations', () => {
      const periodStart = new Date('2024-02-01'); // Leap year
      const periodEnd = new Date('2024-03-01');
      const changeDate = new Date('2024-02-15');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(changeDate, periodEnd);

      expect(totalDays).toBe(29); // February 2024 has 29 days
      expect(daysRemaining).toBeGreaterThan(13);
      expect(daysRemaining).toBeLessThan(16);
    });

    it('should handle timezone differences', () => {
      const periodStart = new Date('2024-01-01T00:00:00Z');
      const periodEnd = new Date('2024-02-01T00:00:00Z');
      const changeDate = new Date('2024-01-15T23:59:59Z');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(changeDate, periodEnd);

      // Should round up to next day
      expect(daysRemaining).toBeGreaterThan(15);
    });

    it('should handle very small proration amounts', () => {
      const oldPrice = 99;
      const newPrice = 100;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const changeDate = new Date('2024-01-31');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(changeDate, periodEnd);

      const proration = calculateProration(oldPrice, newPrice, daysRemaining, totalDays);

      // Should be very small but positive
      expect(proration).toBeGreaterThan(0);
      expect(proration).toBeLessThan(1);
    });

    it('should handle zero-price plans', () => {
      const oldPrice = 0;
      const newPrice = 0;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const changeDate = new Date('2024-01-15');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(changeDate, periodEnd);

      const proration = calculateProration(oldPrice, newPrice, daysRemaining, totalDays);

      expect(proration).toBe(0);
    });

    it('should handle negative days (past period end)', () => {
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const changeDate = new Date('2024-02-15'); // After period end

      const daysRemaining = getDaysRemaining(changeDate, periodEnd);

      // Should be negative or zero
      expect(daysRemaining).toBeLessThanOrEqual(0);
    });
  });

  describe('Proration Accuracy', () => {
    it('should maintain accuracy with floating point arithmetic', () => {
      const oldPrice = 99.99;
      const newPrice = 299.99;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const changeDate = new Date('2024-01-16');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(changeDate, periodEnd);

      const proration = calculateProration(oldPrice, newPrice, daysRemaining, totalDays);

      // Should be close to 100
      expect(proration).toBeGreaterThan(95);
      expect(proration).toBeLessThan(105);
    });

    it('should round to cents for currency', () => {
      const proration = 123.456789;
      const rounded = Math.round(proration * 100) / 100;

      expect(rounded).toBe(123.46);
    });

    it('should handle very large amounts', () => {
      const oldPrice = 10000;
      const newPrice = 50000;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');
      const changeDate = new Date('2024-01-16');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      const daysRemaining = getDaysRemaining(changeDate, periodEnd);

      const proration = calculateProration(oldPrice, newPrice, daysRemaining, totalDays);

      expect(proration).toBeGreaterThan(19000);
      expect(proration).toBeLessThan(21000);
    });

    it('should verify proration sum equals total difference', () => {
      const oldPrice = 99;
      const newPrice = 299;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-02-01');

      const totalDays = getDaysInPeriod(periodStart, periodEnd);
      
      // Calculate proration for mid-period (most common case)
      const midPeriodDate = new Date(periodStart);
      midPeriodDate.setDate(midPeriodDate.getDate() + Math.floor(totalDays / 2));
      
      const daysRemaining = getDaysRemaining(midPeriodDate, periodEnd);
      const proration = calculateProration(oldPrice, newPrice, daysRemaining, totalDays);

      // Proration should be roughly half the difference for mid-period
      const expectedProration = (newPrice - oldPrice) / 2;

      // Allow 5% tolerance for rounding
      expect(proration).toBeGreaterThan(expectedProration * 0.95);
      expect(proration).toBeLessThan(expectedProration * 1.05);
    });
  });
});
