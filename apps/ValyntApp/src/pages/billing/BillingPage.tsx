import { useState } from "react";
import { CreditCard, TrendingUp, FileText, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tab = "usage" | "plans" | "invoices";
type PlanTier = "free" | "pro" | "enterprise";

const plans = [
  {
    id: "free" as const,
    name: "Free",
    price: 0,
    features: ["5 projects", "1 GB storage", "Community support"],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: 29,
    features: ["Unlimited projects", "10 GB storage", "Priority support", "Advanced analytics"],
    popular: true,
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: 99,
    features: ["Unlimited everything", "100 GB storage", "24/7 support", "Custom integrations", "SLA"],
  },
];

const mockInvoices = [
  { id: "INV-001", date: "Jan 1, 2026", amount: 29, status: "paid" as const },
  { id: "INV-002", date: "Dec 1, 2025", amount: 29, status: "paid" as const },
  { id: "INV-003", date: "Nov 1, 2025", amount: 29, status: "paid" as const },
];

export function BillingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("usage");
  const [currentPlan, setCurrentPlan] = useState<PlanTier>("pro");

  const tabs = [
    { id: "usage" as const, label: "Usage", icon: TrendingUp },
    { id: "plans" as const, label: "Plans", icon: CreditCard },
    { id: "invoices" as const, label: "Invoices", icon: FileText },
  ];

  return (
    <div className="container max-w-5xl py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Billing & Usage</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription, monitor usage, and view invoices
        </p>
      </div>

      {/* Current Plan Banner */}
      <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground mb-8">
        <CardContent className="flex items-center justify-between py-6">
          <div>
            <p className="text-sm opacity-90">Current Plan</p>
            <p className="text-3xl font-bold mt-1 capitalize">{currentPlan}</p>
            <p className="text-sm opacity-90 mt-1">
              ${plans.find((p) => p.id === currentPlan)?.price}/month
            </p>
          </div>
          <CreditCard className="icon-lg text-primary-foreground/70" />
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 py-4 border-b-2 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="icon-sm" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "usage" && <UsageTab />}
      {activeTab === "plans" && (
        <PlansTab currentPlan={currentPlan} onSelectPlan={setCurrentPlan} />
      )}
      {activeTab === "invoices" && <InvoicesTab invoices={mockInvoices} />}
    </div>
  );
}

function UsageTab() {
  const usage = [
    { metric: "API Calls", used: 8500, limit: 10000 },
    { metric: "Storage", used: 3.2, limit: 10, unit: "GB" },
    { metric: "Projects", used: 12, limit: 50 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {usage.map((item) => {
          const percentage = (item.used / item.limit) * 100;
          return (
            <Card key={item.metric}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{item.metric}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {item.used.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}/ {item.limit.toLocaleString()} {item.unit || ""}
                  </span>
                </div>
                <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      percentage >= 90 ? "bg-destructive" : percentage >= 75 ? "bg-yellow-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{percentage.toFixed(0)}% used</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Usage Alert */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertCircle className="icon-md text-yellow-600 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-900">Usage Alert</p>
            <p className="text-sm text-yellow-800">
              You're approaching your API call limit. Consider upgrading your plan.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlansTab({
  currentPlan,
  onSelectPlan,
}: {
  currentPlan: PlanTier;
  onSelectPlan: (plan: PlanTier) => void;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {plans.map((plan) => (
        <Card
          key={plan.id}
          className={cn(
            "relative",
            plan.popular && "border-primary shadow-lg",
            currentPlan === plan.id && "ring-2 ring-primary"
          )}
        >
          {plan.popular && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">
              Popular
            </div>
          )}
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>
              <span className="text-3xl font-bold text-foreground">${plan.price}</span>
              <span className="text-muted-foreground">/month</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="icon-sm icon-accent" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              className="w-full"
              variant={currentPlan === plan.id ? "outline" : "default"}
              onClick={() => onSelectPlan(plan.id)}
              disabled={currentPlan === plan.id}
            >
              {currentPlan === plan.id ? "Current Plan" : "Select Plan"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InvoicesTab({
  invoices,
}: {
  invoices: Array<{ id: string; date: string; amount: number; status: "paid" | "pending" }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice History</CardTitle>
        <CardDescription>Download and view your past invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">{invoice.id}</p>
                <p className="text-sm text-muted-foreground">{invoice.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium">${invoice.amount}</span>
                <span
                  className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    invoice.status === "paid"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  )}
                >
                  {invoice.status}
                </span>
                <Button variant="ghost" size="sm">
                  Download
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default BillingPage;
