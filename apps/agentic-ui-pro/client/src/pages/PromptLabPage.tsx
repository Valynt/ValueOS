/*
 * DESIGN SYSTEM: Obsidian Enterprise
 * Prompt Lab — AI-powered pattern recommendation + code generation
 * Layout: Left input panel, right results panel (split-pane)
 */
import { useState, useCallback } from 'react';
import { Link } from 'wouter';
import AppShell from '@/components/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  AlertCircle, ArrowRight, Bot, CheckCircle2, Code2,
  Copy, FlaskConical, GitBranch, Layers, Lightbulb,
  Shield, Sparkles, Zap
} from 'lucide-react';
import { generateRecommendation } from '@/lib/recommend';
import type { Recommendation } from '@/types';
import { toast } from 'sonner';

const EXAMPLE_PROMPTS = [
  'I need a dashboard for an AI engineer to monitor active agent runs, view execution logs, and intervene when anomalies are detected. The interface should be ultra-dense with real-time updates.',
  'Build an approval queue for a customer success manager to review AI-generated proposals before they are sent to clients. Needs confidence scores and reasoning traces.',
  'Design an onboarding wizard for a new developer setting up their first AI agent. Should be simple, step-by-step, with AI-suggested defaults.',
  'Create an enterprise admin console for managing model usage governance, reviewing policy violations, and controlling team permissions.',
  'I need a value hypothesis workspace for a product manager to generate, validate, and track AI initiative business cases with stakeholder sign-off.',
];

const categoryColors: Record<string, string> = {
  dashboard: 'bg-blue-500/15 text-blue-300',
  'agent-workspace': 'bg-violet-500/15 text-violet-300',
  'approval-review': 'bg-amber-500/15 text-amber-300',
  analytics: 'bg-emerald-500/15 text-emerald-300',
  'trust-explainability': 'bg-rose-500/15 text-rose-300',
  orchestration: 'bg-cyan-500/15 text-cyan-300',
  'settings-admin': 'bg-slate-500/15 text-slate-300',
  'knowledge-memory': 'bg-purple-500/15 text-purple-300',
  'value-roi': 'bg-green-500/15 text-green-300',
  'tables-data': 'bg-orange-500/15 text-orange-300',
  onboarding: 'bg-teal-500/15 text-teal-300',
  'forms-wizards': 'bg-pink-500/15 text-pink-300',
  'side-panels': 'bg-indigo-500/15 text-indigo-300',
  'command-surfaces': 'bg-yellow-500/15 text-yellow-300',
};

const qualityCategoryColors: Record<string, string> = {
  accessibility: 'text-blue-400',
  ux: 'text-emerald-400',
  agentic: 'text-violet-400',
  governance: 'text-amber-400',
  performance: 'text-cyan-400',
};

