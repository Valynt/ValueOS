/**
 * Enhanced Billing Dashboard
 * Phase 3: End-User Experience & System Observability
 * 
 * Features:
 * - Color-coded usage metrics (>75% yellow, >90% red)
 * - Real-time usage monitoring
 * - Async feedback for all operations
 * - Comprehensive error handling
 */

import React, { useMemo } from 'react';
import {
  UsageMetricsGrid,
  UsageSummaryBanner,
  useUsageMetrics,
  COMMON_USAGE_METRICS,
} from '../../components/Billing/UsageMetrics';
import {
  AsyncFeedbackBanner,
  useAsyncState,
  SettingsErrorBoundary,
} from '../../components/Settings/SettingsAsyncFeedback';
import { FullPageLoading } from '../../components/Settings/SettingsLoadingState';
import { CreditCard, Calendar, Download, TrendingUp } from 'lucide-react';

interface BillingPlan {
  name: string;
  price: number;
  billingCycle: 'monthly' | 'annual';
  features: string[];
  limits: {
    users: number;
    storage: number;
    apiCalls: number;
  };
}

interface EnhancedBillingDashboardProps {
  organizationId: string;
}

export const EnhancedBillingDashboard: React.FC<EnhancedBillingDashboardProps> = ({
  organizationId,
}) => {
  // Phase 1 Fix 4: Memoize context
  const context = useMemo(() => ({ organizationId }), [organizationId]);

  // Fetch usage metrics with color-coded warnings
  const { metrics, loading, error, hasWarnings, hasCritical } = useUsageMetrics(organizationId);

  // Async state for plan changes
  const { state: upgradeState, execute: executeUpgrade, reset: resetUpgrade } = useAsyncState();

  // Mock current plan data
  const currentPlan: BillingPlan = {
    name: 'Professional',
    price: 99,
    billingCycle: 'monthly',
    features: [
      '10 active users',
      '10 GB storage',
      '1,000 API calls/month',
      'Priority support',
    ],
    limits: {
      users: 10,
      storage: 10,
      apiCalls: 1000,
    },
  };

  const nextBillingDate = new Date('2026-02-01');

  // Handle plan upgrade
  const handleUpgrade = async () => {
    await executeUpgrade(async () => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      // TODO: Implement actual upgrade logic
      console.log('Upgrading plan...');
    });
  };

  // Loading state
  if (loading) {
    return <FullPageLoading message="Loading billing information..." />;
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <AsyncFeedbackBanner
          state="error"
          errorMessage={`Failed to load billing information: ${error.message}`}
        />
      </div>
    );
  }

  return (
    <SettingsErrorBoundary>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Billing & Usage</h2>
          <p className="text-gray-600 mt-1">
            Manage your subscription and monitor usage
          </p>
        </div>

        {/* Upgrade Feedback */}
        <AsyncFeedbackBanner
          state={upgradeState}
          successMessage="Plan upgraded successfully!"
          errorMessage="Failed to upgrade plan. Please try again."
          onDismiss={resetUpgrade}
        />

        {/* Usage Summary Banner (shows if warnings/critical) */}
        <UsageSummaryBanner metrics={metrics} />

        {/* Current Plan Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Current Plan</h3>
              <p className="text-sm text-gray-600 mt-1">
                {currentPlan.name} - ${currentPlan.price}/{currentPlan.billingCycle === 'monthly' ? 'mo' : 'yr'}
              </p>
            </div>
            <button
              onClick={handleUpgrade}
              disabled={upgradeState === 'loading'}
              className={`
                px-4 py-2 rounded-lg font-medium transition-colors
                ${
                  hasCritical
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : hasWarnings
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {upgradeState === 'loading' ? 'Upgrading...' : 'Upgrade Plan'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Features */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Included Features</h4>
              <ul className="space-y-1">
                {currentPlan.features.map((feature, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Billing Info */}
            <div className="space-y-3">
              <div className="flex items-center text-sm">
                <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-gray-600">
                  Next billing date:{' '}
                  <span className="font-medium text-gray-900">
                    {nextBillingDate.toLocaleDateString()}
                  </span>
                </span>
              </div>
              <div className="flex items-center text-sm">
                <CreditCard className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-gray-600">
                  Payment method:{' '}
                  <span className="font-medium text-gray-900">•••• 4242</span>
                </span>
              </div>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Update payment method →
              </button>
            </div>
          </div>
        </div>

        {/* Usage Metrics with Color-Coded Warnings */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Usage This Month</h3>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center">
              <TrendingUp className="h-4 w-4 mr-1" />
              View detailed analytics
            </button>
          </div>
          <UsageMetricsGrid metrics={metrics} />
        </div>

        {/* Billing History */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Billing History</h3>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center">
              <Download className="h-4 w-4 mr-1" />
              Download all invoices
            </button>
          </div>

          <div className="space-y-3">
            {[
              { date: '2026-01-01', amount: 99, status: 'paid' },
              { date: '2025-12-01', amount: 99, status: 'paid' },
              { date: '2025-11-01', amount: 99, status: 'paid' },
            ].map((invoice, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center space-x-4">
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">
                      {new Date(invoice.date).toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-gray-600">${invoice.amount}.00</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded">
                    {invoice.status.toUpperCase()}
                  </span>
                  <button className="text-sm text-blue-600 hover:text-blue-700">
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Usage Alerts Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Usage Alerts</h4>
          <p className="text-sm text-blue-800">
            You'll receive email notifications when your usage reaches:
          </p>
          <ul className="text-sm text-blue-800 mt-2 space-y-1">
            <li>• <strong>75%</strong> of your plan limits (warning)</li>
            <li>• <strong>90%</strong> of your plan limits (critical)</li>
            <li>• <strong>100%</strong> of your plan limits (limit exceeded)</li>
          </ul>
        </div>
      </div>
    </SettingsErrorBoundary>
  );
};
