/*
 * Design: Atelier — Refined Workspace Craft
 * Agent Hub: Agent cards with status, run history table, cost metrics
 */
import { useState } from "react";
import {
  Bot, Activity, DollarSign, Zap, CheckCircle2, XCircle, Clock,
  Loader2, Power, PowerOff, Settings, ChevronDown, BarChart3,
  AlertTriangle, TrendingUp, Hash,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { agents, agentRuns, timeAgo, getStatusColor } from "@/lib/data";
import { toast } from "sonner";

export default function Agents() {
  const [agentStates, setAgentStates] = useState<Record<string, boolean>>(
    Object.fromEntries(agents.map((a) => [a.id, a.isActive]))
  );

  const toggleAgent = (id: string) => {
    setAgentStates((prev) => {
      const newState = { ...prev, [id]: !prev[id] };
      toast(newState[id] ? "Agent activated" : "Agent deactivated");
      return newState;
    });
  };

  const totalCost = agents.reduce((sum, a) => sum + a.costLast7Days, 0);
  const totalRuns = agents.reduce((sum, a) => sum + a.runsLast7Days, 0);
  const avgSuccess = agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agent Hub</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor, configure, and control the agentic workforce powering your value cases.
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Active Agents</p>
              <p className="text-xl font-bold">{Object.values(agentStates).filter(Boolean).length}/{agents.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Avg Success Rate</p>
              <p className="text-xl font-bold">{avgSuccess.toFixed(1)}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Hash className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Runs (7d)</p>
              <p className="text-xl font-bold">{totalRuns}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Cost (7d)</p>
              <p className="text-xl font-bold">${totalCost.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="runs">Run History</TabsTrigger>
        </TabsList>

        {/* Agents Tab */}
        <TabsContent value="agents">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {agents.map((agent) => (
              <Card key={agent.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        agentStates[agent.id] ? "bg-primary/10" : "bg-muted"
                      )}>
                        <Bot className={cn("w-5 h-5", agentStates[agent.id] ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold">{agent.name}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{agent.type.replace("_", " ")} · v{agent.version}</p>
                      </div>
                    </div>
                    <Switch
                      checked={agentStates[agent.id]}
                      onCheckedChange={() => toggleAgent(agent.id)}
                    />
                  </div>

                  <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                    {agent.description}
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-[14px] font-bold">{agent.successRate}%</p>
                      <p className="text-[9px] text-muted-foreground font-medium">Success</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-[14px] font-bold">{agent.runsLast7Days}</p>
                      <p className="text-[9px] text-muted-foreground font-medium">Runs (7d)</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-[14px] font-bold">${agent.costLast7Days}</p>
                      <p className="text-[9px] text-muted-foreground font-medium">Cost (7d)</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <span className="text-[10px] text-muted-foreground">Last run: {timeAgo(agent.lastRun)}</span>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => toast("Agent settings coming soon")}>
                      <Settings className="w-3 h-3 mr-1" />
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Run History Tab */}
        <TabsContent value="runs">
          <Card className="mt-4">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Agent</th>
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Status</th>
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Duration</th>
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Tokens</th>
                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Cost</th>
                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentRuns.map((run) => (
                      <tr key={run.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-[13px] font-medium">{run.agentName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {run.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> :
                             run.status === "failed" ? <XCircle className="w-3.5 h-3.5 text-red-500" /> :
                             run.status === "running" ? <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" /> :
                             <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                            <span className={cn(
                              "text-[12px] capitalize font-medium",
                              run.status === "success" ? "text-emerald-600" :
                              run.status === "failed" ? "text-red-500" :
                              run.status === "running" ? "text-indigo-600" :
                              "text-muted-foreground"
                            )}>
                              {run.status}
                            </span>
                          </div>
                          {run.output && run.status === "failed" && (
                            <p className="text-[10px] text-red-400 mt-0.5 max-w-xs truncate">{run.output}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-mono text-muted-foreground">
                          {run.duration > 0 ? `${run.duration.toFixed(1)}s` : "—"}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-mono text-muted-foreground">
                          {run.tokensUsed > 0 ? run.tokensUsed.toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-[13px] font-mono font-medium">
                          {run.cost > 0 ? `$${run.cost.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-[12px] text-muted-foreground">
                          {timeAgo(run.startedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
