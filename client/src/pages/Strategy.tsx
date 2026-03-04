import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  ArrowRight,
  Zap,
  Brain,
  MessageSquare,
  Shield,
  Target,
  Layers,
  Search,
  Eye,
  Mic,
  Database,
  Clock,
  Radio,
  Image,
  GitBranch,
  Trash2,
  Plus,
  RefreshCw,
  Code,
  FileText,
  Server,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ─── Types ─── */
interface CapabilityItem {
  name: string;
  icon: React.ReactNode;
  description: string;
  refs: { label: string; url: string }[];
}

interface AgentRow {
  name: string;
  icon: React.ReactNode;
  task: string;
  capability: string;
  model: string;
}

interface AuditRow {
  file: string;
  description: string;
  status: string;
  statusType: "unused" | "never" | "ref";
}

interface MigrationStep {
  step: number;
  title: string;
  detail: string;
  icon: React.ReactNode;
}

/* ─── Data ─── */
const AUDIT_ROWS: AuditRow[] = [
  {
    file: "server/_core/chat.ts",
    description:
      "Generic /api/chat endpoint using @ai-sdk/openai with Forge API credentials. Placeholder tools only (weather, calculator).",
    status: "Registered but unused",
    statusType: "unused",
  },
  {
    file: "client/src/components/AIChatBox.tsx",
    description: "Pre-built chat UI component from the template",
    status: "Never imported",
    statusType: "never",
  },
  {
    file: "server/_core/imageGeneration.ts",
    description: "Image generation via Forge API",
    status: "Never called",
    statusType: "never",
  },
  {
    file: "server/_core/voiceTranscription.ts",
    description: "Whisper transcription via Forge API",
    status: "Never called",
    statusType: "never",
  },
  {
    file: "references/ai-sdk.md",
    description: "AI SDK documentation files",
    status: "Reference only",
    statusType: "ref",
  },
];

const AGENT_ROWS: AgentRow[] = [
  {
    name: "Opportunity Agent",
    icon: <Zap className="w-4 h-4" />,
    task: "Analyze enriched company data, identify value engineering opportunities, score fit",
    capability: "Chat Completions + Function Calling + JSON Mode",
    model: "DeepSeek-V3 or Qwen2.5-72B-Instruct-Turbo",
  },
  {
    name: "Research Agent",
    icon: <Search className="w-4 h-4" />,
    task: "Deep-dive SEC filings, synthesize financial data, extract KPIs from documents",
    capability: "Chat Completions + Vision + Function Calling",
    model: "Llama-4-Scout (multimodal) or DeepSeek-R1",
  },
  {
    name: "Integrity Agent",
    icon: <Shield className="w-4 h-4" />,
    task: "Validate claims against source data, flag inconsistencies, cross-reference metrics",
    capability: "Chat Completions + Structured Outputs + JSON Mode",
    model: "DeepSeek-R1 (chain-of-thought verification)",
  },
  {
    name: "Target Agent",
    icon: <Target className="w-4 h-4" />,
    task: "Model target outcomes, build value trees, calculate ROI projections",
    capability: "Chat Completions + Function Calling",
    model: "Qwen2.5-72B-Instruct-Turbo (fast, tool-capable)",
  },
  {
    name: "Value Architect",
    icon: <MessageSquare className="w-4 h-4" />,
    task: "Conversational assistant for the sidebar panel, answers questions about cases",
    capability: "Chat Completions + Streaming",
    model: "Llama-3.3-70B-Instruct-Turbo (fast streaming)",
  },
  {
    name: "Orchestrator",
    icon: <Layers className="w-4 h-4" />,
    task: "Route tasks to the right agent, manage multi-step workflows",
    capability: "Chat Completions + Function Calling",
    model: "Qwen2.5-72B-Instruct-Turbo or DeepSeek-V3",
  },
];

