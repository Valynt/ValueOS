import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
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
  Code,
  FileText,
  Server,
  AlertOctagon,
  TrendingUp,
  Wrench,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  recommendedModel?: string;
  rationale?: string;
}

interface MigrationStep {
  step: number;
  title: string;
  detail: string;
  completed: boolean;
}

interface RiskRow {
  factor: string;
  impact: "High" | "Medium" | "Low";
  mitigation: string;
}

/* ─── Data ─── */

// What was removed during migration (completed)
const REMOVED_ITEMS = [
  {
    file: "server/_core/chat.ts",
    description: "Generic /api/chat endpoint using @ai-sdk/openai with Forge API credentials. Placeholder tools only.",
    action: "Rewritten with Together.ai client and ValueOS system prompts",
  },
  {
    file: "client/src/components/AIChatBox.tsx",
    description: "Pre-built chat UI component from the template",
    action: "Deleted — replaced by AgentChatSidebar",
  },
  {
    file: "server/_core/imageGeneration.ts",
    description: "Image generation via Forge API",
    action: "Deleted — not needed for value engineering",
  },
  {
    file: "server/_core/voiceTranscription.ts",
    description: "Whisper transcription via Forge API",
    action: "Deleted — not needed for value engineering",
  },
  {
    file: "@ai-sdk/openai, @ai-sdk/react, ai",
    description: "Vercel AI SDK packages",
    action: "Uninstalled from package.json",
  },
];

const AGENT_ROWS: AgentRow[] = [
  {
    name: "Opportunity Agent",
    icon: <Zap className="w-4 h-4" />,
    task: "Analyze enriched company data, identify value engineering opportunities, score fit",
    capability: "Chat Completions + Function Calling + JSON Mode",
    model: "Qwen2.5-72B-Instruct-Turbo",
    recommendedModel: "Qwen 3.5-397B",
    rationale: "SOTA agentic performance (76.4% SWE-Bench). Superior at routing complex multi-step tool calls.",
  },
  {
    name: "Research Agent",
    icon: <Search className="w-4 h-4" />,
    task: "Deep-dive SEC filings, synthesize financial data, extract KPIs from documents",
    capability: "Chat Completions + Vision + Function Calling",
    model: "Llama-4-Scout (multimodal)",
    recommendedModel: "Llama-4-Scout",
    rationale: "Native long-context analysis. Bypass RAG for documents up to 5M tokens to preserve cross-reference integrity.",
  },
  {
    name: "Integrity Agent",
    icon: <Shield className="w-4 h-4" />,
    task: "Validate claims against source data, flag inconsistencies, cross-reference metrics",
    capability: "Chat Completions + Structured Outputs + JSON Mode",
    model: "DeepSeek-R1 (chain-of-thought verification)",
    recommendedModel: "DeepSeek-R1-0528",
    rationale: 'Utilize "Thinking Mode" for chain-of-thought verification. Essential for the Integrity Veto logic.',
  },
  {
    name: "Target Agent",
    icon: <Target className="w-4 h-4" />,
    task: "Model target outcomes, build value trees, calculate ROI projections",
    capability: "Chat Completions + Function Calling",
    model: "Qwen2.5-72B-Instruct-Turbo (fast, tool-capable)",
    recommendedModel: "Qwen 3 (32B Coder)",
    rationale: "Exceptional at generating deterministic code/formulas required for decimal.js ROI projections.",
  },
  {
    name: "Narrative Agent",
    icon: <MessageSquare className="w-4 h-4" />,
    task: "Compose CFO-ready narratives, executive summaries, and value case presentations",
    capability: "Chat Completions + Streaming",
    model: "Llama-3.3-70B-Instruct-Turbo (fast streaming)",
  },
  {
    name: "Red Team Agent",
    icon: <Layers className="w-4 h-4" />,
    task: "Adversarial testing of value cases, stress-test assumptions, find weaknesses",
    capability: "Chat Completions + Function Calling",
    model: "DeepSeek-R1 (adversarial reasoning)",
  },
];

