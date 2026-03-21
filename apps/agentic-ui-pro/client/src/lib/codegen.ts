// ============================================================
// AGENTIC UI PRO — Code Generation Engine
// Generates realistic React + shadcn/ui page skeletons
// ============================================================

import type { PromptIntent, Pattern, LayoutArchetype } from '@/types';

export function generateCode(
  intent: PromptIntent,
  topPattern: Pattern | undefined,
  layout: LayoutArchetype
): string {
  const componentName = toComponentName(intent.productContext || 'GeneratedPage');
  const sections = topPattern?.exampleSections || ['Header', 'Main Content', 'Sidebar'];

  switch (layout) {
    case 'full-width-dashboard':
      return generateDashboardLayout(componentName, intent, sections);
    case 'three-column':
      return generateThreeColumnLayout(componentName, intent, sections);
    case 'sidebar-main':
      return generateSidebarMainLayout(componentName, intent, sections);
    case 'wizard-stepper':
      return generateWizardLayout(componentName, intent);
    case 'command-center':
      return generateCommandCenterLayout(componentName, intent, sections);
    case 'split-pane':
      return generateSplitPaneLayout(componentName, intent, sections);
    default:
      return generateDashboardLayout(componentName, intent, sections);
  }
}

function toComponentName(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
    .replace(/^[^A-Za-z]/, 'Page')
    .slice(0, 40) || 'GeneratedPage';
}

function generateDashboardLayout(name: string, intent: PromptIntent, sections: string[]): string {
  return `import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Activity, AlertTriangle, BarChart3, Bot, CheckCircle2,
  Clock, RefreshCw, Settings, TrendingUp, Zap
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────
interface MetricCard {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: React.ReactNode;
}

// ── Mock Data ──────────────────────────────────────────────────
const metrics: MetricCard[] = [
  { label: "Active Agents", value: "12", change: "+3 today", trend: "up", icon: <Bot className="h-4 w-4" /> },
  { label: "Runs Completed", value: "1,284", change: "+18%", trend: "up", icon: <CheckCircle2 className="h-4 w-4" /> },
  { label: "Avg Latency", value: "1.4s", change: "-0.2s", trend: "up", icon: <Zap className="h-4 w-4" /> },
  { label: "Success Rate", value: "97.3%", change: "+0.8%", trend: "up", icon: <TrendingUp className="h-4 w-4" /> },
];

const recentActivity = [
  { id: 1, agent: "Proposal Agent", action: "Completed run #4821", status: "success", time: "2m ago" },
  { id: 2, agent: "Triage Agent", action: "Awaiting human review", status: "pending", time: "5m ago" },
  { id: 3, agent: "Analytics Agent", action: "Failed: timeout", status: "error", time: "12m ago" },
  { id: 4, agent: "Onboarding Agent", action: "Completed run #4820", status: "success", time: "18m ago" },
];

// ── Component ──────────────────────────────────────────────────
export default function ${name}() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1200);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold font-display">${intent.productContext}</h1>
          <p className="text-xs text-muted-foreground">Last updated: just now</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className={\`h-3.5 w-3.5 mr-1.5 \${isRefreshing ? "animate-spin" : ""}\`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Configure
          </Button>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Alert Banner */}
        <Alert className="border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-sm">
            1 agent requires human review.{" "}
            <Button variant="link" className="h-auto p-0 text-sm text-amber-400">
              Review now →
            </Button>
          </AlertDescription>
        </Alert>

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <Card key={metric.label} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{metric.label}</span>
                  <span className="text-muted-foreground">{metric.icon}</span>
                </div>
                <div className="text-2xl font-semibold font-display">{metric.value}</div>
                <div className="text-xs text-emerald-400 mt-1">{metric.change}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Activity Feed */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentActivity.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={item.status === "success" ? "default" : item.status === "error" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {item.status}
                        </Badge>
                        <div>
                          <div className="text-sm font-medium">{item.agent}</div>
                          <div className="text-xs text-muted-foreground">{item.action}</div>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.time}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* System Health */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Agent Availability", value: 98 },
                    { label: "API Health", value: 100 },
                    { label: "Queue Depth", value: 72 },
                    { label: "Memory Usage", value: 61 },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium">{item.value}%</span>
                      </div>
                      <Progress value={item.value} className="h-1.5" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="agents" className="mt-4">
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Agent management view — connect to your agent registry
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Analytics view — connect to your metrics store
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}`;
}