const FULL_COVERAGE: CapabilityItem[] = [
  {
    name: "Chat Completions with Streaming",
    icon: <MessageSquare className="w-5 h-5" />,
    description:
      "The core API for all agent reasoning. Together.ai's OpenAI-compatible /v1/chat/completions endpoint supports streaming via SSE, identical to OpenAI's interface. A direct openai SDK call with base_url swap is the simplest integration path.",
    refs: [
      {
        label: "OpenAI Compatibility",
        url: "https://docs.together.ai/docs/openai-api-compatibility",
      },
    ],
  },
  {
    name: "Function Calling / Tool Use",
    icon: <Code className="w-5 h-5" />,
    description:
      "Supports simple, multiple, parallel, and multi-step function calling across 20+ models including Llama 4, DeepSeek R1/V3, Qwen 2.5/3, and GPT-OSS. The API format is identical to OpenAI's tools parameter.",
    refs: [
      {
        label: "Function Calling",
        url: "https://docs.together.ai/docs/function-calling",
      },
    ],
  },
  {
    name: "Structured Outputs / JSON Mode",
    icon: <FileText className="w-5 h-5" />,
    description:
      "Guaranteed JSON-formatted responses with schema constraints. Critical for the Integrity Agent (structured validation results) and the Opportunity Agent (scored opportunity objects).",
    refs: [
      { label: "JSON Mode", url: "https://docs.together.ai/docs/json-mode" },
    ],
  },
  {
    name: "Reasoning Models",
    icon: <Brain className="w-5 h-5" />,
    description:
      "DeepSeek R1 provides chain-of-thought reasoning with explicit thinking tokens. Ideal for the Integrity Agent's claim verification and the Research Agent's financial analysis.",
    refs: [
      {
        label: "Reasoning Guide",
        url: "https://docs.together.ai/docs/reasoning-models-guide",
      },
    ],
  },
  {
    name: "Embeddings + Rerank (RAG Pipeline)",
    icon: <Search className="w-5 h-5" />,
    description:
      "BGE and GTE embedding models for vector search, plus LlamaRank for reranking. Enables a full RAG pipeline for the Research Agent — embed SEC filings, retrieve passages, rerank by relevance.",
    refs: [
      {
        label: "Embeddings",
        url: "https://docs.together.ai/docs/embeddings-overview",
      },
      {
        label: "Rerank",
        url: "https://docs.together.ai/docs/rerank-overview",
      },
    ],
  },
  {
    name: "Vision / Multimodal",
    icon: <Eye className="w-5 h-5" />,
    description:
      "Llama 4 Scout and Qwen3-VL support image understanding with function calling. Allows the Research Agent to analyze financial charts, scanned documents, or infographics.",
    refs: [
      {
        label: "Vision",
        url: "https://docs.together.ai/docs/vision-overview",
      },
    ],
  },
  {
    name: "Batch Inference",
    icon: <Clock className="w-5 h-5" />,
    description:
      "For bulk operations like scoring 100 companies overnight. Submit a JSONL file of prompts and retrieve results when ready, at lower cost.",
    refs: [
      {
        label: "Batch API",
        url: "https://docs.together.ai/docs/batch-inference",
      },
    ],
  },
  {
    name: "Audio (Speech-to-Text / TTS)",
    icon: <Mic className="w-5 h-5" />,
    description:
      "Whisper-based transcription and Cartesia Sonic TTS. Available if ValueOS needs voice interaction — transcribing earnings calls or voice commands in the agent sidebar.",
    refs: [
      {
        label: "Speech-to-Text",
        url: "https://docs.together.ai/docs/speech-to-text",
      },
    ],
  },
];

const GAPS: {
  name: string;
  icon: React.ReactNode;
  description: string;
  mitigation: string;
}[] = [
  {
    name: "Data API Access",
    icon: <Database className="w-5 h-5" />,
    description:
      "Together.ai does not provide access to SEC EDGAR, BLS, Census, Yahoo Finance, or LinkedIn data.",
    mitigation:
      "Not an AI gap — the enrichment pipeline calls these APIs directly. Keep the existing data integration layer regardless of LLM provider.",
  },
  {
    name: "Persistent Agent Memory / State",
    icon: <Database className="w-5 h-5" />,
    description:
      "Together.ai is stateless — each API call is independent. Agents need to remember previous interactions.",
    mitigation:
      "Store conversation history and agent state in the ValueOS database. Pass relevant history as context in each API call (standard pattern).",
  },
  {
    name: "Real-time Collaboration / Webhooks",
    icon: <Radio className="w-5 h-5" />,
    description:
      "Together.ai does not push notifications or trigger webhooks when inference completes.",
    mitigation:
      "Implement WebSocket/SSE layer on the ValueOS backend, streaming status updates as agents progress through tool calls.",
  },
  {
    name: "Image Generation for Reports",
    icon: <Image className="w-5 h-5" />,
    description:
      "FLUX-based image generation is available but unlikely needed for value engineering reports.",
    mitigation:
      "Use charting libraries (Chart.js, D3, Recharts) for data visualizations instead of AI-generated images.",
  },
];

