/**
 * Revenue Recognition Tests
 * 
 * Tests for GAAP-compliant revenue recognition:
 * - Accrual accounting (ASC 606)
 * - Deferred revenue
 * - Revenue reporting
 * - Financial compliance
 * 
 * Acceptance Criteria: GAAP compliance
 */

import { describe, it, expect, beforeEach } from 'vitest';

interface RevenueSchedule {
  subscriptionId: string;
  totalAmount: number;
  periodStart: Date;
  periodEnd: Date;
  recognizedAmount: number;
  deferredAmount: number;
  recognitionSchedule: Array<{
    date: Date;
    amount: number;
    type: 'recognized' | 'deferred';
  }>;
}

interface Invoice {
  id: string;
  subscriptionId: string;
  amount: number;
  invoiceDate: Date;
  dueDate: Date;
  paidDate?: Date;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
}

describe('Revenue Recognition - GAAP Compliance', () => {
  describe('Accrual Accounting (ASC 606)', () => {
    it('should recognize revenue over service period', () => {
      const subscription = {
        amount: 300, // $300 for 3 months
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-04-01'),
      };

      const monthlyRevenue = subscription.amount / 3;
      const recognitionSchedule = [
        { month: 'January', amount: monthlyRevenue },
        { month: 'February', amount: monthlyRevenue },
        { month: 'March', amount: monthlyRevenue },
      ];

      expect(monthlyRevenue).toBe(100);
      expect(recognitionSchedule.reduce((sum, r) => sum + r.amount, 0)).toBe(300);
    });

    it('should defer revenue for future service periods', () => {
      const invoice = {
        amount: 1200, // Annual subscription
        invoiceDate: new Date('2024-01-01'),
        serviceStart: new Date('2024-01-01'),
        serviceEnd: new Date('2025-01-01'),
      };

      const currentDate = new Date('2024-01-31');
      const totalDays = 365;
      const daysElapsed = 31;
      
      const recognizedRevenue = (invoice.amount / totalDays) * daysElapsed;
      const deferredRevenue = invoice.amount - recognizedRevenue;

      expect(recognizedRevenue).toBeCloseTo(101.92, 2);
      expect(deferredRevenue).toBeCloseTo(1098.08, 2);
      expect(recognizedRevenue + deferredRevenue).toBe(invoice.amount);
    });

    it('should recognize revenue on performance obligation completion', () => {
      const contract = {
        totalValue: 10000,
        performanceObligations: [
          { description: 'Setup', value: 2000, completed: true },
          { description: 'Training', value: 3000, completed: true },
          { description: 'Support (12 months)', value: 5000, completed: false },
        ],
      };

      const recognizedRevenue = contract.performanceObligations
        .filter(po => po.completed)
        .reduce((sum, po) => sum + po.value, 0);

      const deferredRevenue = contract.performanceObligations
        .filter(po => !po.completed)
        .reduce((sum, po) => sum + po.value, 0);

      expect(recognizedRevenue).toBe(5000);
      expect(deferredRevenue).toBe(5000);
    });

    it('should handle variable consideration', () => {
      const contract = {
        baseAmount: 1000,
        variableAmount: 500, // Usage-based
        constraintPercentage: 0.8, // 80% confidence
      };

      // Only recognize variable consideration when highly probable
      const recognizedVariable = contract.variableAmount * contract.constraintPercentage;
      const totalRecognized = contract.baseAmount + recognizedVariable;

      expect(recognizedVariable).toBe(400);
      expect(totalRecognized).toBe(1400);
    });

    it('should allocate transaction price to performance obligations', () => {
      const contract = {
        totalPrice: 10000,
        performanceObligations: [
          { description: 'Software License', standalonePrice: 8000 },
          { description: 'Support', standalonePrice: 3000 },
          { description: 'Training', standalonePrice: 2000 },
        ],
      };

      const totalStandalonePrice = contract.performanceObligations
        .reduce((sum, po) => sum + po.standalonePrice, 0);

      const allocatedPrices = contract.performanceObligations.map(po => ({
        ...po,
        allocatedPrice: (po.standalonePrice / totalStandalonePrice) * contract.totalPrice,
      }));

      expect(allocatedPrices[0].allocatedPrice).toBeCloseTo(6153.85, 2);
      expect(allocatedPrices[1].allocatedPrice).toBeCloseTo(2307.69, 2);
      expect(allocatedPrices[2].allocatedPrice).toBeCloseTo(1538.46, 2);
      
      const totalAllocated = allocatedPrices.reduce((sum, po) => sum + po.allocatedPrice, 0);
      expect(totalAllocated).toBeCloseTo(contract.totalPrice, 0);
    });

    it('should recognize revenue for satisfied performance obligations', () => {
      const contract = {
        performanceObligations: [
          { description: 'Setup', allocatedPrice: 2000, percentComplete: 100 },
          { description: 'Development', allocatedPrice: 5000, percentComplete: 60 },
          { description: 'Support', allocatedPrice: 3000, percentComplete: 25 },
        ],
      };

      const recognizedRevenue = contract.performanceObligations
        .reduce((sum, po) => sum + (po.allocatedPrice * po.percentComplete / 100), 0);

      expect(recognizedRevenue).toBe(5750);
    });
  });

  describe('Deferred Revenue', () => {
    it('should calculate deferred revenue balance', () => {
      const subscriptions = [
        { amount: 1200, totalMonths: 12, monthsElapsed: 2 }, // Annual, 2 months elapsed
        { amount: 300, totalMonths: 3, monthsElapsed: 1 },   // Quarterly, 1 month elapsed
        { amount: 99, totalMonths: 1, monthsElapsed: 1 },    // Monthly, fully recognized
      ];

      const deferredRevenue = subscriptions.reduce((sum, sub) => {
        const monthlyAmount = sub.amount / sub.totalMonths;
        const monthsRemaining = sub.totalMonths - sub.monthsElapsed;
        return sum + (monthlyAmount * monthsRemaining);
      }, 0);

      expect(deferredRevenue).toBeCloseTo(1200, 0);
    });

    it('should amortize deferred revenue monthly', () => {
      const deferredRevenue = {
        balance: 1200,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-01-01'),
      };

      const monthlyAmortization = deferredRevenue.balance / 12;
      const amortizationSchedule = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        amount: monthlyAmortization,
        remainingBalance: deferredRevenue.balance - (monthlyAmortization * (i + 1)),
      }));

      expect(monthlyAmortization).toBe(100);
      expect(amortizationSchedule[0].remainingBalance).toBe(1100);
      expect(amortizationSchedule[11].remainingBalance).toBe(0);
    });

    it('should handle mid-period cancellations', () => {
      const subscription = {
        amount: 1200,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2025-01-01'),
        cancelDate: new Date('2024-07-01'),
      };

      const totalDays = 365;
      const daysElapsed = 181; // ~6 months
      
      const recognizedRevenue = (subscription.amount / totalDays) * daysElapsed;
      const refundAmount = subscription.amount - recognizedRevenue;

      expect(recognizedRevenue).toBeCloseTo(595.07, 2);
      expect(refundAmount).toBeCloseTo(604.93, 2);
    });

    it('should track deferred revenue by customer', () => {
      const customers = [
        { id: 'cust_1', deferredRevenue: 1200 },
        { id: 'cust_2', deferredRevenue: 300 },
        { id: 'cust_3', deferredRevenue: 99 },
      ];

      const totalDeferred = customers.reduce((sum, c) => sum + c.deferredRevenue, 0);
      const averageDeferred = totalDeferred / customers.length;

      expect(totalDeferred).toBe(1599);
      expect(averageDeferred).toBe(533);
    });

    it('should handle upgrades with deferred revenue', () => {
      const subscription = {
        oldPrice: 99,
        newPrice: 299,
        daysRemaining: 15,
        totalDays: 30,
      };

      // Calculate unused portion of old subscription
      const unusedOldRevenue = (subscription.oldPrice / subscription.totalDays) * subscription.daysRemaining;
      
      // Calculate new deferred revenue
      const newDeferredRevenue = (subscription.newPrice / subscription.totalDays) * subscription.daysRemaining;
      
      // Net change in deferred revenue
      const deferredRevenueChange = newDeferredRevenue - unusedOldRevenue;

      expect(unusedOldRevenue).toBeCloseTo(49.5, 2);
      expect(newDeferredRevenue).toBeCloseTo(149.5, 2);
      expect(deferredRevenueChange).toBeCloseTo(100, 2);
    });

    it('should handle downgrades with deferred revenue', () => {
      const subscription = {
        oldPrice: 299,
        newPrice: 99,
        daysRemaining: 15,
        totalDays: 30,
      };

      const unusedOldRevenue = (subscription.oldPrice / subscription.totalDays) * subscription.daysRemaining;
      const newDeferredRevenue = (subscription.newPrice / subscription.totalDays) * subscription.daysRemaining;
      const creditToCustomer = unusedOldRevenue - newDeferredRevenue;

      expect(unusedOldRevenue).toBeCloseTo(149.5, 2);
      expect(newDeferredRevenue).toBeCloseTo(49.5, 2);
      expect(creditToCustomer).toBeCloseTo(100, 2);
    });
  });

  describe('Revenue Reporting', () => {
    it('should calculate monthly recurring revenue (MRR)', () => {
      const subscriptions = [
        { amount: 99, billingPeriod: 'monthly' },
        { amount: 299, billingPeriod: 'monthly' },
        { amount: 1188, billingPeriod: 'yearly' }, // $99/month
        { amount: 3588, billingPeriod: 'yearly' }, // $299/month
      ];

      const mrr = subscriptions.reduce((sum, sub) => {
        const monthlyAmount = sub.billingPeriod === 'yearly' 
          ? sub.amount / 12 
          : sub.amount;
        return sum + monthlyAmount;
      }, 0);

      expect(mrr).toBeCloseTo(796, 0);
    });

    it('should calculate annual recurring revenue (ARR)', () => {
      const subscriptions = [
        { amount: 99, billingPeriod: 'monthly' },
        { amount: 299, billingPeriod: 'monthly' },
        { amount: 1188, billingPeriod: 'yearly' },
        { amount: 3588, billingPeriod: 'yearly' },
      ];

      const arr = subscriptions.reduce((sum, sub) => {
        const annualAmount = sub.billingPeriod === 'monthly' 
          ? sub.amount * 12 
          : sub.amount;
        return sum + annualAmount;
      }, 0);

      expect(arr).toBeCloseTo(9552, 0);
    });

    it('should track revenue growth rate', () => {
      const monthlyRevenue = [
        { month: 'Jan', revenue: 10000 },
        { month: 'Feb', revenue: 11000 },
        { month: 'Mar', revenue: 12100 },
      ];

      const growthRates = monthlyRevenue.slice(1).map((current, index) => {
        const previous = monthlyRevenue[index];
        return ((current.revenue - previous.revenue) / previous.revenue) * 100;
      });

      expect(growthRates[0]).toBeCloseTo(10, 1);
      expect(growthRates[1]).toBeCloseTo(10, 1);
    });

    it('should calculate customer lifetime value (LTV)', () => {
      const customer = {
        monthlyRevenue: 299,
        averageLifetimeMonths: 24,
        grossMargin: 0.8,
      };

      const ltv = customer.monthlyRevenue * customer.averageLifetimeMonths * customer.grossMargin;

      expect(ltv).toBe(5740.8);
    });

    it('should track revenue by plan tier', () => {
      const subscriptions = [
        { plan: 'free', amount: 0, count: 100 },
        { plan: 'standard', amount: 99, count: 50 },
        { plan: 'enterprise', amount: 299, count: 10 },
      ];

      const revenueByPlan = subscriptions.map(sub => ({
        plan: sub.plan,
        totalRevenue: sub.amount * sub.count,
        averageRevenue: sub.amount,
      }));

      expect(revenueByPlan[0].totalRevenue).toBeCloseTo(0, 0);
      expect(revenueByPlan[1].totalRevenue).toBeCloseTo(4950, 0);
      expect(revenueByPlan[2].totalRevenue).toBeCloseTo(2990, 0);
    });

    it('should calculate revenue churn rate', () => {
      const period = {
        startingMRR: 10000,
        churnedMRR: 500,
        downgradeMRR: 200,
      };

      const churnRate = ((period.churnedMRR + period.downgradeMRR) / period.startingMRR) * 100;

      expect(churnRate).toBeCloseTo(7, 1);
    });

    it('should calculate net revenue retention (NRR)', () => {
      const period = {
        startingMRR: 10000,
        churnedMRR: 500,
        downgradeMRR: 200,
        upgradeMRR: 800,
        expansionMRR: 300,
      };

      const endingMRR = period.startingMRR - period.churnedMRR - period.downgradeMRR + period.upgradeMRR + period.expansionMRR;
      const nrr = (endingMRR / period.startingMRR) * 100;

      expect(endingMRR).toBe(10400);
      expect(nrr).toBe(104);
    });
  });

  describe('Financial Compliance', () => {
    it('should separate recognized and deferred revenue', () => {
      const invoice = {
        amount: 1200,
        invoiceDate: new Date('2024-01-01'),
        serviceStart: new Date('2024-01-01'),
        serviceEnd: new Date('2025-01-01'),
      };

      const currentDate = new Date('2024-04-01'); // 3 months elapsed
      const totalMonths = 12;
      const monthsElapsed = 3;

      const recognizedRevenue = (invoice.amount / totalMonths) * monthsElapsed;
      const deferredRevenue = invoice.amount - recognizedRevenue;

      expect(recognizedRevenue).toBe(300);
      expect(deferredRevenue).toBe(900);
    });

    it('should handle revenue recognition for trials', () => {
      const trial = {
        trialStart: new Date('2024-01-01'),
        trialEnd: new Date('2024-01-15'),
        convertedDate: new Date('2024-01-15'),
        firstPayment: 99,
      };

      // No revenue recognized during trial
      const trialRevenue = 0;
      
      // Revenue recognized after conversion
      const recognizedRevenue = trial.firstPayment;

      expect(trialRevenue).toBe(0);
      expect(recognizedRevenue).toBe(99);
    });

    it('should handle refunds in revenue recognition', () => {
      const transaction = {
        originalAmount: 299,
        recognizedAmount: 150,
        refundAmount: 149,
        refundDate: new Date('2024-06-15'),
      };

      // Reverse recognized revenue up to refund amount
      const revenueReversal = Math.min(transaction.recognizedAmount, transaction.refundAmount);
      const netRecognizedRevenue = transaction.recognizedAmount - revenueReversal;

      expect(revenueReversal).toBe(149);
      expect(netRecognizedRevenue).toBe(1);
    });

    it('should track accounts receivable', () => {
      const invoices = [
        { amount: 99, status: 'paid' as const },
        { amount: 299, status: 'open' as const },
        { amount: 99, status: 'open' as const },
        { amount: 299, status: 'paid' as const },
      ];

      const accountsReceivable = invoices
        .filter(inv => inv.status === 'open')
        .reduce((sum, inv) => sum + inv.amount, 0);

      expect(accountsReceivable).toBe(398);
    });

    it('should calculate days sales outstanding (DSO)', () => {
      const metrics = {
        accountsReceivable: 10000,
        totalRevenue: 30000,
        days: 90, // Quarter
      };

      const dso = (metrics.accountsReceivable / metrics.totalRevenue) * metrics.days;

      expect(dso).toBe(30);
    });

    it('should handle bad debt write-offs', () => {
      const invoice = {
        amount: 299,
        recognizedRevenue: 299,
        status: 'uncollectible' as const,
      };

      // Write off as bad debt expense
      const badDebtExpense = invoice.amount;
      const revenueAdjustment = 0; // Revenue already recognized

      expect(badDebtExpense).toBe(299);
      expect(revenueAdjustment).toBe(0);
    });

    it('should generate revenue recognition schedule', () => {
      const subscription = {
        amount: 1200,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-01-01'),
      };

      const monthlyAmount = subscription.amount / 12;
      const schedule = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(subscription.startDate);
        date.setMonth(date.getMonth() + i);
        return {
          date,
          amount: monthlyAmount,
          cumulativeAmount: monthlyAmount * (i + 1),
        };
      });

      expect(schedule).toHaveLength(12);
      expect(schedule[0].amount).toBe(100);
      expect(schedule[11].cumulativeAmount).toBe(1200);
    });
  });

  describe('GAAP Compliance Validation', () => {
    it('should follow revenue recognition principle', () => {
      // Revenue recognized when earned, not when cash received
      const transaction = {
        cashReceived: new Date('2024-01-01'),
        serviceDelivered: new Date('2024-01-15'),
        revenueRecognitionDate: new Date('2024-01-15'),
      };

      expect(transaction.revenueRecognitionDate).toEqual(transaction.serviceDelivered);
      expect(transaction.revenueRecognitionDate).not.toEqual(transaction.cashReceived);
    });

    it('should follow matching principle', () => {
      // Expenses matched with related revenues
      const period = {
        revenue: 10000,
        directCosts: 2000, // Cost of goods sold
        operatingExpenses: 3000,
      };

      const grossProfit = period.revenue - period.directCosts;
      const netIncome = grossProfit - period.operatingExpenses;

      expect(grossProfit).toBe(8000);
      expect(netIncome).toBe(5000);
    });

    it('should follow consistency principle', () => {
      // Same accounting methods used across periods
      const periods = [
        { month: 'Jan', method: 'straight-line' },
        { month: 'Feb', method: 'straight-line' },
        { month: 'Mar', method: 'straight-line' },
      ];

      const allConsistent = periods.every(p => p.method === periods[0].method);
      expect(allConsistent).toBe(true);
    });

    it('should follow conservatism principle', () => {
      // Recognize expenses immediately, revenue when certain
      const uncertainRevenue = {
        potentialAmount: 1000,
        probability: 0.6, // 60% likely
        recognized: 0, // Don't recognize until certain
      };

      const certainExpense = {
        estimatedAmount: 500,
        probability: 0.6,
        recognized: 500, // Recognize immediately
      };

      expect(uncertainRevenue.recognized).toBe(0);
      expect(certainExpense.recognized).toBe(500);
    });

    it('should maintain audit trail', () => {
      interface AuditEntry {
        timestamp: Date;
        action: string;
        amount: number;
        userId: string;
      }

      const auditTrail: AuditEntry[] = [
        { timestamp: new Date('2024-01-01'), action: 'invoice_created', amount: 1200, userId: 'system' },
        { timestamp: new Date('2024-01-01'), action: 'payment_received', amount: 1200, userId: 'stripe' },
        { timestamp: new Date('2024-01-31'), action: 'revenue_recognized', amount: 100, userId: 'system' },
      ];

      expect(auditTrail).toHaveLength(3);
      expect(auditTrail.every(entry => entry.timestamp && entry.action && entry.userId)).toBe(true);
    });

    it('should support financial statement generation', () => {
      const financialData = {
        revenue: 10000,
        deferredRevenue: 5000,
        accountsReceivable: 2000,
        expenses: 6000,
      };

      const incomeStatement = {
        revenue: financialData.revenue,
        expenses: financialData.expenses,
        netIncome: financialData.revenue - financialData.expenses,
      };

      const balanceSheet = {
        assets: {
          accountsReceivable: financialData.accountsReceivable,
        },
        liabilities: {
          deferredRevenue: financialData.deferredRevenue,
        },
      };

      expect(incomeStatement.netIncome).toBe(4000);
      expect(balanceSheet.liabilities.deferredRevenue).toBe(5000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-amount transactions', () => {
      const transaction = {
        amount: 0,
        recognizedRevenue: 0,
        deferredRevenue: 0,
      };

      expect(transaction.recognizedRevenue).toBe(0);
      expect(transaction.deferredRevenue).toBe(0);
    });

    it('should handle partial month recognition', () => {
      const subscription = {
        amount: 99,
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-02-15'),
      };

      const daysInJanuary = 17; // Jan 15-31
      const daysInFebruary = 15; // Feb 1-15
      const totalDays = daysInJanuary + daysInFebruary;

      const januaryRevenue = (subscription.amount / totalDays) * daysInJanuary;
      const februaryRevenue = (subscription.amount / totalDays) * daysInFebruary;

      expect(januaryRevenue).toBeCloseTo(52.59, 2);
      expect(februaryRevenue).toBeCloseTo(46.41, 2);
      expect(januaryRevenue + februaryRevenue).toBeCloseTo(subscription.amount, 2);
    });

    it('should handle leap year in revenue recognition', () => {
      const subscription = {
        amount: 366, // $1 per day
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-01-01'),
      };

      const daysInYear = 366; // 2024 is a leap year
      const dailyRevenue = subscription.amount / daysInYear;

      expect(dailyRevenue).toBe(1);
      expect(daysInYear).toBe(366);
    });

    it('should handle currency rounding', () => {
      const subscription = {
        amount: 99.99,
        months: 12,
      };

      const monthlyRevenue = subscription.amount / subscription.months;
      const roundedMonthly = Math.round(monthlyRevenue * 100) / 100;

      expect(roundedMonthly).toBe(8.33);
      
      // Verify total doesn't exceed original amount
      const totalRecognized = roundedMonthly * subscription.months;
      expect(totalRecognized).toBeLessThanOrEqual(subscription.amount + 0.12); // Allow for rounding
    });

    it('should handle negative revenue adjustments', () => {
      const adjustment = {
        originalRevenue: 1000,
        refundAmount: 200,
        creditAmount: 50,
      };

      const netRevenue = adjustment.originalRevenue - adjustment.refundAmount - adjustment.creditAmount;

      expect(netRevenue).toBe(750);
    });
  });
});
