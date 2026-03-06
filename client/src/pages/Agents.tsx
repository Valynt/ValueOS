/*
 * VALYNT Agents Page — Agent Hub
 * Refactored to use shared components: PageHeader, StatCard, DataTable, StatusBadge, ActivityItem.
 */
import { useState } from "react";
import {
  Bot, Activity, DollarSign, Hash, MessageSquare, Settings,
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
import {
  PageHeader,
  StatCard,
  DataTable,
  StatusBadge,
  type Column,
} from "@/components/shared";

/* ── Agent ID → slug mapping ── */
const AGENT_SLUG_MAP: Record<string, string> = {
  a_1: "opportunity",
  a_2: "research",
  a_3: "integrity",
  a_4: "target",
  a_5: "narrative",
  a_6: "redteam",
};

/* ── Mock run history ── */
interface AgentRun {
  id: string;
  agentName: string;
  agentId: string;
  status: "success" | "failed" | "running" | "cancelled";
  duration: number;
  tokensUsed: number;
  cost: number;
  startedAt: string;
  output: string;
}

const agentRuns: AgentRun[] = [
  { id: "r1", agentName: "Opportunity Agent", agentId: "a_1", status: "success", duration: 12.3, tokensUsed: 4520, cost: 0.18, startedAt: "2m ago", output: "" },
  { id: "r2", agentName: "Research Agent", agentId: "a_2", status: "success", duration: 45.1, tokensUsed: 12800, cost: 0.52, startedAt: "3m ago", output: "" },
  { id: "r3", agentName: "Integrity Agent", agentId: "a_3", status: "success", duration: 3.2, tokensUsed: 890, cost: 0.04, startedAt: "5m ago", output: "" },
  { id: "r4", agentName: "Target Agent", agentId: "a_4", status: "running", duration: 0, tokensUsed: 0, cost: 0, startedAt: "Just now", output: "" },
  { id: "r5", agentName: "Integrity Agent", agentId: "a_3", status: "success", duration: 2.8, tokensUsed: 720, cost: 0.03, startedAt: "15m ago", output: "" },
  { id: "r6", agentName: "Red Team Agent", agentId: "a_6", status: "failed", duration: 8.1, tokensUsed: 3200, cost: 0.13, startedAt: "1h ago", output: "Timeout: external API unreachable" },
  { id: "r7", agentName: "Narrative Agent", agentId: "a_5", status: "success", duration: 22.5, tokensUsed: 8900, cost: 0.36, startedAt: "1h ago", output: "" },
  { id: "r8", agentName: "Opportunity Agent", agentId: "a_1", status: "success", duration: 15.7, tokensUsed: 5100, cost: 0.21, startedAt: "2h ago", output: "" },
];

const runColumns: Column[] = [
  { key: "agent", label: "Agent" },
  { key: "status", label: "Status" },
  { key: "duration", label: "Duration" },
  { key: "tokens", label: "Tokens" },
  { key: "cost", label: "Cost", align: "right" },
  { key: "started", label: "Started", align: "right" },
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
    if (slug) openAgent(slug);
    else openAgent();
  };

  const totalCost = agents.reduce((sum, a) => sum + a.costLast7Days, 0);
  const totalRuns = agents.reduce((sum, a) => sum + a.runsLast7Days, 0);
  const avgSuccess = agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length;

  return (
    <div className="p-8 space-y-8 max-w-[1400px]">
      {/* Header */}
      <PageHeader
        title="Agents"
        description="Monitor, configure, and control the agentic workforce powering your value cases."
        action={
          <Button onClick={() => openAgent()} className="h-10 text-sm gap-2">
            <MessageSquare className="w-4 h-4" />
            Open Chat
          </Button>
        }
      />

      {/* Summary Metrics — using StatCard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Bot}
          label="Active Agents"
          value={`${Object.values(agentStates).filter(Boolean).length}/${agents.length}`}
        />
        <StatCard
          icon={Activity}
          label="Avg Success Rate"
          value={`${avgSuccess.toFixed(1)}%`}
          progress={avgSuccess}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          icon={Hash}
          label="Runs (7d)"
          value={totalRuns}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          icon={DollarSign}
          label="Cost (7d)"
          value={`$${totalCost.toFixed(2)}`}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
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
                        <p className="text-sm font-semibold">{agent.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{agent.type.replace("_", " ")} · v{agent.version}</p>
                      </div>
                    </div>
                    <Switch
                      checked={agentStates[agent.id]}
                      onCheckedChange={() => toggleAgent(agent.id)}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                    {agent.description}
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-sm font-bold">{agent.successRate}%</p>
                      <p className="text-xs text-muted-foreground font-medium">Success</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-sm font-bold">{agent.runsLast7Days}</p>
                      <p className="text-xs text-muted-foreground font-medium">Runs (7d)</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-sm font-bold">${agent.costLast7Days}</p>
                      <p className="text-xs text-muted-foreground font-medium">Cost (7d)</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <span className="text-xs text-muted-foreground">Last run: {agent.lastRun}</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleChat(agent.id)}
                        disabled={!agentStates[agent.id]}
                      >
                        <MessageSquare className="w-3 h-3" />
                        Chat
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => toast("Agent settings coming soon")}>
                        <Settings className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Run History Tab — using DataTable */}
        <TabsContent value="runs">
          <div className="mt-4">
            <DataTable
              columns={runColumns}
              data={agentRuns}
              renderRow={(run) => (
                <DataTable.Row key={run.id} onClick={() => handleChat(run.agentId)}>
                  <DataTable.Cell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{run.agentName}</span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 font-normal">
                        {AGENT_SLUG_MAP[run.agentId] || "unknown"}
                      </Badge>
                    </div>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <div>
                      <StatusBadge type="run" value={run.status} showIcon />
                      {run.output && run.status === "failed" && (
                        <p className="text-xs text-red-400 mt-0.5 max-w-xs truncate">{run.output}</p>
                      )}
                    </div>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <span className="text-sm font-mono text-muted-foreground">
                      {run.duration > 0 ? `${run.duration.toFixed(1)}s` : "—"}
                    </span>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <span className="text-sm font-mono text-muted-foreground">
                      {run.tokensUsed > 0 ? run.tokensUsed.toLocaleString() : "—"}
                    </span>
                  </DataTable.Cell>
                  <DataTable.Cell align="right">
                    <span className="text-sm font-mono font-medium">
                      {run.cost > 0 ? `$${run.cost.toFixed(2)}` : "—"}
                    </span>
                  </DataTable.Cell>
                  <DataTable.Cell align="right">
                    <span className="text-xs text-muted-foreground">{run.startedAt}</span>
                  </DataTable.Cell>
                </DataTable.Row>
              )}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
