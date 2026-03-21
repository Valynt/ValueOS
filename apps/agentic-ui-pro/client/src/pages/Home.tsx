/*
 * DESIGN SYSTEM: Obsidian Enterprise
 * Home / Landing Page
 * Layout: Asymmetric hero, feature grid, pattern preview strip, CTA
 */
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowRight, Bot, CheckCircle2, Code2, FlaskConical,
  GitBranch, Layers, Shield, Sparkles, Zap
} from 'lucide-react';
import { patterns } from '@/data/patterns';
import { workflows } from '@/data/workflows';

const features = [
  {
    icon: Layers,
    title: 'Pattern Library',
    description: '30 production-ready UI patterns for agentic SaaS products — dashboards, approval queues, agent workspaces, and more.',
    href: '/patterns',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: GitBranch,
    title: 'Workflow Blueprints',
    description: '10 multi-stage workflow blueprints with HITL checkpoints, trust patterns, and shadcn component mappings.',
    href: '/workflows',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    icon: FlaskConical,
    title: 'Prompt Lab',
    description: 'Describe your product in plain English and get instant pattern recommendations, layout archetypes, and generated code.',
    href: '/prompt-lab',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: Code2,
    title: 'Code Generation',
    description: 'Export production-ready React + shadcn/ui page skeletons tailored to your use case, persona, and complexity level.',
    href: '/prompt-lab',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Shield,
    title: 'Trust & Governance',
    description: 'Every pattern includes trust considerations, audit trail guidance, and HITL checkpoints for responsible AI deployment.',
    href: '/patterns',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
  },
  {
    icon: Zap,
    title: 'Quality Checklist',
    description: 'Built-in quality checklist for accessibility, UX, agentic trust, and governance — generated per recommendation.',
    href: '/prompt-lab',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
];

const stats = [
  { value: `${patterns.length}`, label: 'UI Patterns' },
  { value: `${workflows.length}`, label: 'Workflow Blueprints' },
  { value: '8', label: 'Persona Types' },
  { value: '14+', label: 'Layout Archetypes' },
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

export default function Home() {
  const featuredPatterns = patterns.slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/20">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold font-display text-sm">Agentic UI Pro</span>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <Link href="/patterns">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm">
                Patterns
              </Button>
            </Link>
            <Link href="/workflows">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm">
                Workflows
              </Button>
            </Link>
            <Link href="/prompt-lab">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm">
                Prompt Lab
              </Button>
            </Link>
          </div>
          <Link href="/prompt-lab">
            <Button size="sm" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Try Prompt Lab
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Background hero image */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url('https://d2xsxph8kpxj0f.cloudfront.net/90748905/7UyP53u6hxZxgCPmMW6jTT/hero-bg-cfdrZyo2o9H8gfi7GTrffC.webp')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            opacity: 0.35,
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 text-xs px-3 py-1">
            <Sparkles className="h-3 w-3 mr-1.5" />
            Intelligence Layer for Agentic SaaS UI
          </Badge>

          <h1 className="text-5xl md:text-6xl font-bold font-display tracking-tight leading-[1.1] mb-6">
            Build AI-native interfaces
            <br />
            <span className="text-primary">with confidence</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            A curated pattern library, workflow blueprints, and an AI-powered Prompt Lab for designing
            production-ready agentic SaaS products — with trust, governance, and HITL built in.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/prompt-lab">
              <Button size="lg" className="gap-2 px-6">
                <FlaskConical className="h-4 w-4" />
                Open Prompt Lab
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/patterns">
              <Button variant="outline" size="lg" className="gap-2 px-6">
                <Layers className="h-4 w-4" />
                Browse Patterns
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="max-w-2xl mx-auto mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold font-display text-primary">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <h2 className="text-2xl font-bold font-display mb-2">Everything you need to ship</h2>
            <p className="text-muted-foreground">
              From pattern discovery to code generation — the full design-to-code workflow for agentic products.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link key={feature.title} href={feature.href}>
                  <Card className="bg-card border-border hover:border-primary/30 transition-all duration-200 cursor-pointer group h-full">
                    <CardContent className="p-5">
                      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${feature.bg} mb-4`}>
                        <Icon className={`h-4.5 w-4.5 ${feature.color}`} />
                      </div>
                      <h3 className="font-semibold font-display text-sm mb-1.5 group-hover:text-primary transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pattern Preview Strip */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold font-display mb-1">Featured Patterns</h2>
              <p className="text-sm text-muted-foreground">Production-ready UI patterns for agentic products</p>
            </div>
            <Link href="/patterns">
              <Button variant="outline" size="sm" className="gap-1.5">
                View all {patterns.length}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredPatterns.map((pattern) => (
              <Link key={pattern.id} href={`/patterns/${pattern.id}`}>
                <Card className="bg-card border-border hover:border-primary/30 transition-all duration-200 cursor-pointer group h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`tag ${categoryColors[pattern.category] || 'bg-muted text-muted-foreground'}`}>
                        {pattern.category.replace(/-/g, ' ')}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {pattern.complexity}
                      </Badge>
                    </div>
                    <h3 className="font-semibold font-display text-sm mb-1.5 group-hover:text-primary transition-colors">
                      {pattern.name}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {pattern.summary}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {pattern.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
            <FlaskConical className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-3xl font-bold font-display mb-4">
            Describe your product.<br />Get a pattern recommendation.
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            The Prompt Lab analyzes your use case, persona, and complexity to recommend the right
            patterns, layout archetypes, and generate a production-ready React component.
          </p>
          <Link href="/prompt-lab">
            <Button size="lg" className="gap-2 px-8">
              <Sparkles className="h-4 w-4" />
              Open Prompt Lab
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold font-display">Agentic UI Pro</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Pattern library and intelligence layer for agentic SaaS products.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/patterns">
              <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Patterns</span>
            </Link>
            <Link href="/workflows">
              <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Workflows</span>
            </Link>
            <Link href="/prompt-lab">
              <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Prompt Lab</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