export default function PromptLabPage() {
  const [prompt, setPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [activeTab, setActiveTab] = useState('patterns');
  const [copiedCode, setCopiedCode] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (!prompt.trim()) return;
    setIsAnalyzing(true);
    setResult(null);

    // Simulate async analysis with a short delay for UX
    setTimeout(() => {
      const rec = generateRecommendation(prompt);
      setResult(rec);
      setIsAnalyzing(false);
      setActiveTab('patterns');
    }, 1200);
  }, [prompt]);

  const handleExamplePrompt = (example: string) => {
    setPrompt(example);
  };

  const handleCopyCode = () => {
    if (!result?.generatedCode) return;
    navigator.clipboard.writeText(result.generatedCode);
    setCopiedCode(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <AppShell
      title="Prompt Lab"
      subtitle="Describe your product — get pattern recommendations and generated code"
    >
      <div className="flex h-full overflow-hidden">
        {/* Left: Input Panel */}
        <div className="w-96 border-r border-border flex flex-col shrink-0">
          <div className="p-4 flex-1 flex flex-col gap-4 overflow-auto">
            {/* Header */}
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <FlaskConical className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold font-display">Describe your product</p>
                <p className="text-xs text-muted-foreground">Plain English is fine</p>
              </div>
            </div>

            {/* Textarea */}
            <div className="flex-1 flex flex-col gap-2">
              <Textarea
                placeholder="e.g. I need a dashboard for an AI engineer to monitor active agent runs, view execution logs, and intervene when anomalies are detected..."
                className="flex-1 min-h-[180px] resize-none bg-muted/30 border-border text-sm leading-relaxed font-sans"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAnalyze();
                }}
              />
              <p className="text-[10px] text-muted-foreground">⌘ + Enter to analyze</p>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!prompt.trim() || isAnalyzing}
              className="w-full gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analyze & Recommend
                </>
              )}
            </Button>

            <Separator />

            {/* Example Prompts */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Example Prompts
              </p>
              <div className="space-y-2">
                {EXAMPLE_PROMPTS.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => handleExamplePrompt(example)}
                    className="w-full text-left p-2.5 rounded-md bg-muted/30 hover:bg-muted/60 border border-border hover:border-primary/30 transition-colors"
                  >
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{example}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Results Panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
                <Bot className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold font-display mb-1">Analyzing your prompt...</p>
                <p className="text-xs text-muted-foreground">Matching patterns, detecting intent, generating code</p>
              </div>
              <div className="w-64">
                <Progress value={65} className="h-1" />
              </div>
            </div>
          ) : !result ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50">
                <Lightbulb className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-semibold font-display mb-1 text-muted-foreground">
                  Your recommendations will appear here
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
                  Describe your product, user persona, and use case in the prompt box. The engine will
                  recommend patterns, layout archetypes, and generate a React component.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Result Header */}
              <div className="p-4 border-b border-border bg-card/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">
                        {result.pageArchetype}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {result.layoutArchetype.replace(/-/g, ' ')}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${result.confidence >= 80 ? 'text-emerald-400 border-emerald-500/30' : result.confidence >= 60 ? 'text-amber-400 border-amber-500/30' : 'text-muted-foreground'}`}
                      >
                        {result.confidence}% confidence
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {result.designRationale}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-border px-4 pt-2">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-transparent h-8 p-0 gap-0">
                    {[
                      { value: 'patterns', label: 'Patterns', icon: Layers },
                      { value: 'workflow', label: 'Workflow', icon: GitBranch },
                      { value: 'code', label: 'Code', icon: Code2 },
                      { value: 'trust', label: 'Trust', icon: Shield },
                      { value: 'checklist', label: 'Checklist', icon: CheckCircle2 },
                    ].map(tab => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.value}
                          onClick={() => setActiveTab(tab.value)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-b-2 transition-colors ${
                            activeTab === tab.value
                              ? 'border-primary text-primary font-medium'
                              : 'border-transparent text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </TabsList>
                </Tabs>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4">
                  {/* Patterns Tab */}
                  {activeTab === 'patterns' && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                          Recommended Patterns ({result.recommendedPatterns.length})
                        </p>
                        <div className="space-y-3">
                          {result.recommendedPatterns.map((pattern, i) => (
                            <Card key={pattern.id} className="bg-card border-border">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-xs font-mono text-primary opacity-60">#{i + 1}</span>
                                      <span className={`tag ${categoryColors[pattern.category] || 'bg-muted text-muted-foreground'}`}>
                                        {pattern.category.replace(/-/g, ' ')}
                                      </span>
                                    </div>
                                    <h3 className="font-semibold font-display text-sm mb-1">{pattern.name}</h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                      {pattern.summary}
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {pattern.agenticCapabilities.slice(0, 3).map(cap => (
                                        <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                          {cap}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <Link href={`/patterns/${pattern.id}`}>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0">
                                      View
                                      <ArrowRight className="h-3 w-3" />
                                    </Button>
                                  </Link>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Component Bundle */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          Component Bundle
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.componentBundle.map(comp => (
                            <code key={comp} className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                              {comp}
                            </code>
                          ))}
                        </div>
                      </div>

                      {/* Sections */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          Suggested Sections
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.sections.map(section => (
                            <span key={section} className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                              {section}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Workflow Tab */}
                  {activeTab === 'workflow' && (
                    <div className="space-y-4">
                      {result.recommendedWorkflow ? (
                        <>
                          <Card className="bg-card border-border">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <Badge variant="secondary" className="text-xs mb-2">
                                    {result.recommendedWorkflow.category.replace(/-/g, ' ')}
                                  </Badge>
                                  <h3 className="font-semibold font-display text-sm mb-1">
                                    {result.recommendedWorkflow.name}
                                  </h3>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {result.recommendedWorkflow.summary}
                                  </p>
                                </div>
                                <Link href={`/workflows/${result.recommendedWorkflow.id}`}>
                                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0">
                                    View Blueprint
                                    <ArrowRight className="h-3 w-3" />
                                  </Button>
                                </Link>
                              </div>
                            </CardContent>
                          </Card>

                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                              Stages ({result.recommendedWorkflow.stages.length})
                            </p>
                            <div className="space-y-2">
                              {result.recommendedWorkflow.stages.map((stage, i) => (
                                <div key={stage.id} className="flex items-start gap-3 p-3 rounded-md bg-muted/30 border border-border">
                                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                                    {i + 1}
                                  </span>
                                  <div>
                                    <p className="text-xs font-medium">{stage.name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{stage.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <GitBranch className="h-10 w-10 text-muted-foreground/30 mb-3" />
                          <p className="text-sm text-muted-foreground">No specific workflow matched your prompt</p>
                          <Link href="/workflows">
                            <Button variant="outline" size="sm" className="mt-3 gap-1.5">
                              Browse all workflows
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Code Tab */}
                  {activeTab === 'code' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Generated Component
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            React + TypeScript + shadcn/ui · {result.layoutArchetype.replace(/-/g, ' ')} layout
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1.5"
                          onClick={handleCopyCode}
                        >
                          <Copy className="h-3 w-3" />
                          {copiedCode ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                      <div className="code-block p-4 overflow-x-auto">
                        <pre className="text-xs leading-relaxed text-muted-foreground whitespace-pre">
                          {result.generatedCode}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Trust Tab */}
                  {activeTab === 'trust' && (
                    <div className="space-y-4">
                      {result.trustSuggestions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                            Trust Recommendations
                          </p>
                          <div className="space-y-2">
                            {result.trustSuggestions.map((suggestion, i) => (
                              <div key={i} className="flex items-start gap-2.5 p-3 rounded-md bg-amber-500/5 border border-amber-500/20">
                                <Shield className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                                <p className="text-xs text-muted-foreground">{suggestion}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.governanceSuggestions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                            Governance Recommendations
                          </p>
                          <div className="space-y-2">
                            {result.governanceSuggestions.map((suggestion, i) => (
                              <div key={i} className="flex items-start gap-2.5 p-3 rounded-md bg-violet-500/5 border border-violet-500/20">
                                <AlertCircle className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
                                <p className="text-xs text-muted-foreground">{suggestion}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.trustSuggestions.length === 0 && result.governanceSuggestions.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Shield className="h-10 w-10 text-muted-foreground/30 mb-3" />
                          <p className="text-sm text-muted-foreground">No specific trust concerns detected</p>
                          <p className="text-xs text-muted-foreground mt-1">Your use case appears to have standard trust requirements</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Checklist Tab */}
                  {activeTab === 'checklist' && (
                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground">
                        Quality checklist generated for your use case. Required items are marked.
                      </p>
                      <div className="space-y-2">
                        {result.qualityChecklist.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-start gap-3 p-3 rounded-md border ${
                              item.required
                                ? 'bg-card border-border'
                                : 'bg-muted/20 border-border/50'
                            }`}
                          >
                            <CheckCircle2 className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                              item.required ? 'text-primary' : 'text-muted-foreground/50'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-medium">{item.label}</span>
                                {item.required && (
                                  <Badge className="text-[9px] px-1 py-0 h-3.5 bg-primary/15 text-primary border-0">
                                    required
                                  </Badge>
                                )}
                                <span className={`text-[9px] uppercase tracking-wider font-medium ${qualityCategoryColors[item.category]}`}>
                                  {item.category}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