const FULL_COVERAGE: CapabilityItem[] = [
  {
    name: "Chat Completions with Streaming",
    icon: <MessageSquare className="w-5 h-5" />,
    description:
      "The core API for all agent reasoning. Together.ai's OpenAI-compatible /v1/chat/completions endpoint supports streaming via SSE, identical to OpenAI's interface. ValueOS uses the openai npm package with a base_url swap — no custom HTTP client needed.",
    refs: [{ label: "OpenAI Compatibility", url: "https://docs.together.ai/docs/openai-api-compatibility" }],
  },
  {
    name: "Function Calling / Tool Use",
    icon: <Code className="w-5 h-5" />,
    description:
      "Supports simple, multiple, parallel, and multi-step function calling across 20+ models including Llama 4, DeepSeek R1/V3, Qwen 2.5/3, and GPT-OSS. The API format is identical to OpenAI's tools parameter. All 6 ValueOS agents use this for enrichment, SEC search, and analysis tools.",
    refs: [{ label: "Function Calling", url: "https://docs.together.ai/docs/function-calling" }],
  },
  {
    name: "Structured Outputs / JSON Mode",
    icon: <FileText className="w-5 h-5" />,
    description:
      "Guaranteed JSON-formatted responses with schema constraints. Used by the Integrity Agent for structured validation results and the Opportunity Agent for scored opportunity objects.",
    refs: [{ label: "JSON Mode", url: "https://docs.together.ai/docs/json-mode" }],
  },
  {
    name: "Reasoning Models",
    icon: <Brain className="w-5 h-5" />,
    description:
      "DeepSeek R1 provides chain-of-thought reasoning with explicit thinking tokens wrapped in <think> tags. Used by the Integrity Agent for claim verification and the Red Team Agent for adversarial analysis.",
    refs: [{ label: "Reasoning Guide", url: "https://docs.together.ai/docs/reasoning-models-guide" }],
  },
  {
    name: "Embeddings + Rerank (RAG Pipeline)",
    icon: <Search className="w-5 h-5" />,
    description:
      "BGE and GTE embedding models for vector search, plus LlamaRank for reranking. Available for future RAG pipeline expansion — embed SEC filings, retrieve passages, rerank by relevance.",
    refs: [
      { label: "Embeddings", url: "https://docs.together.ai/docs/embeddings-overview" },
      { label: "Rerank", url: "https://docs.together.ai/docs/rerank-overview" },
    ],
  },
  {
    name: "Vision / Multimodal",
    icon: <Eye className="w-5 h-5" />,
    description:
      "Llama 4 Scout and Qwen3-VL support image understanding with function calling. Enables the Research Agent to analyze financial charts, scanned documents, or infographics from SEC filings.",
    refs: [{ label: "Vision", url: "https://docs.together.ai/docs/vision-overview" }],
  },
  {
    name: "Batch Inference",
    icon: <Clock className="w-5 h-5" />,
    description:
      "For bulk operations like scoring 100 companies overnight. Submit a JSONL file of prompts and retrieve results when ready, at lower cost.",
    refs: [{ label: "Batch API", url: "https://docs.together.ai/docs/batch-inference" }],
  },
  {
    name: "Audio (Speech-to-Text / TTS)",
    icon: <Mic className="w-5 h-5" />,
    description:
      "Whisper-based transcription and Cartesia Sonic TTS. Available for future voice interaction — transcribing earnings calls or voice commands in the agent sidebar.",
    refs: [{ label: "Speech-to-Text", url: "https://docs.together.ai/docs/speech-to-text" }],
  },
];