function generateThreeColumnLayout(name: string, intent: PromptIntent, sections: string[]): string {
  return `import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Bot, CheckCircle2, ChevronDown, ChevronRight, Clock,
  FileText, Search, Shield, ThumbsDown, ThumbsUp, XCircle
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────
interface QueueItem {
  id: string;
  title: string;
  type: string;
  priority: "critical" | "high" | "normal";
  age: string;
  confidence: number;
}

// ── Mock Data ──────────────────────────────────────────────────
const queueItems: QueueItem[] = [
  { id: "q-001", title: "Enterprise Proposal — Acme Corp", type: "Proposal", priority: "critical", age: "2h", confidence: 87 },
  { id: "q-002", title: "Contract Amendment — TechCo", type: "Contract", priority: "high", age: "4h", confidence: 72 },
  { id: "q-003", title: "Renewal Proposal — StartupX", type: "Proposal", priority: "normal", age: "6h", confidence: 91 },
  { id: "q-004", title: "SOW Draft — MegaCorp", type: "SOW", priority: "high", age: "8h", confidence: 65 },
];

const priorityColors = {
  critical: "destructive",
  high: "default",
  normal: "secondary",
} as const;

// ── Component ──────────────────────────────────────────────────
export default function ${name}() {
  const [selected, setSelected] = useState<QueueItem>(queueItems[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const filtered = queueItems.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left: Queue Sidebar */}
      <aside className="w-72 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold font-display text-sm mb-3">Review Queue</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search queue..."
              className="pl-8 h-8 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className={\`w-full text-left p-3 rounded-md transition-colors \${
                  selected.id === item.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted/50"
                }\`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Badge variant={priorityColors[item.priority]} className="text-xs">
                    {item.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.age}
                  </span>
                </div>
                <div className="text-sm font-medium truncate">{item.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.type}</div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Center: Review Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h1 className="font-semibold font-display">{selected.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">{selected.type}</Badge>
              <span className="text-xs text-muted-foreground">AI Confidence: {selected.confidence}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Reject
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject this item?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reject the AI-generated content and return it for revision.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive">Reject</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button size="sm">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Approve
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-6">
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Document Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm prose-invert max-w-none">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This is the AI-generated content for review. In a real implementation,
                  this would render the actual document with diff highlighting showing
                  AI-generated sections versus original content.
                </p>
                <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-md">
                  <p className="text-sm">
                    [AI-generated section highlighted here — connect to your document store]
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feedback */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Was this AI output helpful?</span>
            <Button variant="ghost" size="sm" className="h-7">
              <ThumbsUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7">
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </ScrollArea>
      </main>

      {/* Right: Context & Reasoning */}
      <aside className="w-80 border-l border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold font-display text-sm flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            AI Context
          </h2>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {/* Confidence */}
            <Card className="bg-muted/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">AI Confidence</span>
                  <Badge variant={selected.confidence > 80 ? "default" : "secondary"}>
                    {selected.confidence > 80 ? "High" : "Moderate"}
                  </Badge>
                </div>
                <div className="text-2xl font-semibold font-display text-primary">
                  {selected.confidence}%
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Reasoning Trace */}
            <Collapsible open={reasoningOpen} onOpenChange={setReasoningOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  Reasoning Trace
                </span>
                {reasoningOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-2">
                {[
                  "Analyzed 3 similar historical proposals",
                  "Applied company-specific pricing rules",
                  "Validated against compliance checklist",
                  "Generated structured output from template",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="text-primary font-mono mt-0.5">{i + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </aside>
    </div>
  );
}`;
}

