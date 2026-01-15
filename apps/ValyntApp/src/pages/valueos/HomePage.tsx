/**
 * HomePage - ValueOS Home
 * 
 * Greeting, continue where you left off, quick actions, recent cases.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  ArrowRight,
  Search,
  Upload,
  MessageSquare,
  TrendingUp,
  Play,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Mock data
const continueCase = {
  id: "1",
  name: "Acme Corp Value Case",
  description: 'Refining cost assumptions in the "Efficiency" model...',
  editedAt: "2 hours ago",
};

const recentCases = [
  {
    id: "1",
    initials: "BE",
    name: "Beta Inc",
    value: "$2.1M Value",
    status: "committed" as const,
    editedAt: "Edited 2 hours ago",
  },
  {
    id: "2",
    initials: "GA",
    name: "Gamma Ltd",
    value: "$890K Value",
    status: "in-progress" as const,
    editedAt: "Edited 1 day ago",
  },
  {
    id: "3",
    initials: "DE",
    name: "Delta Corp",
    value: "-- Value",
    status: "draft" as const,
    editedAt: "Edited 3 days ago",
  },
];

const quickActions = [
  {
    icon: <Search size={20} />,
    label: "Research Company",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: <Upload size={20} />,
    label: "Import from CRM",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: <MessageSquare size={20} />,
    label: "Analyze Call",
    color: "bg-purple-50 text-purple-600",
  },
];

const statusColors = {
  committed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "in-progress": "bg-blue-100 text-blue-700 border-blue-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
};

const statusLabels = {
  committed: "COMMITTED",
  "in-progress": "IN PROGRESS",
  draft: "DRAFT",
};

export function HomePage() {
  const navigate = useNavigate();

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          {getGreeting()}, Sarah
        </h1>
        <p className="text-slate-500 mt-1">Ready to prove some value today?</p>
      </div>

      {/* Continue Where You Left Off */}
      <Card className="mb-8 p-4 border border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FileText className="text-emerald-600" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                  Continue where you left off
                </span>
                <span className="text-xs text-slate-400">• Edited {continueCase.editedAt}</span>
              </div>
              <h3 className="font-semibold text-slate-900">{continueCase.name}</h3>
              <p className="text-sm text-slate-500">{continueCase.description}</p>
            </div>
          </div>
          <Button
            onClick={() => navigate(`/app/cases/${continueCase.id}`)}
            className="gap-2"
          >
            Resume
            <ArrowRight size={16} />
          </Button>
        </div>
      </Card>

      {/* Start Something New */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Start Something New
        </h2>

        {/* Command Input */}
        <Card className="mb-4 p-3 border border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <Play size={18} className="text-slate-400" />
            <input
              type="text"
              placeholder="e.g., 'Build a business case for Stripe' or 'Analyze my last sales call'"
              className="flex-1 text-sm text-slate-600 placeholder:text-slate-400 outline-none"
            />
            <ArrowRight size={18} className="text-slate-400" />
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <Card
              key={index}
              className="p-4 border border-slate-200 bg-white hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color}`}>
                  {action.icon}
                </div>
                <span className="font-medium text-slate-700">{action.label}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Cases */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Recent Cases
          </h2>
          <button className="text-sm text-primary hover:underline">View all</button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {recentCases.map((caseItem) => (
            <Card
              key={caseItem.id}
              className="p-4 border border-slate-200 bg-white hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
              onClick={() => navigate(`/app/cases/${caseItem.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600 border border-slate-200">
                  {caseItem.initials}
                </div>
                <Badge
                  className={`text-[10px] font-semibold uppercase ${statusColors[caseItem.status]}`}
                >
                  {statusLabels[caseItem.status]}
                </Badge>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{caseItem.name}</h3>
              <div className="flex items-center gap-1 text-sm text-slate-500 mb-3">
                <TrendingUp size={14} />
                <span>{caseItem.value}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{caseItem.editedAt}</span>
                <button className="text-primary hover:underline">Open →</button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HomePage;
