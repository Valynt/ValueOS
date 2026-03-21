/*
 * DESIGN SYSTEM: Obsidian Enterprise
 * Workflow Blueprints Browser
 */
import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import AppShell from '@/components/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowRight, GitBranch, Search } from 'lucide-react';
import { workflows } from '@/data/workflows';
import { searchWorkflows } from '@/lib/search';
import type { WorkflowCategory, ComplexityLevel } from '@/types';

const categoryOptions: { value: WorkflowCategory; label: string }[] = [
  { value: 'ai-approval', label: 'AI Approvals' },
  { value: 'proposal-review', label: 'Proposal Review' },
  { value: 'value-hypothesis', label: 'Value Hypothesis' },
  { value: 'customer-onboarding', label: 'Customer Onboarding' },
  { value: 'support-triage', label: 'Support Triage' },
  { value: 'incident-investigation', label: 'Incident Investigation' },
  { value: 'agent-monitoring', label: 'Agent Monitoring' },
  { value: 'model-governance', label: 'Model Governance' },
  { value: 'admin-permissions', label: 'Admin Permissions' },
  { value: 'business-review', label: 'Business Review' },
];

const complexityColors: Record<ComplexityLevel, string> = {
  simple: 'text-emerald-400 border-emerald-500/30',
  moderate: 'text-blue-400 border-blue-500/30',
  complex: 'text-amber-400 border-amber-500/30',
  enterprise: 'text-rose-400 border-rose-500/30',
};

const categoryColors: Record<WorkflowCategory, string> = {
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

export default function WorkflowsPage() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<WorkflowCategory | 'all'>('all');

  const results = useMemo(() => {
    let filtered = searchWorkflows(query);
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(w => w.category === selectedCategory);
    }
    return filtered;
  }, [query, selectedCategory]);

  return (
    <AppShell
      title="Workflow Blueprints"
      subtitle={`${workflows.length} multi-stage workflow blueprints`}
    >
      <div className="flex h-full overflow-hidden">
        {/* Category Sidebar */}
        <aside className="w-52 border-r border-border shrink-0 flex flex-col">
          <div className="p-3 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</span>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                  selectedCategory === 'all'
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <span>All Workflows</span>
                <span className="text-[10px] opacity-60">{workflows.length}</span>
              </button>
              {categoryOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedCategory(opt.value)}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                    selectedCategory === opt.value
                      ? 'bg-primary/15 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="text-[10px] opacity-60">
                    {workflows.filter(w => w.category === opt.value).length}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workflows..."
                className="pl-9 bg-muted/30 border-border"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4">
              <p className="text-xs text-muted-foreground mb-4">
                {results.length} workflow{results.length !== 1 ? 's' : ''}
              </p>

              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <GitBranch className="h-10 w-10 text-muted-foreground/30 mb-4" />
                  <p className="text-sm font-medium text-muted-foreground">No workflows found</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => { setQuery(''); setSelectedCategory('all'); }}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((workflow) => (
                    <Link key={workflow.id} href={`/workflows/${workflow.id}`}>
                      <Card className="bg-card border-border hover:border-primary/40 transition-all duration-200 cursor-pointer group">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className={`tag ${categoryColors[workflow.category]}`}>
                                  {workflow.category.replace(/-/g, ' ')}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${complexityColors[workflow.complexity]}`}
                                >
                                  {workflow.complexity}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {workflow.stages.length} stages
                                </Badge>
                              </div>
                              <h3 className="font-semibold font-display text-sm mb-1 group-hover:text-primary transition-colors">
                                {workflow.name}
                              </h3>
                              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                                {workflow.summary}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {workflow.agenticCapabilities.slice(0, 4).map(cap => (
                                  <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                    {cap}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </AppShell>
  );
}
