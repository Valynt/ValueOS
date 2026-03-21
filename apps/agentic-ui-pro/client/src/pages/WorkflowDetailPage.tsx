/*
 * DESIGN SYSTEM: Obsidian Enterprise
 * Workflow Detail Page — stages, trust patterns, component list
 */
import { useParams, Link } from 'wouter';
import AppShell from '@/components/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Bot, CheckCircle2, Code2, GitBranch,
  Shield, Users, Zap
} from 'lucide-react';
import { getWorkflowById } from '@/lib/search';

const categoryColors: Record<string, string> = {
  'ai-approval': 'bg-amber-500/15 text-amber-300',
  'proposal-review': 'bg-blue-500/15 text-blue-300',
  'value-hypothesis': 'bg-green-500/15 text-green-300',
  'customer-onboarding': 'bg-teal-500/15 text-teal-300',
  'support-triage': 'bg-orange-500/15 text-orange-300',
  'incident-investigation': 'bg-rose-500/15 text-rose-300',
  'agent-monitoring': 'bg-violet-500/15 text-violet-300',
  'model-governance': 'bg-slate-500/15 text-slate-300',
  'admin-permissions': 'bg-indigo-500/15 text-indigo-300',
  'business-review': 'bg-cyan-500/15 text-cyan-300',
};

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const workflow = getWorkflowById(params.id);

  if (!workflow) {
    return (
      <AppShell title="Workflow Not Found">
        <div className="flex flex-col items-center justify-center h-full py-20 text-center">
          <GitBranch className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Workflow not found</p>
          <Link href="/workflows">
            <Button variant="outline" size="sm" className="mt-4 gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Workflows
            </Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={workflow.name}
      subtitle={`${workflow.category.replace(/-/g, ' ')} · ${workflow.stages.length} stages · ${workflow.complexity}`}
      headerActions={
        <Link href="/workflows">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            All Workflows
          </Button>
        </Link>
      }
    >
      <ScrollArea className="h-full">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Header */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className={`tag ${categoryColors[workflow.category] || 'bg-muted text-muted-foreground'}`}>
                  {workflow.category.replace(/-/g, ' ')}
                </span>
                <Badge variant="outline" className="text-xs">{workflow.complexity}</Badge>
                <Badge variant="secondary" className="text-xs">{workflow.stages.length} stages</Badge>
              </div>
              <h1 className="text-2xl font-bold font-display mb-3">{workflow.name}</h1>
              <p className="text-muted-foreground leading-relaxed mb-4">{workflow.summary}</p>
              <div className="flex flex-wrap gap-1.5">
                {workflow.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stages */}
          <div>
            <h2 className="text-sm font-semibold font-display mb-4 text-muted-foreground uppercase tracking-wider">
              Workflow Stages
            </h2>
            <div className="relative">
              {/* Connector line */}
              <div className="absolute left-5 top-8 bottom-8 w-px bg-border" />
              <div className="space-y-4">
                {workflow.stages.map((stage, i) => (
                  <div key={stage.id} className="relative flex gap-4">
                    {/* Stage number */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-semibold font-display shrink-0 z-10">
                      {i + 1}
                    </div>
                    {/* Stage content */}
                    <Card className="flex-1 bg-card border-border">
                      <CardContent className="p-4">
                        <h3 className="font-semibold font-display text-sm mb-1">{stage.name}</h3>
                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{stage.description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-muted/30 rounded-md p-3">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Bot className="h-3 w-3 text-primary" />
                              <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Agent Role</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{stage.agentRole}</p>
                          </div>
                          <div className="bg-muted/30 rounded-md p-3">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Users className="h-3 w-3 text-emerald-400" />
                              <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">Human Role</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{stage.humanRole}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-md p-2.5">
                          <Shield className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground">{stage.trustConsiderations}</p>
                        </div>
                        {stage.components.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {stage.components.map(comp => (
                              <code key={comp} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {comp}
                              </code>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Agentic Capabilities */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Agentic Capabilities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {workflow.agenticCapabilities.map(cap => (
                    <span key={cap} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {cap}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Trust Patterns */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-400" />
                  Trust Patterns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {workflow.trustPatterns.map(tp => (
                    <span key={tp} className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {tp}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Persona Fit */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Persona Fit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {workflow.personaFit.map(p => (
                    <Badge key={p} variant="secondary" className="text-xs">
                      {p.replace(/-/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* shadcn Components */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-primary" />
                  shadcn/ui Components
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {workflow.shadcnComponents.map(comp => (
                    <code key={comp} className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {comp}
                    </code>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Success Metrics */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Success Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {workflow.successMetrics.map((metric, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    {metric}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Implementation Notes */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Implementation Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{workflow.implementationNotes}</p>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </AppShell>
  );
}
