/*
 * DESIGN SYSTEM: Obsidian Enterprise
 * Pattern Library Browser — sidebar filters + card grid
 */
import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import AppShell from '@/components/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { patterns } from '@/data/patterns';
import { searchPatterns } from '@/lib/search';
import type { PatternCategory, PersonaType, DataDensity, ComplexityLevel, SearchFilters } from '@/types';

const categoryOptions: { value: PatternCategory; label: string }[] = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'agent-workspace', label: 'Agent Workspace' },
  { value: 'approval-review', label: 'Approval & Review' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'trust-explainability', label: 'Trust & Explainability' },
  { value: 'orchestration', label: 'Orchestration' },
  { value: 'settings-admin', label: 'Settings & Admin' },
  { value: 'knowledge-memory', label: 'Knowledge & Memory' },
  { value: 'value-roi', label: 'Value & ROI' },
  { value: 'tables-data', label: 'Tables & Data' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'forms-wizards', label: 'Forms & Wizards' },
  { value: 'side-panels', label: 'Side Panels' },
  { value: 'command-surfaces', label: 'Command Surfaces' },
];

const personaOptions: { value: PersonaType; label: string }[] = [
  { value: 'ai-engineer', label: 'AI Engineer' },
  { value: 'product-manager', label: 'Product Manager' },
  { value: 'ops-analyst', label: 'Ops Analyst' },
  { value: 'customer-success', label: 'Customer Success' },
  { value: 'data-scientist', label: 'Data Scientist' },
  { value: 'enterprise-admin', label: 'Enterprise Admin' },
  { value: 'developer', label: 'Developer' },
  { value: 'executive', label: 'Executive' },
];

const densityOptions: { value: DataDensity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'ultra-dense', label: 'Ultra Dense' },
];

const complexityOptions: { value: ComplexityLevel; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'complex', label: 'Complex' },
  { value: 'enterprise', label: 'Enterprise' },
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

const complexityColors: Record<ComplexityLevel, string> = {
  simple: 'text-emerald-400 border-emerald-500/30',
  moderate: 'text-blue-400 border-blue-500/30',
  complex: 'text-amber-400 border-amber-500/30',
  enterprise: 'text-rose-400 border-rose-500/30',
};

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs">
      {label}
      <button onClick={onRemove} className="hover:text-foreground">
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

export default function PatternsPage() {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    categories: [],
    personas: [],
    interactionModes: [],
    densities: [],
    agenticCapabilities: [],
    complexities: [],
  });
  const [showFilters, setShowFilters] = useState(true);

  const results = useMemo(() => searchPatterns(filters), [filters]);

  const toggleCategory = (cat: PatternCategory) => {
    setFilters(f => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter(c => c !== cat)
        : [...f.categories, cat],
    }));
  };

  const togglePersona = (p: PersonaType) => {
    setFilters(f => ({
      ...f,
      personas: f.personas.includes(p)
        ? f.personas.filter(x => x !== p)
        : [...f.personas, p],
    }));
  };

  const toggleDensity = (d: DataDensity) => {
    setFilters(f => ({
      ...f,
      densities: f.densities.includes(d)
        ? f.densities.filter(x => x !== d)
        : [...f.densities, d],
    }));
  };

  const toggleComplexity = (c: ComplexityLevel) => {
    setFilters(f => ({
      ...f,
      complexities: f.complexities.includes(c)
        ? f.complexities.filter(x => x !== c)
        : [...f.complexities, c],
    }));
  };

  const clearAll = () => {
    setFilters({ query: '', categories: [], personas: [], interactionModes: [], densities: [], agenticCapabilities: [], complexities: [] });
  };

  const activeFilterCount = filters.categories.length + filters.personas.length + filters.densities.length + filters.complexities.length;

  return (
    <AppShell
      title="Pattern Library"
      subtitle={`${patterns.length} patterns across 14 categories`}
      headerActions={
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="ml-0.5 h-4 w-4 p-0 text-[9px] flex items-center justify-center bg-primary text-primary-foreground">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      }
    >
      <div className="flex h-full overflow-hidden">
        {/* Filter Sidebar */}
        {showFilters && (
          <aside className="w-56 border-r border-border shrink-0 flex flex-col">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Filters</span>
              {activeFilterCount > 0 && (
                <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">
                  Clear all
                </button>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-5">
                {/* Category */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Category</p>
                  <div className="space-y-0.5">
                    {categoryOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => toggleCategory(opt.value)}
                        className={`w-full text-left px-2 py-1 rounded text-xs transition-colors flex items-center justify-between ${
                          filters.categories.includes(opt.value)
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className="text-[10px] opacity-60">
                          {patterns.filter(p => p.category === opt.value).length}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Persona */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Persona</p>
                  <div className="space-y-0.5">
                    {personaOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => togglePersona(opt.value)}
                        className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                          filters.personas.includes(opt.value)
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Complexity */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Complexity</p>
                  <div className="flex flex-wrap gap-1.5">
                    {complexityOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => toggleComplexity(opt.value)}
                        className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                          filters.complexities.includes(opt.value)
                            ? 'bg-primary/15 text-primary border-primary/30'
                            : 'text-muted-foreground border-border hover:border-primary/30'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Density */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Data Density</p>
                  <div className="flex flex-wrap gap-1.5">
                    {densityOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => toggleDensity(opt.value)}
                        className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                          filters.densities.includes(opt.value)
                            ? 'bg-primary/15 text-primary border-primary/30'
                            : 'text-muted-foreground border-border hover:border-primary/30'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </aside>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Search Bar */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patterns by name, tag, capability..."
                className="pl-9 bg-muted/30 border-border"
                value={filters.query}
                onChange={(e) => setFilters(f => ({ ...f, query: e.target.value }))}
              />
            </div>
            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {filters.categories.map(c => (
                  <FilterChip key={c} label={c.replace(/-/g, ' ')} onRemove={() => toggleCategory(c)} />
                ))}
                {filters.personas.map(p => (
                  <FilterChip key={p} label={p.replace(/-/g, ' ')} onRemove={() => togglePersona(p)} />
                ))}
                {filters.complexities.map(c => (
                  <FilterChip key={c} label={c} onRemove={() => toggleComplexity(c)} />
                ))}
                {filters.densities.map(d => (
                  <FilterChip key={d} label={d} onRemove={() => toggleDensity(d)} />
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground">
                  {results.length === patterns.length
                    ? `All ${results.length} patterns`
                    : `${results.length} of ${patterns.length} patterns`}
                </p>
              </div>

              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Search className="h-10 w-10 text-muted-foreground/30 mb-4" />
                  <p className="text-sm font-medium text-muted-foreground">No patterns match your filters</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or clearing filters</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={clearAll}>
                    Clear all filters
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {results.map((pattern) => (
                    <Link key={pattern.id} href={`/patterns/${pattern.id}`}>
                      <Card className="bg-card border-border hover:border-primary/40 transition-all duration-200 cursor-pointer group h-full">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2.5">
                            <span className={`tag ${categoryColors[pattern.category] || 'bg-muted text-muted-foreground'}`}>
                              {pattern.category.replace(/-/g, ' ')}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${complexityColors[pattern.complexity]}`}
                            >
                              {pattern.complexity}
                            </Badge>
                          </div>
                          <h3 className="font-semibold font-display text-sm mb-1 group-hover:text-primary transition-colors leading-snug">
                            {pattern.name}
                          </h3>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                            {pattern.summary}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex flex-wrap gap-1">
                              {pattern.tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground">
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
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