const MIGRATION_STEPS: MigrationStep[] = [
  {
    step: 1,
    title: "Add TOGETHER_API_KEY secret",
    detail: "Configure the Together.ai API key as an environment variable",
    icon: <Plus className="w-4 h-4" />,
  },
  {
    step: 2,
    title: "Create server/togetherClient.ts",
    detail:
      'Thin wrapper around the openai npm package with base_url: "https://api.together.xyz/v1"',
    icon: <Code className="w-4 h-4" />,
  },
  {
    step: 3,
    title: "Rewrite server/_core/chat.ts",
    detail:
      "Replace Forge API provider with the Together client, add ValueOS-specific system prompts and tools",
    icon: <RefreshCw className="w-4 h-4" />,
  },
  {
    step: 4,
    title: "Wire AgentChatSidebar",
    detail:
      "Replace the fake setTimeout with a real tRPC mutation calling the Together-backed chat endpoint",
    icon: <GitBranch className="w-4 h-4" />,
  },
  {
    step: 5,
    title: "Remove unused dependencies",
    detail:
      "Uninstall @ai-sdk/openai, @ai-sdk/react, ai; delete AIChatBox.tsx, imageGeneration.ts, voiceTranscription.ts",
    icon: <Trash2 className="w-4 h-4" />,
  },
  {
    step: 6,
    title: "Preserve dataApi.ts",
    detail:
      "This calls Manus's data hub for Yahoo Finance / LinkedIn, not an LLM. Keep as-is or replace with direct API calls later.",
    icon: <Server className="w-4 h-4" />,
  },
];

/* ─── Collapsible Section ─── */
function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  badge,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-card hover:bg-accent/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-[15px]">{title}</span>
        </div>
        {badge}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-2 bg-card border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Architecture Diagram ─── */
