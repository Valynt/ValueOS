/**
 * BillingSettings - Usage & Billing (Meta-ROI Dashboard)
 * 
 * Strategic billing page that proves ValueOS pays for itself.
 * Shows platform ROI, usage breakdown, billing details, and expansion triggers.
 */

import { useState } from "react";
import {
  Rocket,
  TrendingUp,
  Users,
  Briefcase,
  CreditCard,
  Download,
  ChevronRight,
  AlertTriangle,
  Check,
  Zap,
  Shield,
  Palette,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Mock data
const PLATFORM_ROI = {
  subscriptionCost: 12000,
  valueCasesGenerated: 15000000,
  pipelineInfluenced: 4200000,
  casesCreated: 127,
  avgDealSize: 118000,
};

const USAGE = {
  seats: { used: 8, total: 10 },
  cases: { used: 450, total: 500 },
  aiCredits: { used: 847, total: 1000, resetsInDays: 21 },
};

const FEATURE_ADOPTION = [
  { name: "CRM Integration", status: "connected" as const },
  { name: "Intel Stream", status: "active" as const },
  { name: "PDF Exports", status: "used" as const },
  { name: "Team Collaboration", status: "inactive" as const },
];

const BILLING = {
  plan: "Growth",
  billingCycle: "Annual",
  nextBillDate: "Oct 24, 2026",
  nextBillAmount: 12000,
  renewsInDays: 45,
  autoRenew: true,
  paymentMethod: {
    type: "Visa",
    last4: "4242",
  },
};

const INVOICES = [
  { id: "INV-2025-001", date: "Oct 24, 2025", amount: 12000, status: "paid" as const },
  { id: "INV-2024-001", date: "Oct 24, 2024", amount: 10000, status: "paid" as const },
  { id: "INV-2023-001", date: "Oct 24, 2023", amount: 10000, status: "paid" as const },
];

const ENTERPRISE_FEATURES = [
  "SSO / SAML Authentication",
  "Unlimited Intel Stream signals",
  "Custom Branding",
  "Dedicated Success Manager",
  "API Access",
];

export function BillingSettings() {
  const [autoRenew, setAutoRenew] = useState(BILLING.autoRenew);

  const roiMultiple = Math.round(PLATFORM_ROI.valueCasesGenerated / PLATFORM_ROI.subscriptionCost);
  const roiPercent = ((PLATFORM_ROI.valueCasesGenerated / PLATFORM_ROI.subscriptionCost) * 100).toFixed(0);

  const seatsPercent = (USAGE.seats.used / USAGE.seats.total) * 100;
  const casesPercent = (USAGE.cases.used / USAGE.cases.total) * 100;
  const creditsPercent = (USAGE.aiCredits.used / USAGE.aiCredits.total) * 100;

  const isNearCapacity = casesPercent >= 90;
  const renewalUrgent = BILLING.renewsInDays <= 30;

  return (
    <div className="space-y-6">
      {/* Header */}
      <h2 className="text-xl font-semibold">Usage & Billing</h2>

      {/* Meta-Value ROI Card */}
      <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-emerald-500/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">
                Platform ROI
              </h3>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    ${(PLATFORM_ROI.valueCasesGenerated / 1000000).toFixed(1)}M
                  </p>
                  <p className="text-sm text-muted-foreground">Value Cases Created</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    ${(PLATFORM_ROI.pipelineInfluenced / 1000000).toFixed(1)}M
                  </p>
                  <p className="text-sm text-muted-foreground">Pipeline Influenced</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-emerald-600">
                    {roiMultiple}x
                  </p>
                  <p className="text-sm text-muted-foreground">Return on Subscription</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                You spent <span className="font-medium text-foreground">${PLATFORM_ROI.subscriptionCost.toLocaleString()}</span> this year 
                and generated <span className="font-medium text-foreground">${(PLATFORM_ROI.valueCasesGenerated / 1000000).toFixed(1)}M</span> in 
                value cases. That's a <span className="font-medium text-emerald-600">{roiPercent}% return</span> on ValueOS.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        {/* Seats */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Seats</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {USAGE.seats.used}/{USAGE.seats.total}
              </span>
            </div>
            <Progress value={seatsPercent} className="h-2 mb-3" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{seatsPercent}% utilized</span>
              <Button variant="link" size="sm" className="h-auto p-0">
                Manage Team
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cases */}
        <Card className={cn(isNearCapacity && "border-amber-300 bg-amber-50/50")}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Cases</span>
                {isNearCapacity && (
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                    Near Limit
                  </Badge>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {USAGE.cases.used}/{USAGE.cases.total}
              </span>
            </div>
            <Progress 
              value={casesPercent} 
              className={cn("h-2 mb-3", isNearCapacity && "[&>div]:bg-amber-500")} 
            />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{casesPercent}% used</span>
              <Button variant="link" size="sm" className="h-auto p-0">
                Archive Old Cases
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Credits */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">AI Credits</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              Resets in {USAGE.aiCredits.resetsInDays} days
            </Badge>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold">{USAGE.aiCredits.used}</span>
            <span className="text-muted-foreground">/ {USAGE.aiCredits.total.toLocaleString()}</span>
          </div>
          <Progress value={creditsPercent} className="h-2" />
        </CardContent>
      </Card>

      {/* Feature Adoption (Health Score) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Feature Adoption
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {FEATURE_ADOPTION.map((feature) => (
              <div
                key={feature.name}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  feature.status === "inactive"
                    ? "border-dashed border-muted-foreground/30 bg-muted/30"
                    : "border-emerald-200 bg-emerald-50"
                )}
              >
                {feature.status !== "inactive" ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    feature.status === "inactive" && "text-muted-foreground"
                  )}
                >
                  {feature.name}
                </span>
                {feature.status !== "inactive" && (
                  <Badge variant="secondary" className="ml-auto text-xs capitalize">
                    {feature.status}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Billing Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Billing Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
              <p className="font-medium">
                {BILLING.plan} ({BILLING.billingCycle})
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Next Bill</p>
              <p className={cn("font-medium", renewalUrgent && "text-amber-600")}>
                {BILLING.nextBillDate} (${BILLING.nextBillAmount.toLocaleString()})
                {renewalUrgent && (
                  <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-700 border-amber-300 text-xs">
                    {BILLING.renewsInDays} days
                  </Badge>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
              <div className="flex items-center gap-2">
                <CreditCard className="icon-sm icon-muted" />
                <span className="font-medium">
                  {BILLING.paymentMethod.type} •••• {BILLING.paymentMethod.last4}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Auto-Renew</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">{autoRenew ? "Enabled" : "Disabled"}</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" size="sm">
              Update Payment Method
            </Button>
            <Button variant="outline" size="sm">
              Change Plan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expansion Trigger (if near capacity) */}
      {isNearCapacity && (
        <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="icon-md text-amber-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-amber-900">You're almost at capacity</h4>
                <p className="text-sm text-amber-700 mt-1">
                  You've used {USAGE.cases.used} of {USAGE.cases.total} cases. Upgrade now for uninterrupted access.
                </p>
              </div>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                Upgrade Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enterprise Upsell */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-violet-500/5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold">Upgrade to Enterprise</h4>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Unlock advanced features for your growing team.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ENTERPRISE_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-3 w-3 text-primary" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button variant="outline">
              Compare Plans
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-3">Date</div>
              <div className="col-span-3">Amount</div>
              <div className="col-span-3">Invoice #</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1"></div>
            </div>

            {/* Table Body */}
            {INVOICES.map((invoice) => (
              <div
                key={invoice.id}
                className="grid grid-cols-12 gap-4 px-3 py-3 items-center rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="col-span-3 text-sm">{invoice.date}</div>
                <div className="col-span-3 text-sm font-medium">
                  ${invoice.amount.toLocaleString()}
                </div>
                <div className="col-span-3 text-sm text-muted-foreground">
                  {invoice.id}
                </div>
                <div className="col-span-2">
                  <Badge
                    variant="secondary"
                    className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs capitalize"
                  >
                    {invoice.status}
                  </Badge>
                </div>
                <div className="col-span-1 text-right">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default BillingSettings;
