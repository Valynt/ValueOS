/**
 * Billing Dashboard
 * Main billing page with usage, plans, and invoices
 */

import { AlertCircle, CreditCard, FileText, TrendingUp } from "lucide-react";
import React, { useEffect, useState } from "react";

import { logger } from "@/lib/logger";
import { apiClient } from "../../api/client/unified-api-client";
import { InvoiceList } from "../../components/Billing/InvoiceList";
import { PlanSelector } from "../../components/Billing/PlanSelector";
import { UsageMeter } from "../../components/Billing/UsageMeter";
import { BillingMetric, PlanTier } from "../../config/billing";
import { Invoice, Subscription, UsageSummary } from "../../types/billing";

export const BillingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"usage" | "plans" | "invoices">(
    "usage"
  );
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const [subRes, usageRes, invoicesRes] = await Promise.allSettled([
        apiClient.get<Subscription>("/api/billing/subscription"),
        apiClient.get<UsageSummary>("/api/billing/usage"),
        apiClient.get<{ invoices?: Invoice[] }>("/api/billing/invoices"),
      ]);
      if (subRes.status === "fulfilled") setSubscription(subRes.value.data ?? null);
      if (usageRes.status === "fulfilled") setUsage(usageRes.value.data ?? null);
      if (invoicesRes.status === "fulfilled") setInvoices(invoicesRes.value.data?.invoices ?? []);
    } catch (error) {
      logger.error("Failed to fetch billing data:", { error });
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = async (newPlan: PlanTier) => {
    const res = await apiClient.put("/api/billing/subscription", { planTier: newPlan });
    if (!res.success) {
      logger.error("Failed to update plan:", { message: res.error?.message });
      setError("Failed to update plan");
      return;
    }
    await fetchBillingData();
    setActiveTab("usage");
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    const res = await apiClient.get<{ pdfUrl: string }>(`/api/billing/invoices/${invoiceId}/pdf`);
    if (!res.success) {
      logger.error("Failed to download invoice:", { message: res.error?.message });
      return;
    }
    if (res.data?.pdfUrl) window.open(res.data.pdfUrl, "_blank", "noopener,noreferrer");
  };

  const handleViewInvoice = (invoiceId: string) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (invoice?.hosted_invoice_url) {
      window.open(invoice.hosted_invoice_url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Billing & Usage</h1>
        <p className="text-gray-600 mt-2">
          Manage your subscription, monitor usage, and view invoices
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Current Plan Card */}
      {subscription && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90">Current Plan</div>
              <div className="text-3xl font-bold mt-1">
                {subscription.plan_tier.charAt(0).toUpperCase() +
                  subscription.plan_tier.slice(1)}
              </div>
              <div className="text-sm opacity-90 mt-2">
                ${subscription.amount}/month • {subscription.status}
              </div>
            </div>
            <CreditCard className="w-16 h-16 opacity-50" />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("usage")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === "usage"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Usage</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("plans")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === "plans"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5" />
              <span>Plans</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("invoices")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === "invoices"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Invoices</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "usage" && (
          <div>
            {loading ? (
              <div className="text-center py-12">Loading usage data...</div>
            ) : usage ? (
              <div className="space-y-6">
                {/* Usage Meters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(usage.usage).map(([metric, amount]) => (
                    <div
                      key={metric}
                      className="bg-white p-6 rounded-lg shadow"
                    >
                      <UsageMeter
                        metric={metric as BillingMetric}
                        usage={amount}
                        quota={usage.quotas[metric as BillingMetric]}
                      />
                    </div>
                  ))}
                </div>

                {/* Upcoming Invoice Preview */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-4">
                    Projected Invoice
                  </h3>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Base Plan</span>
                    <span className="font-semibold">${usage.costs.base}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-600">Overage Charges</span>
                    <span className="font-semibold">
                      $
                      {Object.values(usage.costs.overage)
                        .reduce((sum, cost) => sum + cost, 0)
                        .toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-4 border-t">
                    <span className="text-lg font-bold">Total</span>
                    <span className="text-2xl font-bold text-blue-600">
                      ${usage.costs.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Usage Alerts */}
                {Object.entries(usage.percentages).some(
                  ([_, pct]) => pct >= 80
                ) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-yellow-900">
                            Usage Alert
                          </h4>
                          <p className="text-sm text-yellow-800 mt-1">
                            You're approaching your quota limits on some metrics.
                            Consider upgrading your plan.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-600">
                No usage data available
              </div>
            )}
          </div>
        )}

        {activeTab === "plans" && (
          <div>
            <PlanSelector
              currentPlan={subscription?.plan_tier}
              onSelectPlan={handlePlanChange}
              loading={loading}
            />
          </div>
        )}

        {activeTab === "invoices" && (
          <div>
            <InvoiceList
              invoices={invoices}
              loading={loading}
              onDownload={handleDownloadInvoice}
              onView={handleViewInvoice}
            />
          </div>
        )}
      </div>
    </div>
  );
};
