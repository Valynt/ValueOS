/*
 * VALYNT Agents Page — Agent Hub
 * Shows agent cards with status, success rate, cost, run history.
 * "Chat" buttons dispatch to the AgentChatSidebar with the correct agent.
 */
import { useState } from "react";
import {
  Bot, Activity, DollarSign, Zap, CheckCircle2, XCircle, Clock,
  Loader2, Settings, Hash, MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { agents } from "@/lib/data";
import { toast } from "sonner";
import { useAgentDispatch } from "@/components/layout/MainLayout";

/* -------------------------------------------------------
   Agent ID → slug mapping (mirrors server/agents/registry.ts)
   ------------------------------------------------------- */
const AGENT_SLUG_MAP: Record<string, string> = {
  a_1: "opportunity",
  a_2: "research",
  a_3: "integrity",
  a_4: "target",
  a_5: "narrative",
  a_6: "redteam",
};

// Mock run history data
const agentRuns = [
  { id: "r1", agentName: "Opportunity Agent", agentId: "a_1", status: "success", duration: 12.3, tokensUsed: 4520, cost: 0.18, startedAt: "2m ago", output: "" },
  { id: "r2", agentName: "Research Agent", agentId: "a_2", status: "success", duration: 45.1, tokensUsed: 12800, cost: 0.52, startedAt: "3m ago", output: "" },
  { id: "r3", agentName: "Integrity Agent", agentId: "a_3", status: "success", duration: 3.2, tokensUsed: 890, cost: 0.04, startedAt: "5m ago", output: "" },
  { id: "r4", agentName: "Target Agent", agentId: "a_4", status: "running" as const, duration: 0, tokensUsed: 0, cost: 0, startedAt: "Just now", output: "" },
  { id: "r5", agentName: "Integrity Agent", agentId: "a_3", status: "success", duration: 2.8, tokensUsed: 720, cost: 0.03, startedAt: "15m ago", output: "" },
  { id: "r6", agentName: "Red Team Agent", agentId: "a_6", status: "failed" as const, duration: 8.1, tokensUsed: 3200, cost: 0.13, startedAt: "1h ago", output: "Timeout: external API unreachable" },
  { id: "r7", agentName: "Narrative Agent", agentId: "a_5", status: "success", duration: 22.5, tokensUsed: 8900, cost: 0.36, startedAt: "1h ago", output: "" },
  { id: "r8", agentName: "Opportunity Agent", agentId: "a_1", status: "success", duration: 15.7, tokensUsed: 5100, cost: 0.21, startedAt: "2h ago", output: "" },
];

export default function Agents() {
  const { openAgent } = useAgentDispatch();
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

  const handleChat = (agentId: string) => {
    const slug = AGENT_SLUG_MAP[agentId];
    if (slug) {
      openAgent(slug);
    } else {
      openAgent(); // fallback to Value Architect
    }
  };

  const totalCost = agents.reduce((sum, a) => sum + a.costLast7Days, 0);
  const totalRuns = agents.reduce((sum, a) => sum + a.runsLast7Days, 0);
  const avgSuccess = agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Agents</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Monitor, configure, and control the agentic workforce powering your value cases.
          </p>
        </div>
        <Button
          onClick={() => openAgent()}
          className="gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          Open Chat
        </Button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-default">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Bot className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Active Agents</p>
              <p className="text-xl font-bold">{Object.values(agentStates).filter(Boolean).length}/{agents.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-default">
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
        <Card className="hover:shadow-md transition-shadow cursor-default">
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
        <Card className="hover:shadow-md transition-shadow cursor-default">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
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
              <Card key={agent.id} className="hover:shadow-md transition-shadow group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                        agentStates[agent.id] ? "bg-emerald-50 group-hover:bg-emerald-100" : "bg-muted"
                      )}>
                        <Bot className={cn("w-5 h-5", agentStates[agent.id] ? "text-emerald-600" : "text-muted-foreground")} />
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
                    <span className="text-[10px] text-muted-foreground">Last run: {agent.lastRun}</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => handleChat(agent.id)}
                        disabled={!agentStates[agent.id]}
                      >
                        <MessageSquare className="w-3 h-3" />
                        Chat
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1" onClick={() => toast("Agent settings coming soon")}>
                        <Settings className="w-3 h-3" />
                      </Button>
                    </div>
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
                      <tr
                        key={run.id}
                        className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => handleChat(run.agentId)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-medium">{run.agentName}</p>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-normal">
                              {AGENT_SLUG_MAP[run.agentId] || "unknown"}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {run.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> :
                             run.status === "failed" ? <XCircle className="w-3.5 h-3.5 text-red-500" /> :
                             run.status === "running" ? <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" /> :
                             <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                            <span className={cn(
                              "text-[12px] capitalize font-medium",
                              run.status === "success" ? "text-emerald-600" :
                              run.status === "failed" ? "text-red-500" :
                              run.status === "running" ? "text-blue-600" :
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
                          {run.startedAt}
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