function ArchitectureDiagram() {
  return (
    <div className="relative bg-gradient-to-b from-slate-50 to-white rounded-xl border border-border p-6 overflow-x-auto">
      <div className="min-w-[640px] space-y-4">
        {/* Frontend Layer */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">
            ValueOS Frontend
          </div>
          <div className="flex gap-3">
            {[
              {
                label: "AgentChatSidebar",
                call: "trpc.agent.chat.useMutation()",
              },
              {
                label: "CaseCanvas",
                call: "trpc.agent.run.useMutation()",
              },
              {
                label: "Agents Page",
                call: "trpc.agent.list.useQuery()",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex-1 bg-white rounded-md border border-blue-100 p-3"
              >
                <div className="text-sm font-medium text-foreground">
                  {item.label}
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  {item.call}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center">
            <div className="w-px h-4 bg-slate-300" />
            <div className="text-xs font-medium text-muted-foreground bg-slate-100 px-2 py-0.5 rounded">
              tRPC
            </div>
            <div className="w-px h-4 bg-slate-300" />
          </div>
        </div>

        {/* Backend Layer */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-3">
            ValueOS Backend
          </div>
          <div className="flex gap-3 mb-4">
            {[
              { label: "Agent Router", sub: "(orchestrate)" },
              { label: "Enrichment Router", sub: "(data pipeline)" },
              { label: "Case Router", sub: "(CRUD)" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex-1 bg-white rounded-md border border-emerald-100 p-3"
              >
                <div className="text-sm font-medium text-foreground">
                  {item.label}
                </div>
                <div className="text-xs text-muted-foreground">{item.sub}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <div className="flex-1 bg-orange-50 border border-orange-200 rounded-md p-3">
              <div className="text-sm font-medium text-orange-700">
                Together.ai Client
              </div>
              <div className="text-xs text-orange-600 font-mono mt-1">
                openai SDK + base_url swap
              </div>
            </div>
            <div className="flex-1 bg-purple-50 border border-purple-200 rounded-md p-3">
              <div className="text-sm font-medium text-purple-700">
                Data APIs
              </div>
              <div className="text-xs text-purple-600 mt-1">
                SEC, BLS, Census, Yahoo, LinkedIn
              </div>
            </div>
          </div>
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-md p-3">
            <div className="text-sm font-medium text-slate-700">
              Agent State Store (DB)
            </div>
            <div className="text-xs text-slate-500 mt-1">
              conversations, agent_runs, tool_call_logs
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center">
            <div className="w-px h-4 bg-slate-300" />
            <div className="text-xs font-medium text-muted-foreground bg-slate-100 px-2 py-0.5 rounded">
              HTTPS
            </div>
            <div className="w-px h-4 bg-slate-300" />
          </div>
        </div>

        {/* Together.ai Layer */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-3">
            Together.ai API — api.together.xyz/v1
          </div>
          <div className="flex gap-3">
            {[
              { label: "/chat/completions", sub: "reasoning, tool calling" },
              { label: "/embeddings", sub: "RAG vector search" },
              { label: "/rerank", sub: "retrieval quality" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex-1 bg-white rounded-md border border-orange-100 p-3"
              >
                <div className="text-sm font-medium font-mono text-foreground">
                  {item.label}
                </div>
                <div className="text-xs text-muted-foreground">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function Strategy() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const NAV_ITEMS = [
    { id: "summary", label: "Executive Summary" },
    { id: "audit", label: "Current State Audit" },
    { id: "agents", label: "Agent Workloads" },
    { id: "coverage", label: "Capability Coverage" },
    { id: "gaps", label: "Gaps" },
    { id: "architecture", label: "Architecture" },
    { id: "migration", label: "Migration Path" },
    { id: "confirmation", label: "Confirmation" },
  ];

  return (
    <div className="flex h-full">
      {/* Sticky Side Nav */}
      <nav className="hidden lg:block w-56 shrink-0 border-r border-border sticky top-0 h-screen overflow-y-auto py-8 px-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          On This Page
        </div>
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={`block w-full text-left text-[13px] px-3 py-1.5 rounded-md transition-colors ${
                activeSection === item.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-8 pt-4 border-t border-border">
          <a
            href="https://www.together.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            together.ai
          </a>
          <a
            href="https://docs.together.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
          >
            <ExternalLink className="w-3 h-3" />
            API Docs
          </a>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto py-8 px-6 lg:px-10 max-w-4xl">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <span>Valynt Engineering</span>
            <span className="text-border">/</span>
            <span>Strategy</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
            Together.ai Integration Strategy
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
            A strategic mapping of Together.ai capabilities against ValueOS's
            six agent workloads, with gap analysis and migration path.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <span>March 4, 2026</span>
            <span className="text-border">|</span>
            <span>Prepared for Valynt Engineering</span>
          </div>
        </div>

        {/* Executive Summary */}
        <section id="summary" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Executive Summary
          </h2>
          <Card className="bg-emerald-50/50 border-emerald-200">
            <CardContent className="pt-5 pb-5">
              <p className="text-[15px] leading-relaxed text-foreground">
                Together.ai can serve as the{" "}
                <strong>sole third-party LLM provider</strong> for ValueOS,
                replacing the current Vercel AI SDK + Forge API stack entirely.
                Together.ai's OpenAI-compatible API means the migration path is
                straightforward — the same{" "}
                <code className="text-sm bg-emerald-100 px-1.5 py-0.5 rounded">
                  openai
                </code>{" "}
                npm package works with a base URL swap. The codebase audit
                confirms that AI SDK usage is minimal and entirely
                non-functional in the production workflow.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Current State Audit */}
        <section id="audit" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Current State: What Needs to Be Removed
          </h2>
          <p className="text-[15px] text-muted-foreground mb-4 leading-relaxed">
            The codebase audit found that AI SDK and Forge API usage is minimal
            and entirely non-functional in the production workflow. Nothing will
            break when these dependencies are removed.
          </p>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    File
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    What It Does
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {AUDIT_ROWS.map((row, i) => (
                  <tr
                    key={i}
                    className="border-t border-border hover:bg-accent/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-foreground whitespace-nowrap">
                      {row.file}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.description}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          row.statusType === "never"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs whitespace-nowrap"
                      >
                        {row.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-sm text-amber-800">
                  Important Caveat
                </div>
                <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                  <code className="bg-amber-100 px-1 rounded text-xs">
                    server/_core/dataApi.ts
                  </code>{" "}
                  uses Forge API for the Yahoo Finance and LinkedIn enrichment
                  calls. This is a <em>data API</em>, not an LLM call — it
                  routes through Manus's built-in data hub. This must be
                  preserved or replaced with direct API calls. It is not an AI
                  SDK dependency.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Packages to remove:</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              {["@ai-sdk/openai", "@ai-sdk/react", "ai"].map((pkg) => (
                <code
                  key={pkg}
                  className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md"
                >
                  {pkg}
                </code>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Replace with:</strong>
            </p>
            <code className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-md">
              TOGETHER_API_KEY
            </code>
          </div>
        </section>

        {/* Agent Workloads */}
        <section id="agents" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            ValueOS Agent Workloads
          </h2>
          <p className="text-[15px] text-muted-foreground mb-4 leading-relaxed">
            ValueOS has six named agents, each with distinct reasoning
            requirements. The table below maps each agent to the Together.ai
            capabilities it would consume.
          </p>

          <div className="space-y-3">
            {AGENT_ROWS.map((agent) => (
              <Card
                key={agent.name}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      {agent.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-foreground">
                          {agent.name}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                        {agent.task}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {agent.capability}
                        </Badge>
                        <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100">
                          {agent.model}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Capability Coverage */}
        <section id="coverage" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Together.ai Capability Coverage
          </h2>

          <CollapsibleSection
            title="Full Coverage (No Gaps)"
            defaultOpen={true}
            badge={
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                <CheckCircle2 className="w-3 h-3 mr-1" />8 capabilities
              </Badge>
            }
          >
            <div className="space-y-4 mt-2">
              {FULL_COVERAGE.map((cap) => (
                <div key={cap.name} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5 text-emerald-600">
                    {cap.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm text-foreground mb-1">
                      {cap.name}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {cap.description}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {cap.refs.map((ref) => (
                        <a
                          key={ref.url}
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {ref.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <div className="mt-4">
            <CollapsibleSection
              title="Partial Coverage (Architectural Decision Required)"
              badge={
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                  <AlertTriangle className="w-3 h-3 mr-1" />2 items
                </Badge>
              }
            >
              <div className="space-y-4 mt-2">
                <div>
                  <div className="font-medium text-sm text-foreground mb-2">
                    Agent Orchestration
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    Together.ai provides the building blocks (function calling,
                    multi-step reasoning) but does not provide a managed agent
                    orchestration service. You must build the orchestration layer
                    yourself.
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                            Approach
                          </th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                            Pros
                          </th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                            Cons
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-border">
                          <td className="px-4 py-2 font-medium text-foreground">
                            Custom in tRPC
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            Full control, no extra deps, single codebase
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            More code, manual retry/timeout handling
                          </td>
                        </tr>
                        <tr className="border-t border-border">
                          <td className="px-4 py-2 font-medium text-foreground">
                            Framework (LangGraph, CrewAI)
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            Battle-tested patterns, built-in state machines
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            Framework dependency, potential lock-in
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Recommendation:</strong> Start with custom
                      orchestration in tRPC. ValueOS already has agent
                      definitions, activity feeds, and approval flows. Revisit
                      LangGraph if complexity grows beyond 20+ agents.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="font-medium text-sm text-foreground mb-2">
                    Fine-tuning
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Together.ai supports full fine-tuning and LoRA adapters.
                    Relevant when training a ValueOS-specific model on
                    proprietary value engineering methodology. Not needed at
                    launch, but the path exists.
                  </p>
                </div>
              </div>
            </CollapsibleSection>
          </div>
        </section>

        {/* Gaps */}
        <section id="gaps" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Gaps (Not Covered by Together.ai)
          </h2>
          <div className="space-y-3">
            {GAPS.map((gap) => (
              <Card key={gap.name} className="border-red-100">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0 mt-0.5 text-red-500">
                      {gap.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-foreground">
                          {gap.name}
                        </span>
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                        {gap.description}
                      </p>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <strong>Mitigation:</strong> {gap.mitigation}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Architecture */}
        <section id="architecture" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Recommended Architecture
          </h2>
          <p className="text-[15px] text-muted-foreground mb-4 leading-relaxed">
            The following diagram illustrates how Together.ai fits into the
            ValueOS stack, replacing the current AI SDK + Forge API layer.
          </p>
          <ArchitectureDiagram />
        </section>

        {/* Migration Path */}
        <section id="migration" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Migration Path
          </h2>
          <p className="text-[15px] text-muted-foreground mb-4 leading-relaxed">
            The migration from AI SDK + Forge API to Together.ai is a{" "}
            <strong>single-session effort</strong> because the current AI usage
            is entirely non-functional.
          </p>
          <div className="space-y-3">
            {MIGRATION_STEPS.map((step) => (
              <div
                key={step.step}
                className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-sm font-semibold">
                  {step.step}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-foreground">
                    {step.title}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {step.detail}
                  </p>
                </div>
                <div className="text-muted-foreground shrink-0">{step.icon}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Confirmation */}
        <section id="confirmation" className="mb-16 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Confirmation: It Is Just AI SDK
          </h2>
          <Card className="bg-blue-50/50 border-blue-200">
            <CardContent className="pt-5 pb-5">
              <p className="text-[15px] leading-relaxed text-foreground">
                The only AI/LLM dependency in the codebase is the{" "}
                <strong>Vercel AI SDK</strong> (
                <code className="text-sm bg-blue-100 px-1.5 py-0.5 rounded">
                  ai
                </code>
                ,{" "}
                <code className="text-sm bg-blue-100 px-1.5 py-0.5 rounded">
                  @ai-sdk/openai
                </code>
                ,{" "}
                <code className="text-sm bg-blue-100 px-1.5 py-0.5 rounded">
                  @ai-sdk/react
                </code>
                ) configured to use the Manus Forge API as its provider. There
                are no other LLM integrations, no direct OpenAI calls, no
                Anthropic SDK, no LangChain — just the AI SDK template code that
                was auto-scaffolded and never connected to any ValueOS logic.
              </p>
              <p className="text-[15px] leading-relaxed text-foreground mt-3">
                The Forge API references in{" "}
                <code className="text-sm bg-blue-100 px-1.5 py-0.5 rounded">
                  server/_core/
                </code>{" "}
                are the Manus platform's built-in service layer. Some of these
                (like{" "}
                <code className="text-sm bg-blue-100 px-1.5 py-0.5 rounded">
                  dataApi.ts
                </code>{" "}
                for Yahoo Finance and{" "}
                <code className="text-sm bg-blue-100 px-1.5 py-0.5 rounded">
                  notification.ts
                </code>{" "}
                for owner alerts) are <em>data/utility services</em>, not LLM
                calls, and should be preserved regardless of the LLM provider
                choice.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* References */}
        <section className="mb-16 border-t border-border pt-8">
          <h2 className="text-lg font-semibold mb-4 text-foreground">
            References
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              {
                label: "OpenAI Compatibility",
                url: "https://docs.together.ai/docs/openai-api-compatibility",
              },
              {
                label: "Function Calling",
                url: "https://docs.together.ai/docs/function-calling",
              },
              {
                label: "JSON Mode",
                url: "https://docs.together.ai/docs/json-mode",
              },
              {
                label: "Reasoning Models Guide",
                url: "https://docs.together.ai/docs/reasoning-models-guide",
              },
              {
                label: "Embeddings Overview",
                url: "https://docs.together.ai/docs/embeddings-overview",
              },
              {
                label: "Rerank Overview",
                url: "https://docs.together.ai/docs/rerank-overview",
              },
              {
                label: "Vision Overview",
                url: "https://docs.together.ai/docs/vision-overview",
              },
              {
                label: "Batch Inference",
                url: "https://docs.together.ai/docs/batch-inference",
              },
              {
                label: "Speech-to-Text",
                url: "https://docs.together.ai/docs/speech-to-text",
              },
              {
                label: "Fine-tuning Quickstart",
                url: "https://docs.together.ai/docs/fine-tuning-quickstart",
              },
            ].map((ref, i) => (
              <a
                key={i}
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline p-2 rounded-md hover:bg-accent/30 transition-colors"
              >
                <span className="text-xs text-muted-foreground w-5">
                  [{i + 1}]
                </span>
                <ExternalLink className="w-3 h-3 shrink-0" />
                {ref.label}
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