function generateSidebarMainLayout(name: string, intent: PromptIntent, sections: string[]): string {
  return `import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Bell, ChevronRight, CreditCard, Lock, Save, Settings,
  Shield, Users, Zap
} from "lucide-react";

// ── Navigation Items ───────────────────────────────────────────
const navSections = [
  {
    label: "General",
    items: [
      { id: "overview", label: "Overview", icon: Settings },
      { id: "notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Security",
    items: [
      { id: "permissions", label: "Permissions", icon: Lock },
      { id: "audit", label: "Audit Log", icon: Shield },
    ],
  },
  {
    label: "Platform",
    items: [
      { id: "models", label: "Model Routing", icon: Zap },
      { id: "billing", label: "Billing & Usage", icon: CreditCard },
      { id: "team", label: "Team", icon: Users },
    ],
  },
];

// ── Component ──────────────────────────────────────────────────
export default function ${name}() {
  const [activeSection, setActiveSection] = useState("overview");
  const [hasChanges, setHasChanges] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Settings Sidebar */}
      <aside className="w-60 border-r border-border flex flex-col py-4">
        <div className="px-4 mb-4">
          <h2 className="text-sm font-semibold font-display text-muted-foreground uppercase tracking-wider">
            Settings
          </h2>
        </div>
        <nav className="flex-1 px-2 space-y-4">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-2 mb-1 text-xs text-muted-foreground/60 uppercase tracking-wider font-medium">
                {section.label}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={\`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors \${
                      activeSection === item.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }\`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                    {activeSection === item.id && (
                      <ChevronRight className="h-3 w-3 ml-auto" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold font-display capitalize">
                {activeSection.replace(/-/g, " ")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage your {activeSection.replace(/-/g, " ")} settings
              </p>
            </div>
            {hasChanges && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm">
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Save Changes
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Save changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      These changes will take effect immediately.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => setHasChanges(false)}>
                      Save
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="space-y-6">
            {/* Example Settings Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Enable AI Recommendations", description: "Show AI-generated suggestions throughout the interface", defaultChecked: true },
                  { label: "Require Approval for High-Risk Actions", description: "Prompt for confirmation on destructive or high-impact operations", defaultChecked: true },
                  { label: "Audit All AI Decisions", description: "Log every AI decision to the immutable audit trail", defaultChecked: false },
                ].map((setting) => (
                  <div key={setting.label} className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">{setting.label}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
                    </div>
                    <Switch
                      defaultChecked={setting.defaultChecked}
                      onCheckedChange={() => setHasChanges(true)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Reset all settings</p>
                    <p className="text-xs text-muted-foreground">This cannot be undone</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
                        Reset
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset all settings?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will reset all settings to defaults. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive">Reset</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}`;
}

function generateWizardLayout(name: string, intent: PromptIntent): string {
  return `import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ArrowRight, Bot, CheckCircle2, Sparkles } from "lucide-react";

// ── Steps ──────────────────────────────────────────────────────
const steps = [
  { id: 1, label: "Profile", description: "Tell us about yourself" },
  { id: 2, label: "Setup", description: "Configure your workspace" },
  { id: 3, label: "Connect", description: "Add your first integration" },
  { id: 4, label: "Launch", description: "You're ready to go" },
];

// ── Component ──────────────────────────────────────────────────
export default function ${name}() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({ name: "", company: "", role: "" });

  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;
  const isLastStep = currentStep === steps.length;
  const isFirstStep = currentStep === 1;

  const handleNext = () => {
    if (!isLastStep) setCurrentStep(s => s + 1);
  };

  const handleBack = () => {
    if (!isFirstStep) setCurrentStep(s => s - 1);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold font-display">${intent.productContext}</h1>
          <p className="text-sm text-muted-foreground mt-1">Get set up in under 5 minutes</p>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={\`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors \${
                step.id < currentStep
                  ? "bg-primary text-primary-foreground"
                  : step.id === currentStep
                  ? "bg-primary/20 text-primary border border-primary"
                  : "bg-muted text-muted-foreground"
              }\`}>
                {step.id < currentStep ? <CheckCircle2 className="h-4 w-4" /> : step.id}
              </div>
              {index < steps.length - 1 && (
                <div className={\`h-px flex-1 mx-2 \${step.id < currentStep ? "bg-primary" : "bg-border"}\`} style={{ width: "60px" }} />
              )}
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-1 mb-6" />

        {/* Step Content */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold font-display">
                {steps[currentStep - 1].label}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {steps[currentStep - 1].description}
              </p>
            </div>

            {currentStep === 1 && (
              <div className="space-y-4">
                <Alert className="border-primary/20 bg-primary/5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm">
                    AI suggestion: Based on your email domain, we've pre-filled some fields.
                  </AlertDescription>
                </Alert>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Full Name</Label>
                    <Input
                      className="mt-1"
                      placeholder="Jane Smith"
                      value={formData.name}
                      onChange={(e) => setFormData(d => ({ ...d, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Company</Label>
                    <Input
                      className="mt-1"
                      placeholder="Acme Corp"
                      value={formData.company}
                      onChange={(e) => setFormData(d => ({ ...d, company: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Role</Label>
                    <Input
                      className="mt-1"
                      placeholder="AI Engineer"
                      value={formData.role}
                      onChange={(e) => setFormData(d => ({ ...d, role: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Configure your workspace preferences.</p>
                <div className="grid grid-cols-2 gap-3">
                  {["Production", "Staging", "Development", "Sandbox"].map((env) => (
                    <button
                      key={env}
                      className="p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-colors"
                    >
                      <div className="text-sm font-medium">{env}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Environment</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Connect your first data source.</p>
                {["Salesforce", "HubSpot", "Slack", "Custom API"].map((integration) => (
                  <div key={integration} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <span className="text-sm font-medium">{integration}</span>
                    <Button variant="outline" size="sm">Connect</Button>
                  </div>
                ))}
              </div>
            )}

            {currentStep === 4 && (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold font-display">You're all set!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your workspace is ready. Start building with AI.
                </p>
                <div className="flex gap-2 justify-center mt-4">
                  <Badge variant="secondary">Profile ✓</Badge>
                  <Badge variant="secondary">Workspace ✓</Badge>
                  <Badge variant="secondary">Integration ✓</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <Button variant="ghost" size="sm" onClick={handleBack} disabled={isFirstStep}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back
          </Button>
          <span className="text-xs text-muted-foreground">
            Step {currentStep} of {steps.length}
          </span>
          <Button size="sm" onClick={handleNext}>
            {isLastStep ? "Get Started" : "Continue"}
            {!isLastStep && <ArrowRight className="h-3.5 w-3.5 ml-1.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}`;
}

