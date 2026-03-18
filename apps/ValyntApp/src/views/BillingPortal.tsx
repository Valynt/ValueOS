/**
 * BillingPortal
 *
 * Page view for billing management: usage meters, plan comparison, invoices, approvals.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §5.6
 */

import React, { useState } from "react";
import { CreditCard, Receipt, Users, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CanvasHost, SDUIWidget } from "@/components/canvas/CanvasHost";
import {
  useBillingSummary,
  usePlans,
  useInvoices,
  useUsage,
  useApprovals,
  useDecideApproval,
} from "@/hooks/useBilling";

export function BillingPortal() {
  const [activeTab, setActiveTab] = useState("usage");

  const { data: billingSummary, isLoading: summaryLoading, error: summaryError } = useBillingSummary();
  const { data: plans, isLoading: plansLoading } = usePlans();
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  const { data: usage, isLoading: usageLoading } = useUsage();
  const { data: approvals, isLoading: approvalsLoading } = useApprovals();

  const decideApproval = useDecideApproval();

  const isLoading = summaryLoading || plansLoading || invoicesLoading || usageLoading || approvalsLoading;
  const error = summaryError;

  const handleApprovalDecision = (approvalId: string, decision: "approve" | "reject") => {
    decideApproval.mutate({ approvalId, decision });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load billing data</AlertTitle>
        <AlertDescription>{error?.message || "Unknown error occurred"}</AlertDescription>
      </Alert>
    );
  }

  // Build widgets from usage data
  const usageWidgets: SDUIWidget[] =
    usage?.meters.map((meter) => ({
      id: `usage-${meter.key}`,
      componentType: "usage-meter",
      props: {
        meterName: meter.name,
        meterKey: meter.key,
        used: meter.used,
        cap: meter.cap,
        unit: meter.unit,
        resetDate: usage.period.end,
        trend: meter.trend,
        trendPercentage: meter.trendPercentage,
      },
    })) ?? [];

  const planComparisonWidget: SDUIWidget = {
    id: "plan-comparison",
    componentType: "plan-comparison",
    props: {
      plans: plans ?? [],
      currentPlanId: billingSummary?.subscription?.currentPlanId,
    },
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Billing Portal</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your subscription, usage, and payments
            </p>
          </div>
          {billingSummary?.subscription && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="font-semibold">{billingSummary.subscription.currentPlan}</p>
              <p className="text-xs text-muted-foreground">
                Renews {new Date(billingSummary.subscription.renewalDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="usage">
              <CreditCard className="w-4 h-4 mr-2" />
              Usage
            </TabsTrigger>
            <TabsTrigger value="plans">
              <CreditCard className="w-4 h-4 mr-2" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <Receipt className="w-4 h-4 mr-2" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="approvals">
              <Users className="w-4 h-4 mr-2" />
              Approvals
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usage" className="mt-6">
            <div className="max-w-4xl mx-auto">
              {usageWidgets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CanvasHost widgets={usageWidgets} />
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No usage data available</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="plans" className="mt-6">
            <CanvasHost widgets={[planComparisonWidget]} />
          </TabsContent>

          <TabsContent value="invoices" className="mt-6">
            <div className="max-w-4xl mx-auto">
              {invoices && invoices.length > 0 ? (
                <div className="rounded-xl border bg-card">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-medium">Invoice #</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Period</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Amount</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 px-4 text-sm">{invoice.number}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {new Date(invoice.period.start).toLocaleDateString()} -
                            {new Date(invoice.period.end).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium">
                            ${invoice.amount.toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                invoice.status === "paid"
                                  ? "bg-green-100 text-green-800"
                                  : invoice.status === "open"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {invoice.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {new Date(invoice.dueDate).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No invoices available</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="approvals" className="mt-6">
            <div className="max-w-4xl mx-auto">
              {approvals && approvals.length > 0 ? (
                <div className="space-y-4">
                  {approvals.map((approval) => (
                    <div key={approval.id} className="p-4 border rounded-lg bg-card">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{approval.action}</p>
                          <p className="text-sm text-muted-foreground">{approval.details}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Requested by {approval.requester.name} on{" "}
                            {new Date(approval.requestedAt).toLocaleDateString()}
                          </p>
                          {approval.deltaMrr !== 0 && (
                            <p
                              className={`text-sm font-medium mt-2 ${
                                approval.deltaMrr > 0 ? "text-red-600" : "text-green-600"
                              }`}
                            >
                              MRR Impact: {approval.deltaMrr > 0 ? "+" : ""}$
                              {approval.deltaMrr.toLocaleString()}/month
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprovalDecision(approval.id, "reject")}
                            disabled={decideApproval.isPending}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprovalDecision(approval.id, "approve")}
                            disabled={decideApproval.isPending}
                          >
                            Approve
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No pending approvals</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default BillingPortal;