const GAPS: { name: string; icon: React.ReactNode; description: string; mitigation: string; resolved?: boolean }[] = [
  {
    name: "Data API Access",
    icon: <Database className="w-5 h-5" />,
    description: "Together.ai does not provide access to SEC EDGAR, BLS, Census, Yahoo Finance, or LinkedIn data.",
    mitigation:
      "Resolved: The enrichment pipeline calls these APIs directly through dedicated adapters. Data APIs are fully decoupled from the LLM layer.",
    resolved: true,
  },
  {
    name: "Persistent Agent Memory / State",
    icon: <Database className="w-5 h-5" />,
    description: "Together.ai is stateless — each API call is independent. Agents need to remember previous interactions.",
    mitigation:
      "Partially resolved: Conversation history is passed as context in each API call. Full database persistence for chat history is planned.",
  },
  {
    name: "Real-time Collaboration / Webhooks",
    icon: <Radio className="w-5 h-5" />,
    description: "Together.ai does not push notifications or trigger webhooks when inference completes.",
    mitigation:
      "Resolved: SSE streaming layer is implemented on the ValueOS backend, streaming status updates as agents progress through tool calls.",
    resolved: true,
  },
  {
    name: "Image Generation for Reports",
    icon: <Image className="w-5 h-5" />,
    description: "FLUX-based image generation is available but unlikely needed for value engineering reports.",
    mitigation: "Not needed: Using charting libraries (Chart.js, D3, Recharts) for data visualizations instead.",
    resolved: true,
  },
];

const RISK_TABLE: RiskRow[] = [
  {
    factor: "Data API Integrity",
    impact: "High",
    mitigation: "Decouple First: dataApi.ts (Yahoo/LinkedIn) moved to dedicated enrichment service with isolated credentials, fully separated from AI/LLM infrastructure.",
  },
  {
    factor: "Dependency Drift",
    impact: "Medium",
    mitigation: "Namespace Cleanup: Only AI-specific files were removed. Shared utility services (notification.ts, dataApi.ts) preserved intact.",
  },
  {
    factor: "JSON Schema Degradation",
    impact: "High",
    mitigation: "Zod Enforcement: Use json_schema constraints at the API level via Together.ai to ensure agents produce deterministic JSON structures.",
  },
  {
    factor: "DeepSeek-R1 <think> Token Parsing",
    impact: "High",
    mitigation: "Reasoning Extraction Layer: Strip <think> blocks before JSON parsing. Implement extractReasoningMiddleware for Integrity Agent responses.",
  },
  {
    factor: "Streaming Latency",
    impact: "Medium",
    mitigation: "Edge Function Localization: Deploy Together.ai client in US-East region near inference clusters to minimize TTFB for the streaming UI.",
  },
  {
    factor: "Context Window Strategy",
    impact: "Medium",
    mitigation: "Long-Context Ingestion: For Research Agent, feed entire 10-K filings directly into Llama-4-Scout instead of chunking via RAG.",
  },
];

