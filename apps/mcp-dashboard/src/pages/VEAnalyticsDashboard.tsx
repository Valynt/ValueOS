import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const VEAnalyticsDashboard: React.FC = () => {
  const [stats] = useState([
    { date: "2026-01-20", models: 4, accuracy: 92 },
    { date: "2026-01-22", models: 7, accuracy: 95 },
    { date: "2026-01-24", models: 5, accuracy: 94 },
    { date: "2026-01-26", models: 9, accuracy: 98 },
    { date: "2026-01-28", models: 12, accuracy: 97 },
  ]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">VE Performance & Audit Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-4">
          <Label className="text-xs text-muted-foreground uppercase">Total Models Built</Label>
          <p className="text-3xl font-bold">37</p>
          <Badge className="mt-2 bg-green-100 text-green-700">+12% vs last week</Badge>
        </Card>
        <Card className="p-4">
          <Label className="text-xs text-muted-foreground uppercase">Avg. Model Accuracy</Label>
          <p className="text-3xl font-bold">96.4%</p>
          <Badge className="mt-2 bg-blue-100 text-blue-700">Top 5% of VEs</Badge>
        </Card>
        <Card className="p-4">
          <Label className="text-xs text-muted-foreground uppercase">VMRT Audit Compliance</Label>
          <p className="text-3xl font-bold">100%</p>
          <Badge className="mt-2 bg-green-100 text-green-700">Verified</Badge>
        </Card>
      </div>

      <Card className="p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Modeling Velocity & Accuracy</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="models" stroke="#08A0A0" strokeWidth={2} name="Models" />
              <Line type="monotone" dataKey="accuracy" stroke="#0FBF9B" strokeWidth={2} name="Accuracy (%)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent VMRT Audit Logs</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between items-center p-3 border rounded bg-muted/10 text-sm">
              <div>
                <p className="font-mono text-xs text-muted-foreground">vmrt_1738045200{i}</p>
                <p className="font-medium">Efficiency Gain Validation - Software Industry</p>
              </div>
              <Badge variant="outline">Verified Hash: a7b2c{i}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