function generateCommandCenterLayout(name: string, intent: PromptIntent, sections: string[]): string {
  return `import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Activity, AlertTriangle, Bot, CheckCircle2, Clock,
  Pause, Play, Square, Terminal, Zap
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────
type AgentState = "running" | "paused" | "completed" | "failed" | "waiting";

interface Agent {
  id: string;
  name: string;
  state: AgentState;
  currentStep: string;
  progress: number;
  startTime: string;
  tokensUsed: number;
}

// ── Mock Data ──────────────────────────────────────────────────
const agents: Agent[] = [
  { id: "a-1", name: "Proposal Agent", state: "running", currentStep: "Analyzing requirements", progress: 45, startTime: "2m ago", tokensUsed: 12400 },
  { id: "a-2", name: "Research Agent", state: "running", currentStep: "Fetching web sources", progress: 72, startTime: "5m ago", tokensUsed: 8900 },
  { id: "a-3", name: "Review Agent", state: "waiting", currentStep: "Awaiting input", progress: 0, startTime: "—", tokensUsed: 0 },
  { id: "a-4", name: "Summary Agent", state: "completed", currentStep: "Done", progress: 100, startTime: "12m ago", tokensUsed: 3200 },
  { id: "a-5", name: "Validation Agent", state: "failed", currentStep: "Error: timeout", progress: 23, startTime: "8m ago", tokensUsed: 1100 },
];

const stateColors: Record<AgentState, string> = {
  running: "text-emerald-400",
  paused: "text-amber-400",
  completed: "text-blue-400",
  failed: "text-red-400",
  waiting: "text-muted-foreground",
};

const stateBadgeVariants: Record<AgentState, "default" | "secondary" | "destructive" | "outline"> = {
  running: "default",
  paused: "secondary",
  completed: "outline",
  failed: "destructive",
  waiting: "secondary",
};

// ── Component ──────────────────────────────────────────────────
export default function ${name}() {
  const [selectedAgent, setSelectedAgent] = useState<Agent>(agents[0]);
  const [logs, setLogs] = useState<string[]>([
    "[14:22:01] Proposal Agent: Starting analysis",
    "[14:22:03] Research Agent: Fetching source 1/5",
    "[14:22:05] Proposal Agent: Loaded 3 templates",
    "[14:22:08] Research Agent: Fetching source 2/5",
    "[14:22:10] Proposal Agent: Generating section 1",
    "[14:22:12] Validation Agent: Error — connection timeout",
    "[14:22:14] Research Agent: Fetching source 3/5",
  ]);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Top Controls */}
      <header className="border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-medium font-display">${intent.productContext}</span>
          </div>
          <Badge variant="secondary" className="text-xs">Run #4821</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Pause className="h-3.5 w-3.5 mr-1.5" />
            Pause All
          </Button>
          <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
            <Square className="h-3.5 w-3.5 mr-1.5" />
            Stop
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Agent Grid */}
        <div className="w-72 border-r border-border flex flex-col">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Agents ({agents.filter(a => a.state === "running").length} running)
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={\`w-full text-left p-3 rounded-md transition-colors \${
                    selectedAgent.id === agent.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/30"
                  }\`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">{agent.name}</span>
                    <Badge variant={stateBadgeVariants[agent.state]} className="text-xs">
                      {agent.state}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mb-1.5">
                    {agent.currentStep}
                  </div>
                  <Progress value={agent.progress} className="h-1" />
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main: Agent Detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className={\`h-5 w-5 \${stateColors[selectedAgent.state]}\`} />
                <div>
                  <h2 className="font-semibold font-display">{selectedAgent.name}</h2>
                  <p className="text-xs text-muted-foreground">{selectedAgent.currentStep}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Pause className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Play className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-0 border-b border-border">
            {[
              { label: "Progress", value: \`\${selectedAgent.progress}%\`, icon: Activity },
              { label: "Started", value: selectedAgent.startTime, icon: Clock },
              { label: "Tokens", value: selectedAgent.tokensUsed.toLocaleString(), icon: Zap },
              { label: "Status", value: selectedAgent.state, icon: CheckCircle2 },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="p-3 border-r border-border last:border-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Icon className="h-3 w-3" />
                    {stat.label}
                  </div>
                  <div className="text-sm font-semibold">{stat.value}</div>
                </div>
              );
            })}
          </div>

          {/* Execution Log */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Execution Log
              </span>
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-1 font-mono text-xs">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={\`\${
                      log.includes("Error") ? "text-red-400" :
                      log.includes(selectedAgent.name) ? "text-foreground" :
                      "text-muted-foreground"
                    }\`}
                  >
                    {log}
                  </div>
                ))}
                {selectedAgent.state === "running" && (
                  <div className="text-primary flex items-center gap-1">
                    <span className="animate-pulse">▌</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}`;
}

