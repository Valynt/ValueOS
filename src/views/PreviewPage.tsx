import React from "react";
import { Link } from "react-router-dom";
import { Eye, Home as HomeIcon, BarChart3, User, Settings } from "lucide-react";

import { MOCK_APP_STATE } from "../data/fixtures";

// Standalone Layout for Preview Mode (no auth dependencies)
function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#0a0a0a] text-neutral-300 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h1 className="text-lg font-semibold text-white">ValueOS</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/20 text-primary">
            <HomeIcon className="w-4 h-4" />
            Dashboard
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5">
            <BarChart3 className="w-4 h-4" />
            Value Canvas
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5">
            <User className="w-4 h-4" />
            Profile
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5">
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <img
              src={MOCK_APP_STATE.currentUser.avatarUrl}
              alt={MOCK_APP_STATE.currentUser.name}
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {MOCK_APP_STATE.currentUser.name}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {MOCK_APP_STATE.currentUser.role}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <PreviewLayout>
      <div className="sticky top-0 z-50 -mx-4 mb-6 border-b border-yellow-300 bg-yellow-100 px-4 py-3 text-sm text-yellow-900 sm:-mx-6 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span className="font-semibold">PREVIEW MODE: DISCONNECTED</span>
            <span className="text-yellow-800 ml-2">
              This page uses fixture data and bypasses auth + network requests.
            </span>
          </div>
          <Link
            to="/login"
            className="text-yellow-900 hover:text-yellow-700 underline text-xs"
          >
            Back to Login →
          </Link>
        </div>
      </div>

      <Dashboard />
    </PreviewLayout>
  );
}

function Dashboard() {
  const { currentUser, stats, activityLog } = MOCK_APP_STATE;

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="max-w-6xl mx-auto px-8 py-12">
        <div className="flex items-center gap-4 mb-12">
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.name}
            className="h-12 w-12 rounded-full ring-1 ring-black/10"
          />
          <div>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight mb-2">
              Welcome back, {currentUser.name}
            </h1>
            <p className="text-muted-foreground text-lg">
              Role: {currentUser.role}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
          <StatCard label="Active Models" value={stats.activeModels} />
          <StatCard label="Pipelines" value={stats.pipelines} />
          <StatCard
            label="Value at Stake"
            value={formatUsd(stats.valueAtStakeUsd)}
          />
          <StatCard
            label="Avg Payback"
            value={`${stats.avgPaybackMonths.toFixed(1)} mo`}
          />
          <StatCard label="Alerts" value={stats.alerts} />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-8">
          <div className="mb-3 text-sm font-semibold text-foreground">
            Recent activity
          </div>
          <ul className="divide-y divide-white/10">
            {activityLog.map((evt) => (
              <li key={evt.id} className="flex items-start gap-3 py-3">
                <img
                  src={evt.actor.avatarUrl}
                  alt={evt.actor.name}
                  className="h-8 w-8 rounded-full ring-1 ring-black/10"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-foreground">
                      {evt.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(evt.timestampIso)}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {evt.detail}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-end justify-between mb-12">
          <div>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight mb-2">
              Accounts & Prospects
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage your client portfolio and value lifecycles.
            </p>
          </div>
          <button className="btn btn-primary h-10 px-4 shadow-lg shadow-primary/10">
            <span className="w-4 h-4 mr-2">+</span>
            New Opportunity
          </button>
        </div>

        <div className="card p-4 mb-8 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">AI</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">
                <span className="font-medium">Ready to research.</span>
                <span className="text-muted-foreground ml-1">
                  I can scan 10-K filings, news, and industry reports for any
                  company.
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-outline h-8 px-3 text-xs">
                Research Acme Corp
              </button>
              <button className="btn btn-primary h-8 px-3 text-xs">
                Scan New Company
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-12 px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/50">
            <div className="col-span-4">Company</div>
            <div className="col-span-3">Current Stage</div>
            <div className="col-span-2">Value Potential</div>
            <div className="col-span-2">Last Activity</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {mockAccounts.map((account) => (
            <div
              key={account.id}
              className="group card grid grid-cols-12 items-center px-6 py-4 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer"
            >
              <div className="col-span-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold shadow-sm">
                  {account.logo}
                </div>
                <div>
                  <div className="font-semibold text-foreground text-base">
                    {account.name}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="w-3 h-3">🏢</span>
                    {account.industry}
                  </div>
                </div>
              </div>

              <div className="col-span-3 flex items-center gap-2">
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-foreground border border-border">
                  {account.stage}
                </div>
                <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">AI</span>
                </div>
              </div>

              <div className="col-span-2">
                <div className="text-sm font-medium text-foreground">
                  {account.potential}
                </div>
              </div>

              <div className="col-span-2 text-sm text-muted-foreground flex items-center gap-2">
                <span className="w-3.5 h-3.5">🕒</span>
                {account.lastActive}
              </div>

              <div className="col-span-1 flex justify-end">
                <button className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors">
                  <span className="w-4 h-4">→</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-5 border-l-4 border-l-primary">
      <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className="text-3xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRelative(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.max(1, Math.round(diffMs / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

const mockAccounts = [
  {
    id: 1,
    name: "Acme Corp",
    industry: "Manufacturing",
    stage: "Value Architecture",
    potential: "$4.2M",
    lastActive: "2h ago",
    logo: "AC",
  },
  {
    id: 2,
    name: "TechStart Inc",
    industry: "Software",
    stage: "Discovery",
    potential: "$1.5M",
    lastActive: "Yesterday",
    logo: "TS",
  },
  {
    id: 3,
    name: "Global Logistics",
    industry: "Transport",
    stage: "Business Case",
    potential: "$8.5M",
    lastActive: "3d ago",
    logo: "GL",
  },
  {
    id: 4,
    name: "FinServe Group",
    industry: "Finance",
    stage: "Realization",
    potential: "$2.1M",
    lastActive: "1w ago",
    logo: "FS",
  },
];
