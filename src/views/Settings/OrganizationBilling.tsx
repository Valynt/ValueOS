import React, { useState } from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import {
  CreditCard, Check, TrendingUp, Users, Database, Zap, Download, Calendar
} from 'lucide-react';
import { BillingPlan, BillingUsage } from '../../types';

const PLANS: BillingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tier: 'starter',
    price: 29,
    billingCycle: 'monthly',
    features: ['Up to 10 users', '50GB storage', '10,000 API calls/mo', 'Email support'],
    limits: { users: 10, storage: 50, apiCalls: 10000 },
  },
  {
    id: 'professional',
    name: 'Professional',
    tier: 'professional',
    price: 99,
    billingCycle: 'monthly',
    features: ['Up to 50 users', '500GB storage', '100,000 API calls/mo', 'Priority support', 'SSO'],
    limits: { users: 50, storage: 500, apiCalls: 100000 },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 'enterprise',
    price: 299,
    billingCycle: 'monthly',
    features: ['Unlimited users', '2TB storage', 'Unlimited API calls', '24/7 support', 'SSO & SCIM', 'Custom SLA'],
    limits: { users: -1, storage: 2000, apiCalls: -1 },
  },
];

export const OrganizationBilling: React.FC = () => {
  const [currentPlan] = useState<BillingPlan>(PLANS[1]);
  const [usage] = useState<BillingUsage>({
    users: 35,
    storage: 245,
    apiCalls: 67500,
    period: 'November 2024',
  });

  const getUsagePercent = (used: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'text-red-600 bg-red-100';
    if (percent >= 75) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  return (
    <div className="space-y-6">
      <SettingsSection title="Current Plan" description="Manage your subscription and billing">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="p-6 border-2 border-blue-500 rounded-lg bg-blue-50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{currentPlan.name}</h3>
                  <p className="text-gray-600">Your current plan</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900">${currentPlan.price}</p>
                  <p className="text-sm text-gray-600">/month</p>
                </div>
              </div>

              <div className="space-y-2">
                {currentPlan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center space-x-2 text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-blue-200 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Next billing date: Dec 1, 2024
                </div>
                <div className="flex space-x-2">
                  <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors">
                    Cancel Plan
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Upgrade Plan
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Payment Method</span>
                <CreditCard className="h-5 w-5 text-gray-400" />
              </div>
              <p className="font-medium text-gray-900">•••• 4242</p>
              <p className="text-xs text-gray-500 mt-1">Expires 12/25</p>
              <button className="mt-3 text-sm text-blue-600 hover:text-blue-700">
                Update payment method
              </button>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Billing Email</span>
              </div>
              <p className="font-medium text-gray-900">billing@example.com</p>
              <button className="mt-3 text-sm text-blue-600 hover:text-blue-700">
                Change email
              </button>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Usage Overview" description={`Current usage for ${usage.period}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Users</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${getUsageColor(getUsagePercent(usage.users, currentPlan.limits.users))}`}>
                {Math.round(getUsagePercent(usage.users, currentPlan.limits.users))}%
              </span>
            </div>
            <div className="mb-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${getUsagePercent(usage.users, currentPlan.limits.users)}%` }}
                />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{usage.users}</p>
            <p className="text-sm text-gray-600">
              of {currentPlan.limits.users === -1 ? 'unlimited' : currentPlan.limits.users} users
            </p>
          </div>

          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Storage</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${getUsageColor(getUsagePercent(usage.storage, currentPlan.limits.storage))}`}>
                {Math.round(getUsagePercent(usage.storage, currentPlan.limits.storage))}%
              </span>
            </div>
            <div className="mb-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${getUsagePercent(usage.storage, currentPlan.limits.storage)}%` }}
                />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{usage.storage}GB</p>
            <p className="text-sm text-gray-600">of {currentPlan.limits.storage}GB storage</p>
          </div>

          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">API Calls</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${getUsageColor(getUsagePercent(usage.apiCalls, currentPlan.limits.apiCalls))}`}>
                {Math.round(getUsagePercent(usage.apiCalls, currentPlan.limits.apiCalls))}%
              </span>
            </div>
            <div className="mb-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${getUsagePercent(usage.apiCalls, currentPlan.limits.apiCalls)}%` }}
                />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{usage.apiCalls.toLocaleString()}</p>
            <p className="text-sm text-gray-600">
              of {currentPlan.limits.apiCalls === -1 ? 'unlimited' : currentPlan.limits.apiCalls.toLocaleString()} calls
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Available Plans" description="Compare plans and upgrade anytime">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`p-6 border-2 rounded-lg ${
                plan.id === currentPlan.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.id === currentPlan.id ? (
                <button disabled className="w-full py-2 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed">
                  Current Plan
                </button>
              ) : (
                <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  {plan.price > currentPlan.price ? 'Upgrade' : 'Downgrade'}
                </button>
              )}
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Billing History" description="View and download past invoices">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div>
                <p className="font-medium text-gray-900">Invoice #{1000 + i}</p>
                <p className="text-sm text-gray-600">
                  {new Date(2024, 11 - i, 1).toLocaleDateString()} • $99.00
                </p>
              </div>
              <button className="flex items-center text-sm text-blue-600 hover:text-blue-700">
                <Download className="h-4 w-4 mr-1" />
                Download
              </button>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
};