function generateSplitPaneLayout(name: string, intent: PromptIntent, sections: string[]): string {
  return `import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Download, Filter, Search } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────
interface DataItem {
  id: string;
  name: string;
  status: "success" | "error" | "pending";
  type: string;
  timestamp: string;
  details: Record<string, string>;
}

// ── Mock Data ──────────────────────────────────────────────────
const dataItems: DataItem[] = [
  { id: "i-001", name: "Tool Call: web_search", status: "success", type: "tool_call", timestamp: "14:22:01", details: { duration: "1.2s", tokens: "450", result: "5 results found" } },
  { id: "i-002", name: "Tool Call: read_file", status: "success", type: "tool_call", timestamp: "14:22:03", details: { duration: "0.3s", tokens: "120", result: "File read successfully" } },
  { id: "i-003", name: "Tool Call: api_request", status: "error", type: "tool_call", timestamp: "14:22:05", details: { duration: "5.0s", tokens: "0", result: "Error: timeout after 5000ms" } },
  { id: "i-004", name: "Tool Call: write_file", status: "pending", type: "tool_call", timestamp: "14:22:08", details: { duration: "—", tokens: "—", result: "In progress" } },
  { id: "i-005", name: "Tool Call: database_query", status: "success", type: "tool_call", timestamp: "14:22:10", details: { duration: "0.8s", tokens: "890", result: "42 rows returned" } },
];

const statusVariants = {
  success: "default",
  error: "destructive",
  pending: "secondary",
} as const;

// ── Component ──────────────────────────────────────────────────
export default function ${name}() {
  const [selected, setSelected] = useState<DataItem>(dataItems[0]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = dataItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left: List */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Toolbar */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold font-display">${intent.productContext}</h1>
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-8 h-8 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-8 text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <>
                  <tr
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={\`border-b border-border cursor-pointer transition-colors \${
                      selected.id === item.id ? "bg-primary/5" : "hover:bg-muted/30"
                    }\`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {expanded.has(item.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                        <span className="font-mono text-xs">{item.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={statusVariants[item.status]} className="text-xs">
                        {item.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{item.timestamp}</td>
                  </tr>
                  {expanded.has(item.id) && (
                    <tr key={\`\${item.id}-detail\`} className="bg-muted/20">
                      <td colSpan={3} className="px-10 py-2">
                        <div className="grid grid-cols-3 gap-4 text-xs">
                          {Object.entries(item.details).map(([k, v]) => (
                            <div key={k}>
                              <span className="text-muted-foreground capitalize">{k}: </span>
                              <span className="font-mono">{v}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </div>

      {/* Right: Detail Panel */}
      <div className="w-96 flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold font-display text-sm">Detail View</h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{selected.id}</p>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            <Card className="bg-muted/30">
              <CardContent className="p-3 space-y-2">
                {Object.entries(selected.details).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground capitalize">{key}</span>
                    <span className="font-mono text-xs">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Input / Output
              </p>
              <div className="bg-muted/20 rounded-md p-3 font-mono text-xs text-muted-foreground">
                {/* Connect to your data store for actual I/O */}
                {"// Input and output data will appear here"}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}`;
}