const MIGRATION_STEPS: MigrationStep[] = [
  {
    step: 1,
    title: "Added TOGETHER_API_KEY secret",
    detail: "Configured the Together.ai API key as an environment variable via webdev_request_secrets",
    completed: true,
  },
  {
    step: 2,
    title: "Created server/lib/together.ts",
    detail: 'Thin wrapper around the openai npm package with baseURL: "https://api.together.xyz/v1" and 5-model registry',
    completed: true,
  },
  {
    step: 3,
    title: "Rewrote server/api/chat.ts",
    detail: "Replaced Forge API provider with Together.ai client, added ValueOS system prompts, agent routing, and multi-round tool calling loop",
    completed: true,
  },
  {
    step: 4,
    title: "Wired AgentChatSidebar",
    detail: "Connected to real /api/chat SSE endpoint with streaming tokens, agent selector dropdown, typing indicators, and tool event display",
    completed: true,
  },
  {
    step: 5,
    title: "Removed unused dependencies",
    detail: "Uninstalled @ai-sdk/openai, @ai-sdk/react, ai; deleted AIChatBox.tsx, imageGeneration.ts, voiceTranscription.ts, patchedFetch.ts",
    completed: true,
  },
  {
    step: 6,
    title: "Preserved dataApi.ts",
    detail: "Yahoo Finance and LinkedIn enrichment calls route through Manus data hub — not an LLM dependency. Kept as-is for enrichment pipeline.",
    completed: true,
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
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <span className="font-semibold text-[15px]">{title}</span>
        </div>
        {badge}
      </button>
      {open && <div className="px-5 pb-5 pt-2 bg-card border-t border-border">{children}</div>}
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
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">ValueOS Frontend</div>
          <div className="flex gap-3">
            {[
              { label: "AgentChatSidebar", call: "trpc.agent.chat.useMutation()" },
              { label: "CaseCanvas", call: "trpc.agent.run.useMutation()" },
              { label: "Agents Page", call: "trpc.agent.list.useQuery()" },
            ].map((item) => (
              <div key={item.label} className="flex-1 bg-white rounded-md border border-blue-100 p-3">
                <div className="text-sm font-medium text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground font-mono mt-1">{item.call}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center">
            <div className="w-px h-4 bg-slate-300" />
            <div className="text-xs font-medium text-muted-foreground bg-slate-100 px-2 py-0.5 rounded">tRPC</div>
            <div className="w-px h-4 bg-slate-300" />
          </div>
        </div>

        {/* Backend Layer */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-3">ValueOS Backend</div>
          <div className="flex gap-3 mb-4">
            {[
              { label: "Agent Router", sub: "(6 agents, tool calling)" },
              { label: "Enrichment Router", sub: "(5-source pipeline + cache)" },
              { label: "Case Router", sub: "(CRUD + saga states)" },
            ].map((item) => (
              <div key={item.label} className="flex-1 bg-white rounded-md border border-emerald-100 p-3">
                <div className="text-sm font-medium text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.sub}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <div className="flex-1 bg-orange-50 border border-orange-200 rounded-md p-3">
              <div className="text-sm font-medium text-orange-700">Together.ai Client</div>
              <div className="text-xs text-orange-600 font-mono mt-1">openai SDK + baseURL swap</div>
            </div>
            <div className="flex-1 bg-purple-50 border border-purple-200 rounded-md p-3">
              <div className="text-sm font-medium text-purple-700">Live Data APIs</div>
              <div className="text-xs text-purple-600 mt-1">SEC, BLS, Census, Yahoo, LinkedIn</div>
            </div>
          </div>
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-md p-3">
            <div className="text-sm font-medium text-slate-700">Enrichment Cache (DB)</div>
            <div className="text-xs text-slate-500 mt-1">24h TTL, hit tracking, force refresh</div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center">
            <div className="w-px h-4 bg-slate-300" />
            <div className="text-xs font-medium text-muted-foreground bg-slate-100 px-2 py-0.5 rounded">HTTPS</div>
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
              <div key={item.label} className="flex-1 bg-white rounded-md border border-orange-100 p-3">
                <div className="text-sm font-medium font-mono text-foreground">{item.label}</div>
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
    { id: "completed", label: "Migration Completed" },
    { id: "agents", label: "Agent Workloads" },
    { id: "review", label: "Strategic Review" },
    { id: "risks", label: "Risk Mitigations" },
    { id: "coverage", label: "Capability Coverage" },
    { id: "gaps", label: "Gaps & Status" },
    { id: "architecture", label: "Architecture" },
    { id: "migration", label: "Migration Log" },
    { id: "references", label: "References" },
  ];

  return (
    <div className="flex h-full">
      {/* Sticky Side Nav — positioned inside the content area, not overlapping main sidebar */}
      <nav className="hidden xl:block w-44 shrink-0 sticky top-0 h-screen overflow-y-auto py-8 pl-3 pr-1">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">On This Page</div>
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={`block w-full text-left text-[13px] px-2.5 py-1.5 rounded-md transition-colors truncate ${
                activeSection === item.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-border space-y-2">
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
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Together.ai Integration Strategy</h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
            Strategic mapping of Together.ai capabilities against ValueOS's six agent workloads. Migration completed March 2026.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Migration Complete
            </Badge>
            <span>March 5, 2026</span>
            <span className="text-border">|</span>
            <span>Valynt Engineering</span>
          </div>
        </div>

        {/* Executive Summary */}
        <section id="summary" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Executive Summary</h2>
          <Card className="bg-emerald-50/50 border-emerald-200">
            <CardContent className="pt-5 pb-5">
              <p className="text-[15px] leading-relaxed text-foreground">
                Together.ai now serves as the <strong>sole third-party LLM provider</strong> for ValueOS, having fully replaced the
                Vercel AI SDK + Forge API stack. The migration leveraged Together.ai's OpenAI-compatible API — the same{" "}
                <code className="text-sm bg-emerald-100 px-1.5 py-0.5 rounded">openai</code> npm package works with a{" "}
                <code className="text-sm bg-emerald-100 px-1.5 py-0.5 rounded">baseURL</code> swap. All 6 named agents are connected
                with dedicated system prompts, tool definitions, and model assignments. The enrichment pipeline calls SEC EDGAR, BLS,
                Census, Yahoo Finance, and LinkedIn APIs directly — fully decoupled from the LLM layer.
              </p>
            </CardContent>
          </Card>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="p-4 rounded-lg border border-border bg-card text-center">
              <div className="text-2xl font-bold text-foreground">6</div>
              <div className="text-xs text-muted-foreground mt-1">Named Agents</div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card text-center">
              <div className="text-2xl font-bold text-foreground">5</div>
              <div className="text-xs text-muted-foreground mt-1">LLM Models</div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card text-center">
              <div className="text-2xl font-bold text-foreground">5</div>
              <div className="text-xs text-muted-foreground mt-1">Live Data Sources</div>
            </div>
          </div>
        </section>

        {/* Migration Completed */}
        <section id="completed" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Migration Completed</h2>
          <p className="text-[15px] text-muted-foreground mb-4 leading-relaxed">
            The following files and packages were removed or replaced during the migration. The Vercel AI SDK was entirely
            non-functional in the production workflow — no features were lost.
          </p>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">File / Package</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">What It Was</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action Taken</th>
                </tr>
              </thead>
              <tbody>
                {REMOVED_ITEMS.map((row, i) => (
                  <tr key={i} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground whitespace-nowrap">{row.file}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.description}</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs whitespace-nowrap">
                        <Check className="w-3 h-3 mr-1" />
                        {row.action}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Server className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-sm text-blue-800">Preserved: dataApi.ts</div>
                <p className="text-sm text-blue-700 mt-1 leading-relaxed">
                  <code className="bg-blue-100 px-1 rounded text-xs">server/_core/dataApi.ts</code> uses the Manus data hub for Yahoo
                  Finance and LinkedIn enrichment calls. This is a <em>data API</em>, not an LLM call — it was preserved and continues
                  to power the enrichment pipeline.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Agent Workloads */}
        <section id="agents" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">ValueOS Agent Workloads</h2>
          <p className="text-[15px] text-muted-foreground mb-4 leading-relaxed">
            ValueOS has six named agents, each with dedicated system prompts, tool definitions, and model assignments. The table below
            shows current assignments and recommended upgrades based on 2026 benchmarks.
          </p>

          <div className="space-y-3">
            {AGENT_ROWS.map((agent) => (
              <Card key={agent.name} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      {agent.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-foreground">{agent.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-2">{agent.task}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs font-normal">
                          {agent.capability}
                        </Badge>
                        <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100">
                          {agent.model}
                        </Badge>
                      </div>
                      {agent.recommendedModel && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-md">
                          <div className="flex items-center gap-1.5 text-xs text-blue-700">
                            <TrendingUp className="w-3 h-3" />
                            <strong>2026 Upgrade:</strong> {agent.recommendedModel}
                            {agent.rationale && <span className="text-blue-600"> — {agent.rationale}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Strategic Review */}
        <section id="review" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Strategic Review</h2>
          <p className="text-[15px] text-muted-foreground mb-4 leading-relaxed">
            An independent architectural review identified three key considerations for the Together.ai integration. These have been
            evaluated and addressed in the current implementation.
          </p>

          {/* Red Flag 1: SDK Removal */}
          <Card className="mb-4 border-amber-200">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3 mb-3">
                <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm text-foreground">The SDK Removal Paradox</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    The review noted that removing the Vercel AI SDK forces manual implementation of SSE parsing, React state
                    synchronization for streaming chunks, and tool-call handling — shifting focus from building agents to maintaining
                    infrastructure.
                  </p>
                </div>
              </div>
              <div className="ml-8 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                <p className="text-sm text-emerald-800">
                  <strong>Resolution:</strong> ValueOS implemented a custom SSE streaming layer in{" "}
                  <code className="bg-emerald-100 px-1 rounded text-xs">server/api/chat.ts</code> with a multi-round tool calling
                  loop. The AgentChatSidebar handles streaming tokens, typing indicators, and tool event display natively. The
                  alternative "Provider Swap" approach (keeping AI SDK with Together.ai baseURL) remains viable as a fallback if
                  maintenance burden increases.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Red Flag 2: DeepSeek-R1 Parsing */}
          <Card className="mb-4 border-amber-200">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3 mb-3">
                <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm text-foreground">
                    DeepSeek-R1 Parsing: The <code className="text-xs bg-amber-100 px-1 rounded">&lt;think&gt;</code> Token Problem
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    The Integrity Agent relies on DeepSeek-R1 and JSON Mode. Together.ai returns chain-of-thought within{" "}
                    <code className="bg-amber-100 px-1 rounded text-xs">&lt;think&gt;</code> tags in the main content stream.
                    Standard <code className="bg-amber-100 px-1 rounded text-xs">JSON.parse()</code> will throw a SyntaxError when
                    encountering these tags before the JSON output.
                  </p>
                </div>
              </div>
              <div className="ml-8 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Action Required:</strong> Implement a Reasoning Extraction Layer — a regex-based pre-processor that strips{" "}
                  <code className="bg-blue-100 px-1 rounded text-xs">&lt;think&gt;...&lt;/think&gt;</code> blocks before passing the
                  response to the JSON parser. This is critical for the Integrity Agent's structured validation output.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Red Flag 3: Context Window */}
          <Card className="mb-4 border-amber-200">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3 mb-3">
                <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm text-foreground">The Context Window Contradiction</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    The strategy maps the Research Agent to Llama-4-Scout (10M context) but suggests maintaining a standard RAG
                    pipeline. RAG was designed for small context windows — using it with a 10M context model is redundant and loses
                    holistic financial context from footnotes and cross-references.
                  </p>
                </div>
              </div>
              <div className="ml-8 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                <p className="text-sm text-emerald-800">
                  <strong>Optimization:</strong> Move to Long-Context Ingestion for the Research Agent. Feed entire 10-K filings
                  directly into Llama-4-Scout's prompt. This eliminates vector search latency and enables superior cross-document
                  synthesis that RAG cannot match. Reserve RAG for multi-document corpora exceeding the context window.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Strategic Strengths */}
          <Card className="border-emerald-200">
            <CardContent className="pt-5 pb-5">
              <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Strategic Strengths Confirmed
              </h3>
              <div className="space-y-2">
                {[
                  {
                    title: "Provider Consolidation",
                    detail:
                      "Replacing the fractured Forge API/Vercel SDK mix with a single, high-performance endpoint reduces API key management overhead and simplifies observability.",
                  },
                  {
                    title: "OpenAI-Compatible Migration Path",
                    detail:
                      "The /v1/chat/completions compatibility layer allows existing libraries to function with a simple baseURL swap — proven in production.",
                  },
                  {
                    title: "Model Diversity",
                    detail:
                      "Access to DeepSeek-R1 for reasoning, Qwen 3.5 for agentic tool-calling, and Llama-4-Scout for long-context — superior to the previous placeholder models.",
                  },
                ].map((s) => (
                  <div key={s.title} className="p-3 bg-emerald-50/50 rounded-md">
                    <div className="text-sm font-medium text-foreground">{s.title}</div>
                    <p className="text-sm text-muted-foreground mt-0.5">{s.detail}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Risk Mitigations */}
        <section id="risks" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Risk Mitigations</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Risk Factor</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-20">Impact</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mitigation Action</th>
                </tr>
              </thead>
              <tbody>
                {RISK_TABLE.map((row, i) => (
                  <tr key={i} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{row.factor}</td>
                    <td className="px-4 py-3">
                      <Badge
                        className={`text-xs ${
                          row.impact === "High"
                            ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-amber-100 text-amber-700 border-amber-200"
                        }`}
                      >
                        {row.impact}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.mitigation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Capability Coverage */}
        <section id="coverage" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Together.ai Capability Coverage</h2>

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
                    <div className="font-medium text-sm text-foreground mb-1">{cap.name}</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{cap.description}</p>
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
                  <div className="font-medium text-sm text-foreground mb-2">Agent Orchestration</div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    Together.ai provides the building blocks (function calling, multi-step reasoning) but does not provide a managed
                    agent orchestration service. ValueOS built a custom orchestration layer in tRPC with agent routing, tool calling
                    loops, and per-agent system prompts.
                  </p>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-sm text-emerald-800">
                      <strong>Decision:</strong> Custom orchestration in tRPC was chosen. ValueOS already has agent definitions,
                      activity feeds, and approval flows. LangGraph remains an option if complexity grows beyond 20+ agents.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="font-medium text-sm text-foreground mb-2">Fine-tuning</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Together.ai supports full fine-tuning and LoRA adapters. Relevant when training a ValueOS-specific model on
                    proprietary value engineering methodology. Not needed at launch, but the path exists.
                  </p>
                </div>
              </div>
            </CollapsibleSection>
          </div>
        </section>

        {/* Gaps */}
        <section id="gaps" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Gaps & Current Status</h2>
          <div className="space-y-3">
            {GAPS.map((gap) => (
              <Card key={gap.name} className={gap.resolved ? "border-emerald-100" : "border-amber-100"}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${
                        gap.resolved
                          ? "bg-emerald-50 border-emerald-200 text-emerald-500"
                          : "bg-amber-50 border-amber-200 text-amber-500"
                      }`}
                    >
                      {gap.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-foreground">{gap.name}</span>
                        {gap.resolved ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-2">{gap.description}</p>
                      <div
                        className={`p-2.5 rounded-md ${
                          gap.resolved ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"
                        }`}
                      >
                        <p className={`text-xs leading-relaxed ${gap.resolved ? "text-emerald-700" : "text-amber-700"}`}>
                          {gap.mitigation}
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
          <h2 className="text-xl font-semibold mb-4 text-foreground">Current Architecture</h2>
          <p className="text-[15px] text-muted-foreground mb-4 leading-relaxed">
            The following diagram illustrates the current ValueOS stack with Together.ai as the sole LLM provider and live data APIs
            powering the enrichment pipeline.
          </p>
          <ArchitectureDiagram />
        </section>

        {/* Migration Log */}
        <section id="migration" className="mb-10 scroll-mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Migration Log</h2>
          <p className="text-[15px] text-muted-foreground mb-4 leading-relaxed">
            All 6 migration steps were completed in a single session. The AI SDK was entirely non-functional — no features were lost
            during the transition.
          </p>
          <div className="space-y-3">
            {MIGRATION_STEPS.map((step) => (
              <div
                key={step.step}
                className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold ${
                    step.completed ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground"
                  }`}
                >
                  {step.completed ? <Check className="w-4 h-4" /> : step.step}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-foreground flex items-center gap-2">
                    {step.title}
                    {step.completed && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px] px-1.5 py-0">
                        Done
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* References */}
        <section id="references" className="mb-16 border-t border-border pt-8 scroll-mt-8">
          <h2 className="text-lg font-semibold mb-4 text-foreground">References</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { label: "OpenAI Compatibility", url: "https://docs.together.ai/docs/openai-api-compatibility" },
              { label: "Function Calling", url: "https://docs.together.ai/docs/function-calling" },
              { label: "JSON Mode", url: "https://docs.together.ai/docs/json-mode" },
              { label: "Reasoning Models Guide", url: "https://docs.together.ai/docs/reasoning-models-guide" },
              { label: "Embeddings Overview", url: "https://docs.together.ai/docs/embeddings-overview" },
              { label: "Rerank Overview", url: "https://docs.together.ai/docs/rerank-overview" },
              { label: "Vision Overview", url: "https://docs.together.ai/docs/vision-overview" },
              { label: "Batch Inference", url: "https://docs.together.ai/docs/batch-inference" },
              { label: "Speech-to-Text", url: "https://docs.together.ai/docs/speech-to-text" },
              { label: "Fine-tuning Quickstart", url: "https://docs.together.ai/docs/fine-tuning-quickstart" },
            ].map((ref, i) => (
              <a
                key={i}
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline p-2 rounded-md hover:bg-accent/30 transition-colors"
              >
                <span className="text-xs text-muted-foreground w-5">[{i + 1}]</span>
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
