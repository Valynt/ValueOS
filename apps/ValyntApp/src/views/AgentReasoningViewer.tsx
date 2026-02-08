/**
 * VOS-SUPER-002: Agent Reasoning Viewer (Thought Chains)
 * Visualizes agent reasoning traces and thought chains with interactive tree view
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  GitBranch,
  GitMerge,
  ArrowRight,
  ArrowDown,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  Target,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Clock,
  Activity,
} from "lucide-react";
import { AgentBadge } from "../components/Agents/AgentBadge";
import { auditTrailService } from "../services/AuditTrailService";
import { auditLogService } from "../services/AuditLogService";
import { webSocketManager } from "../services/WebSocketManager";
import { ConfidenceDisplay } from "@valueos/sdui";
import { IntegrityVetoPanel } from "@valueos/sdui";
import "./AgentReasoningViewer.css";
// ============================================================================
// Types
// ============================================================================

export interface ThoughtNode {
  id: string;
  type: "reasoning" | "action" | "observation" | "decision" | "tool_use";
  content: string;
  timestamp: string;
  confidence?: number;
  metadata?: Record<string, any>;
  children?: ThoughtNode[];
}

export interface ReasoningChain {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  sessionId: string;
  rootThought: string;
  nodes: ThoughtNode[];
  status: "completed" | "failed" | "in_progress";
  startTime: string;
  endTime?: string;
  totalDuration?: number;
}

export interface ReasoningFilter {
  agentRole?: string;
  nodeType?: string;
  confidenceThreshold?: number;
  timeRange?: "5m" | "15m" | "1h" | "24h" | "all";
  searchQuery?: string;
}

// ============================================================================
// Components
// ============================================================================

const ThoughtNodeCard: React.FC<{
  node: ThoughtNode;
  depth?: number;
  onNodeClick?: (node: ThoughtNode) => void;
}> = ({ node, depth = 0, onNodeClick }) => {
  const [expanded, setExpanded] = useState(true);

  const getNodeTypeColor = (type: string) => {
    switch (type) {
      case "reasoning":
        return "bg-blue-50 border-blue-200 text-blue-900";
      case "action":
        return "bg-purple-50 border-purple-200 text-purple-900";
      case "observation":
        return "bg-gray-50 border-gray-200 text-gray-900";
      case "decision":
        return "bg-green-50 border-green-200 text-green-900";
      case "tool_use":
        return "bg-orange-50 border-orange-200 text-orange-900";
      default:
        return "bg-white border-gray-200";
    }
  };

  const getNodeTypeIcon = (type: string) => {
    switch (type) {
      case "reasoning":
        return <Lightbulb className="w-4 h-4" />;
      case "action":
        return <ArrowRight className="w-4 h-4" />;
      case "observation":
        return <Activity className="w-4 h-4" />;
      case "decision":
        return <Target className="w-4 h-4" />;
      case "tool_use":
        return <GitBranch className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="ml-4" style={{ marginLeft: `${depth * 16}px` }}>
      <div
        className={`p-3 rounded-lg border ${getNodeTypeColor(node.type)} mb-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] quantum-glow`}
        onClick={() => {
          onNodeClick?.(node);
          if (hasChildren) setExpanded(!expanded);
        }}
      >
        <div className="flex items-start gap-2 mb-1">
          {hasChildren && (
            <button
              className="mt-0.5 hover:bg-white/50 rounded"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-4" />}

          {getNodeTypeIcon(node.type)}

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase">{node.type}</span>
              {node.confidence !== undefined && (
                <ConfidenceDisplay data={{ score: node.confidence }} size="sm" showLabel={false} />
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(node.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-sm leading-relaxed">{node.content}</div>

            {node.metadata && Object.keys(node.metadata).length > 0 && (
              <div className="mt-2 text-xs bg-white/30 rounded p-1.5">
                <pre className="whitespace-pre-wrap font-mono">
                  {JSON.stringify(node.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="space-y-1">
          {node.children?.map((child) => (
            <ThoughtNodeCard
              key={child.id}
              node={child}
              depth={depth + 1}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ReasoningChainCard: React.FC<{
  chain: ReasoningChain;
  onChainSelect: (chain: ReasoningChain) => void;
}> = ({ chain, onChainSelect }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-50 border-green-200";
      case "failed":
        return "text-red-600 bg-red-50 border-red-200";
      case "in_progress":
        return "text-blue-600 bg-blue-50 border-blue-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const nodeCount = useMemo(() => {
    const count = (nodes: ThoughtNode[]): number => {
      return nodes.reduce((acc, node) => acc + 1 + (node.children ? count(node.children) : 0), 0);
    };
    return count(chain.nodes);
  }, [chain.nodes]);

  return (
    <div
      className={`p-4 rounded-lg border ${getStatusColor(chain.status)} cursor-pointer transition-all hover:shadow-lg mb-3`}
      onClick={() => onChainSelect(chain)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <AgentBadge agentId={chain.agentId} size="sm" showName={false} />
          <span className="font-semibold">{chain.agentName}</span>
          <span className="text-xs px-2 py-0.5 bg-white/50 rounded">{chain.agentRole}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {nodeCount} nodes
          </span>
          {chain.totalDuration && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {chain.totalDuration}ms
            </span>
          )}
        </div>
      </div>

      <div className="text-sm font-medium mb-1">{chain.rootThought}</div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Started: {new Date(chain.startTime).toLocaleTimeString()}</span>
        {chain.endTime && <span>Ended: {new Date(chain.endTime).toLocaleTimeString()}</span>}
        <span className="px-1.5 py-0.5 bg-white/50 rounded">{chain.status}</span>
      </div>
    </div>
  );
};

const ChainDetailPanel: React.FC<{
  chain: ReasoningChain | null;
  onClose: () => void;
}> = ({ chain, onClose }) => {
  if (!chain) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Reasoning Chain Details</h2>
            <p className="text-sm text-muted-foreground">Session: {chain.sessionId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 p-3 bg-secondary/50 rounded">
            <div className="text-sm font-medium mb-1">Root Thought</div>
            <div className="text-base">{chain.rootThought}</div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold mb-2">Thought Chain</div>
            {chain.nodes.map((node) => (
              <ThoughtNodeCard key={node.id} node={node} />
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const FilterPanel: React.FC<{
  filters: ReasoningFilter;
  onFilterChange: (filters: ReasoningFilter) => void;
  availableRoles: string[];
}> = ({ filters, onFilterChange, availableRoles }) => {
  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {/* Agent Role */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">
            Agent Role
          </label>
          <select
            value={filters.agentRole || ""}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                agentRole: e.target.value || undefined,
              })
            }
            className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
          >
            <option value="">All Roles</option>
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {/* Node Type */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">
            Node Type
          </label>
          <select
            value={filters.nodeType || ""}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                nodeType: e.target.value || undefined,
              })
            }
            className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
          >
            <option value="">All Types</option>
            <option value="reasoning">Reasoning</option>
            <option value="action">Action</option>
            <option value="observation">Observation</option>
            <option value="decision">Decision</option>
            <option value="tool_use">Tool Use</option>
          </select>
        </div>

        {/* Confidence Threshold */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">
            Min Confidence
          </label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={filters.confidenceThreshold || ""}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                confidenceThreshold: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            placeholder="0.0-1.0"
            className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
          />
        </div>

        {/* Time Range */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">
            Time Range
          </label>
          <select
            value={filters.timeRange || "all"}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                timeRange: e.target.value as ReasoningFilter["timeRange"],
              })
            }
            className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
          >
            <option value="5m">Last 5m</option>
            <option value="15m">Last 15m</option>
            <option value="1h">Last 1h</option>
            <option value="24h">Last 24h</option>
            <option value="all">All</option>
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search thoughts..."
              value={filters.searchQuery || ""}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  searchQuery: e.target.value,
                })
              }
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded bg-background"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const AgentReasoningViewer: React.FC = () => {
  const [chains, setChains] = useState<ReasoningChain[]>([]);
  const [filteredChains, setFilteredChains] = useState<ReasoningChain[]>([]);
  const [filters, setFilters] = useState<ReasoningFilter>({ timeRange: "15m" });
  const [selectedChain, setSelectedChain] = useState<ReasoningChain | null>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [integrityIssues, setIntegrityIssues] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalChains: 0,
    avgNodes: 0,
    avgDuration: 0,
    completed: 0,
    failed: 0,
    inProgress: 0,
  });

  // Load reasoning chains and subscribe to realtime updates
  useEffect(() => {
    loadReasoningChains();

    const handleWS = (message: any) => {
      try {
        if (!message || !message.type) return;
        // normalize to our agent.event envelope
        if (message.type === 'agent.event' || message.type === 'sdui_update') {
          const payload = message.payload || {};
          const eventType = payload.eventType || payload.type;

          if (eventType === 'agent.reasoning.update') {
            const data = payload.data;
            // data can be a single chain or an array
            const chainsToMerge = Array.isArray(data) ? data : [data];

            setChains((prev) => {
              const byId = new Map(prev.map((c) => [c.id, c]));

              chainsToMerge.forEach((incoming: any) => {
                if (!incoming || !incoming.agentId) return;
                const key = incoming.id || `${incoming.sessionId}-${incoming.agentId}`;
                const existing = byId.get(key);

                if (!existing) {
                  // Append new chain at top
                  byId.set(key, { ...incoming, id: key, nodes: incoming.nodes || [] });
                } else {
                  // Merge nodes
                  const mergeNodes = (srcNodes: any[], dstNodes: any[]) => {
                    srcNodes.forEach((sn) => {
                      const match = dstNodes.find((d) => d.id === sn.id || (d.content === sn.content && d.timestamp === sn.timestamp));
                      if (match) {
                        if (sn.confidence !== undefined && match.confidence !== sn.confidence) {
                          match.confidence = sn.confidence;
                        }
                        if (sn.children && sn.children.length > 0) {
                          match.children = match.children || [];
                          mergeNodes(sn.children, match.children);
                        }
                      } else {
                        dstNodes.push(sn);
                      }
                    });
                  };

                  existing.nodes = existing.nodes || [];
                  mergeNodes(incoming.nodes || [], existing.nodes);
                }
              });

              return Array.from(byId.values()).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
            });
          }

          if (eventType === 'integrity.issue.resolved') {
            const issue = payload.data;
            if (issue && issue.issueId) {
              setIntegrityIssues((prev) => prev.filter((i) => i.id !== issue.issueId));
            }
          }
        }
      } catch (err) {
        console.error('Failed to handle WS message', err);
      }
    };

    webSocketManager.on('message', handleWS);

    return () => {
      webSocketManager.removeListener('message', handleWS);
    };
  }, []);

  // Apply filters
  useEffect(() => {
    applyFilters();
    updateStats();
  }, [chains, filters]);

  const loadReasoningChains = async () => {
    try {
      // Load agent-related audit logs
      const logs = await auditLogService.query({
        action: "agent%",
        limit: 100,
      });

      // Group logs by session and agent to form reasoning chains
      const chainsMap = new Map<string, ReasoningChain>();

      logs.forEach((log) => {
        const sessionId = log.details?.sessionId || log.resource_id;
        const agentId = log.details?.agentId || log.resource_id;
        const key = `${sessionId}-${agentId}`;

        if (!chainsMap.has(key)) {
          chainsMap.set(key, {
            id: key,
            agentId,
            agentName: log.details?.agentName || "Unknown Agent",
            agentRole: log.details?.agentRole || "Agent",
            sessionId,
            rootThought: log.details?.rootThought || "Agent reasoning session",
            status: log.details?.status || "completed",
            startTime: log.timestamp,
            endTime: log.details?.endTime,
            totalDuration: log.details?.duration,
            nodes: [],
          });
        }

        // Add reasoning nodes from log details
        if (log.details?.reasoningSteps) {
          const chain = chainsMap.get(key)!;
          log.details.reasoningSteps.forEach((step: any) => {
            chain.nodes.push({
              id: `${key}-node-${step.id || Date.now()}`,
              type: step.type || "reasoning",
              content: step.content || step.thought || "Reasoning step",
              timestamp: step.timestamp || log.timestamp,
              confidence: step.confidence,
              metadata: step.metadata,
              children: step.children || [],
            });
          });
        }
      });

      const chains = Array.from(chainsMap.values());
      setChains(chains);

      // Mock integrity issues for demonstration
      const mockIssues = [
        {
          id: "issue-1",
          agentId: "agent-target-1",
          sessionId: "sess-def456",
          issueType: "low_confidence" as const,
          severity: "medium" as const,
          description: "Confidence score below threshold for target analysis",
          originalOutput: { targets: ["target1", "target2"], confidence: 0.65 },
          suggestedFix: { targets: ["target1"], confidence: 0.85 },
          confidence: 0.65,
          timestamp: new Date(Date.now() - 100000).toISOString(),
          metadata: { threshold: 0.7, agent: "TargetAgent" },
        },
      ];
      setIntegrityIssues(mockIssues);
    } catch (error) {
      console.error("Failed to load reasoning chains:", error);
      // Fallback to mock data if audit service fails
      setChains([
        {
          id: "chain-1",
          agentId: "agent-coord-1",
          agentName: "Coordinator",
          agentRole: "CoordinatorAgent",
          sessionId: "sess-abc123",
          rootThought: "I need to analyze the opportunity and create a value hypothesis",
          status: "completed",
          startTime: new Date(Date.now() - 300000).toISOString(),
          endTime: new Date(Date.now() - 280000).toISOString(),
          totalDuration: 20000,
          nodes: [
            {
              id: "node-1",
              type: "reasoning",
              content: "User wants to analyze opportunity for SaaS company",
              timestamp: new Date(Date.now() - 300000).toISOString(),
              confidence: 0.95,
              children: [
                {
                  id: "node-1-1",
                  type: "observation",
                  content: "Company has $5M ARR, 120% NRR",
                  timestamp: new Date(Date.now() - 299000).toISOString(),
                  confidence: 0.98,
                },
                {
                  id: "node-1-2",
                  type: "reasoning",
                  content: "High NRR suggests strong product-market fit",
                  timestamp: new Date(Date.now() - 298000).toISOString(),
                  confidence: 0.92,
                  children: [
                    {
                      id: "node-1-2-1",
                      type: "decision",
                      content: "Focus on expansion opportunities",
                      timestamp: new Date(Date.now() - 297000).toISOString(),
                      confidence: 0.94,
                    },
                  ],
                },
              ],
            },
            {
              id: "node-2",
              type: "action",
              content: "Call CRM integration tool to fetch customer data",
              timestamp: new Date(Date.now() - 295000).toISOString(),
              metadata: { tool: "crm_fetch", customerId: "cust-123" },
            },
            {
              id: "node-3",
              type: "tool_use",
              content: "Executing ROI calculation with 5-year horizon",
              timestamp: new Date(Date.now() - 290000).toISOString(),
              confidence: 0.96,
              children: [
                {
                  id: "node-3-1",
                  type: "observation",
                  content: "NPV: $2.4M, IRR: 145%, Payback: 8 months",
                  timestamp: new Date(Date.now() - 285000).toISOString(),
                  confidence: 0.99,
                },
              ],
            },
          ],
        },
        {
          id: "chain-2",
          agentId: "agent-target-1",
          agentName: "Target",
          agentRole: "TargetAgent",
          sessionId: "sess-def456",
          rootThought: "Identify high-value targets for expansion campaign",
          status: "in_progress",
          startTime: new Date(Date.now() - 120000).toISOString(),
          nodes: [
            {
              id: "node-4",
              type: "reasoning",
              content: "Analyzing customer segments for expansion potential",
              timestamp: new Date(Date.now() - 120000).toISOString(),
              confidence: 0.88,
              children: [
                {
                  id: "node-4-1",
                  type: "action",
                  content: "Querying usage patterns",
                  timestamp: new Date(Date.now() - 115000).toISOString(),
                },
              ],
            },
          ],
        },
        {
          id: "chain-3",
          agentId: "agent-real-1",
          agentName: "Realization",
          agentRole: "RealizationAgent",
          sessionId: "sess-ghi789",
          rootThought: "Execute workflow to sync data and generate report",
          status: "failed",
          startTime: new Date(Date.now() - 60000).toISOString(),
          endTime: new Date(Date.now() - 55000).toISOString(),
          totalDuration: 5000,
          nodes: [
            {
              id: "node-5",
              type: "reasoning",
              content: "Starting workflow execution",
              timestamp: new Date(Date.now() - 60000).toISOString(),
              confidence: 0.9,
            },
            {
              id: "node-6",
              type: "action",
              content: "Syncing CRM data",
              timestamp: new Date(Date.now() - 59000).toISOString(),
            },
            {
              id: "node-7",
              type: "observation",
              content: "Error: API rate limit exceeded",
              timestamp: new Date(Date.now() - 56000).toISOString(),
              confidence: 0.0,
              metadata: { error: "RATE_LIMIT", retryCount: 3 },
            },
          ],
        },
      ]);
    }
  };

  const applyFilters = () => {
    let filtered = [...chains];

    // Time range filter
    if (filters.timeRange && filters.timeRange !== "all") {
      const now = Date.now();
      const ranges = {
        "5m": 5 * 60 * 1000,
        "15m": 15 * 60 * 1000,
        "1h": 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
      };
      const cutoff = now - ranges[filters.timeRange];
      filtered = filtered.filter((c) => new Date(c.startTime).getTime() > cutoff);
    }

    // Agent role filter
    if (filters.agentRole) {
      filtered = filtered.filter((c) => c.agentRole === filters.agentRole);
    }

    // Confidence threshold filter (applies to nodes)
    if (filters.confidenceThreshold !== undefined) {
      const filterNodes = (nodes: ThoughtNode[]): boolean => {
        return nodes.some((node) => {
          const nodeConfidence = node.confidence ?? 1.0;
          const childrenMatch = node.children ? filterNodes(node.children) : true;
          return nodeConfidence >= filters.confidenceThreshold! && childrenMatch;
        });
      };
      filtered = filtered.filter((c) => filterNodes(c.nodes));
    }

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const searchNodes = (nodes: ThoughtNode[]): boolean => {
        return nodes.some((node) => {
          const contentMatch = node.content.toLowerCase().includes(query);
          const childrenMatch = node.children ? searchNodes(node.children) : false;
          return contentMatch || childrenMatch;
        });
      };
      filtered = filtered.filter(
        (c) =>
          c.rootThought.toLowerCase().includes(query) ||
          c.agentName.toLowerCase().includes(query) ||
          searchNodes(c.nodes)
      );
    }

    setFilteredChains(filtered);
  };

  const updateStats = () => {
    const totalChains = filteredChains.length;
    const completed = filteredChains.filter((c) => c.status === "completed").length;
    const failed = filteredChains.filter((c) => c.status === "failed").length;
    const inProgress = filteredChains.filter((c) => c.status === "in_progress").length;

    const avgNodes =
      filteredChains.length > 0
        ? filteredChains.reduce((acc, c) => {
            const count = (nodes: ThoughtNode[]): number => {
              return nodes.reduce(
                (sum, node) => sum + 1 + (node.children ? count(node.children) : 0),
                0
              );
            };
            return acc + count(c.nodes);
          }, 0) / filteredChains.length
        : 0;

    const avgDuration =
      filteredChains.length > 0
        ? filteredChains
            .filter((c) => c.totalDuration)
            .reduce((acc, c, _, arr) => acc + (c.totalDuration || 0) / arr.length, 0)
        : 0;

    setStats({ totalChains, avgNodes, avgDuration, completed, failed, inProgress });

    // Update available roles
    const roles = Array.from(new Set(chains.map((c) => c.agentRole)));
    setAvailableRoles(roles);
  };

  const handleIntegrityResolution = async (
    issueId: string,
    resolution: "accept" | "reject" | "modify",
    modifiedOutput?: any
  ) => {
    try {
      const res = await fetch('/api/agents/integrity/veto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, resolution, modifiedOutput }),
      });

      const payload = await res.json();

      if (!res.ok) {
        console.error('Integrity resolution failed:', payload);
        // Do not remove issue on failure
        return;
      }

      // Success: remove issue locally
      setIntegrityIssues((prev) => prev.filter((issue) => issue.id !== issueId));
    } catch (err) {
      console.error('Error resolving integrity issue:', err);
    }
  };

  const handleIntegrityDismiss = (issueId: string) => {
    setIntegrityIssues((prev) => prev.filter((issue) => issue.id !== issueId));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-card">
        <div className="flex items-center gap-4">
          <GitBranch className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Agent Reasoning Viewer</h1>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="px-6 py-3 bg-secondary/50 border-b border-border">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-card border border-border rounded p-2">
            <div className="text-xs text-muted-foreground">Total Chains</div>
            <div className="text-xl font-bold">{stats.totalChains}</div>
          </div>
          <div className="bg-card border border-border rounded p-2">
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-xl font-bold text-green-600">{stats.completed}</div>
          </div>
          <div className="bg-card border border-border rounded p-2">
            <div className="text-xs text-muted-foreground">Failed</div>
            <div className="text-xl font-bold text-red-600">{stats.failed}</div>
          </div>
          <div className="bg-card border border-border rounded p-2">
            <div className="text-xs text-muted-foreground">In Progress</div>
            <div className="text-xl font-bold text-blue-600">{stats.inProgress}</div>
          </div>
          <div className="bg-card border border-border rounded p-2">
            <div className="text-xs text-muted-foreground">Avg Nodes</div>
            <div className="text-xl font-bold">{Math.round(stats.avgNodes)}</div>
          </div>
          <div className="bg-card border border-border rounded p-2">
            <div className="text-xs text-muted-foreground">Avg Duration</div>
            <div className="text-xl font-bold">{Math.round(stats.avgDuration)}ms</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4">
        <FilterPanel
          filters={filters}
          onFilterChange={setFilters}
          availableRoles={availableRoles}
        />
      </div>

      {/* Integrity Veto Panel */}
      <div className="px-6">
        <IntegrityVetoPanel
          issues={integrityIssues}
          onResolve={handleIntegrityResolution}
          onDismiss={handleIntegrityDismiss}
        />
      </div>

      {/* Chain List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filteredChains.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <GitBranch className="w-12 h-12 mb-4 opacity-50" />
            <p>No reasoning chains found</p>
            <p className="text-sm mt-2">Adjust filters or check agent activity</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredChains.map((chain) => (
              <ReasoningChainCard key={chain.id} chain={chain} onChainSelect={setSelectedChain} />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <ChainDetailPanel chain={selectedChain} onClose={() => setSelectedChain(null)} />
    </div>
  );
};

export default AgentReasoningViewer;
