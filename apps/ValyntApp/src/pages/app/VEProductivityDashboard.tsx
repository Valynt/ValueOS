import React, { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export const VEProductivityDashboard: React.FC = () => {
  const [metrics] = useState([
    { name: "Modeling Time (hrs)", before: 12, after: 1.8 },
    { name: "CFO Approval Rate (%)", before: 45, after: 92 },
    { name: "VMRT Compliance (%)", before: 0, after: 100 },
    { name: "Realization Accuracy (%)", before: 65, after: 88 },
  ]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">VE Productivity & Impact Metrics</h1>
        <p className="text-muted-foreground">
          Measuring the shift from manual modeling to AI-augmented value engineering.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {metrics.map((m, i) => (
          <Card key={i} className="p-6">
            <div className="flex justify-between items-start mb-4">
              <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">
                {m.name}
              </Label>
              <Badge
                className={
                  m.after > m.before ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                }
              >
                {m.name.includes("Time")
                  ? `-${(((m.before - m.after) / m.before) * 100).toFixed(0)}%`
                  : `+${(m.after - m.before).toFixed(0)}%`}
              </Badge>
            </div>

            <div className="flex items-end gap-8 h-40">
              <div className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-slate-100 rounded-t-lg relative"
                  style={{ height: `${(m.before / Math.max(m.before, m.after)) * 100}%` }}
                >
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold">
                    {m.before}
                  </span>
                </div>
                <span className="text-[10px] mt-2 uppercase text-slate-400">Before</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-indigo-500 rounded-t-lg relative"
                  style={{ height: `${(m.after / Math.max(m.before, m.after)) * 100}%` }}
                >
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-indigo-600">
                    {m.after}
                  </span>
                </div>
                <span className="text-[10px] mt-2 uppercase text-slate-400 font-bold text-slate-600">
                  After
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-slate-900 text-white border-none shadow-2xl">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-indigo-400" /> Value Engineer ROI Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <p className="text-slate-400 text-xs uppercase mb-1">Annual Time Saved</p>
            <p className="text-4xl font-bold">520 hrs</p>
            <p className="text-xs text-slate-500 mt-1">Per Value Engineer</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase mb-1">Win Rate Uplift</p>
            <p className="text-4xl font-bold text-indigo-400">+15%</p>
            <p className="text-xs text-slate-500 mt-1">Attributed to VMRT Trust</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase mb-1">Model Defensibility</p>
            <p className="text-4xl font-bold text-green-400">9.8/10</p>
            <p className="text-xs text-slate-500 mt-1">CFO Confidence Score</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

import { Sparkles } from "lucide-react";
