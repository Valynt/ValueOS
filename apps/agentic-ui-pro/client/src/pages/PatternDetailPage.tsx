/*
 * DESIGN SYSTEM: Obsidian Enterprise
 * Pattern Detail Page — full pattern anatomy, shadcn mapping, related patterns
 */
import { useParams, Link } from 'wouter';
import AppShell from '@/components/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Code2,
  Layers, Shield, Users, XCircle, Zap
} from 'lucide-react';
import { getPatternById, getRelatedPatterns } from '@/lib/search';

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

export default function PatternDetailPage() {
  const params = useParams<{ id: string }>();
  const pattern = getPatternById(params.id);

  if (!pattern) {
    return (
      <AppShell title="Pattern Not Found">
        <div className="flex flex-col items-center justify-center h-full py-20 text-center">
          <Layers className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Pattern not found</p>
          <Link href="/patterns">
            <Button variant="outline" size="sm" className="mt-4 gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Patterns
            </Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const related = getRelatedPatterns(pattern, 4);

  return (
    <AppShell
      title={pattern.name}
      subtitle={`${pattern.category.replace(/-/g, ' ')} · ${pattern.complexity}`}
      headerActions={
        <Link href="/patterns">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            All Patterns
          </Button>
        </Link>
      }
    >
      <ScrollArea className="h-full">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Header Card */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-start gap-3 mb-4">
                <span className={`tag ${categoryColors[pattern.category] || 'bg-muted text-muted-foreground'}`}>
                  {pattern.category.replace(/-/g, ' ')}
                </span>
                <Badge variant="outline" className="text-xs">{pattern.complexity}</Badge>
                <Badge variant="outline" className="text-xs">{pattern.dataDensity} density</Badge>
                <Badge variant="outline" className="text-xs">{pattern.interactionMode}</Badge>
              </div>
              <h1 className="text-2xl font-bold font-display mb-3">{pattern.name}</h1>
              <p className="text-muted-foreground leading-relaxed mb-4">{pattern.summary}</p>
              <div className="flex flex-wrap gap-1.5">
                {pattern.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="overview">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="anatomy">Anatomy</TabsTrigger>
              <TabsTrigger value="components">Components</TabsTrigger>
              <TabsTrigger value="trust">Trust & Governance</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      When & Why to Use
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{pattern.whyWhenToUse}</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Ideal Use Cases
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {pattern.idealUseCases.map((uc, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          {uc}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Persona Fit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {pattern.personaFit.map(p => (
                        <Badge key={p} variant="secondary" className="text-xs">
                          {p.replace(/-/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-rose-400" />
                      Anti-Patterns
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {pattern.antiPatterns.map((ap, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5 text-rose-400 mt-0.5 shrink-0" />
                          {ap}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Layout Structure */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Layout Structure</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-3">
                    <Badge variant="outline" className="text-xs">{pattern.layoutArchetype.replace(/-/g, ' ')}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{pattern.layoutStructure}</p>
                </CardContent>
              </Card>

              {/* Agentic Capabilities */}
              {pattern.agenticCapabilities.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Agentic Capabilities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {pattern.agenticCapabilities.map(cap => (
                        <span key={cap} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {cap}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Anatomy Tab */}
            <TabsContent value="anatomy" className="mt-4 space-y-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Anatomy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pattern.anatomy.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                        <span className="text-xs font-mono text-primary mt-0.5 w-5 shrink-0">{i + 1}.</span>
                        <span className="text-sm text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Example Sections</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {pattern.exampleSections.map(section => (
                      <span key={section} className="text-xs px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border">
                        {section}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Interaction Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{pattern.interactionNotes}</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Implementation Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{pattern.implementationNotes}</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Components Tab */}
            <TabsContent value="components" className="mt-4 space-y-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-primary" />
                    shadcn/ui Component Mapping
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pattern.shadcnMapping.map((mapping, i) => (
                      <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                        <code className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0">
                          {mapping.component}
                        </code>
                        <span className="text-sm text-muted-foreground">{mapping.usage}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Recommended Components</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {pattern.recommendedComponents.map(comp => (
                      <code key={comp} className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {comp}
                      </code>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Copy Guidance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{pattern.copyGuidance}</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Trust & Governance Tab */}
            <TabsContent value="trust" className="mt-4 space-y-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Trust & Accessibility Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{pattern.trustAccessibilityNotes}</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Related Patterns */}
          {related.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold font-display mb-3 text-muted-foreground uppercase tracking-wider">
                Related Patterns
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {related.map(p => (
                  <Link key={p.id} href={`/patterns/${p.id}`}>
                    <Card className="bg-card border-border hover:border-primary/40 transition-all cursor-pointer group h-full">
                      <CardContent className="p-4">
                        <span className={`tag text-[9px] mb-2 block w-fit ${categoryColors[p.category] || 'bg-muted text-muted-foreground'}`}>
                          {p.category.replace(/-/g, ' ')}
                        </span>
                        <p className="text-xs font-semibold font-display group-hover:text-primary transition-colors leading-snug">
                          {p.name}
                        </p>
                        <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors mt-2" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </AppShell>
  );
}
