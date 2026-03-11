/*
 * ValueOS Wireframes — Home / Landing
 * Production-ready showcase with hero, feature highlights, and screen grid
 * Design: Dark, cinematic, enterprise-grade
 */
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  LayoutDashboard, FileText, Sparkles, Layers,
  FlaskConical, Scale, Shield, Command,
  BarChart3, Rocket, TrendingUp, ArrowRight,
  Eye, Zap, Brain, Lock, GitBranch, Boxes,
  ChevronRight
} from "lucide-react";
import { useCommandPalette } from "@/components/wireframes/CommandPalette";

const HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/90748905/98g94Xr9NRKCWDrPtEJPMi/hero-banner-QWuVx3PhpP5AEt5dVRRfbq.webp";

const principles = [
  {
    icon: Eye,
    title: "Observable Reasoning",
    description: "Every AI decision shows its chain-of-thought. No black boxes — just transparent, auditable intelligence.",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    icon: Lock,
    title: "Human Authority",
    description: "Policy gates enforce governance. The AI suggests, drafts, and recommends — the human approves and decides.",
    color: "text-risk",
    bg: "bg-risk/10",
  },
  {
    icon: GitBranch,
    title: "Evidence Provenance",
    description: "Every claim traces to a source. 3-tier evidence classification with confidence scoring and lineage chains.",
    color: "text-health",
    bg: "bg-health/10",
  },
  {
    icon: Brain,
    title: "Decision Readiness",
    description: "Not sales stages — decision-readiness progression. Signal → Hypothesis → Evidence → Defensible → Approved.",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    icon: Zap,
    title: "Shared Autonomy",
    description: "Three autonomy levels — Watch, Assist, Autonomous — let teams dial AI independence up or down in real-time.",
    color: "text-warning",
    bg: "bg-warning/10",
  },
  {
    icon: Boxes,
    title: "Continuous Proof",
    description: "Post-sale realization tracking proves promised value was delivered. Drift alerts fire when actuals diverge.",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
  },
];

const screens = [
  {
    title: "Value Command Center",
    description: "Portfolio overview with maturity scores, approval queue, and ValueLoop analytics. The primary operating surface.",
    href: "/wireframes/command-center",
    icon: LayoutDashboard,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    tag: "Primary Surface",
  },
  {
    title: "Value Case Workspace",
    description: "Decision dossier with 7-stage Kernel Builder, assumption ledger, evidence panel, and stakeholder alignment.",
    href: "/wireframes/workspace/acme-cloud",
    icon: FileText,
    color: "text-health",
    bg: "bg-health/10",
    border: "border-health/20",
    tag: "Case Detail",
  },
  {
    title: "Decision Canvas",
    description: "Agentic workspace with observable reasoning, Red Team review, cross-case learning, and live interactive blocks.",
    href: "/wireframes/canvas",
    icon: Sparkles,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    tag: "AI Workspace",
  },
  {
    title: "Value Maturity Board",
    description: "Drag-and-drop Kanban with 7 policy gate rules enforced in real-time during stage transitions.",
    href: "/wireframes/maturity",
    icon: Layers,
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/20",
    tag: "Portfolio View",
  },
  {
    title: "Evidence Graph",
    description: "Graph-native provenance with tier badges, 3-component confidence breakdown, and lineage drawer.",
    href: "/wireframes/evidence",
    icon: FlaskConical,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    tag: "Proof Network",
  },
  {
    title: "Decision Desk",
    description: "HITL approval queue for policy exceptions, stage promotions, discount approvals, and assumption overrides.",
    href: "/wireframes/decisions",
    icon: Scale,
    color: "text-risk",
    bg: "bg-risk/10",
    border: "border-risk/20",
    tag: "Governance",
  },
  {
    title: "Policy & Governance",
    description: "Policy rules, Domain Packs, agent permissions, audit trail, and compliance export.",
    href: "/wireframes/governance",
    icon: Shield,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    tag: "Administration",
  },
  {
    title: "Value Realization Dashboard",
    description: "Post-sale KPIs vs actuals, milestone tracking, variance analysis, and CFO-ready reports.",
    href: "/wireframes/realization",
    icon: BarChart3,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/20",
    tag: "Post-Sale",
  },
  {
    title: "Tenant Onboarding Wizard",
    description: "5-step progressive context ingestion for enterprise pilots — company profile to Domain Pack selection.",
    href: "/wireframes/onboarding",
    icon: Rocket,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    tag: "Setup",
  },
  {
    title: "Expansion Recommendations",
    description: "Integrity-scored cross-sell and upsell opportunities linked to realization data.",
    href: "/wireframes/expansion",
    icon: TrendingUp,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    tag: "Growth",
  },
];

const stageFlow = [
  { label: "Signal", color: "bg-slate-500" },
  { label: "Hypothesis", color: "bg-blue-500" },
  { label: "Evidence", color: "bg-sky-500" },
  { label: "Defensible", color: "bg-warning" },
  { label: "Exec Ready", color: "bg-violet-500" },
  { label: "Approved", color: "bg-health" },
  { label: "Realization", color: "bg-teal-500" },
];

export default function Home() {
  const { setOpen } = useCommandPalette();

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Hero Section ─── */}
      <section className="relative overflow-hidden">
        {/* Hero background image */}
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt=""
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
        </div>

        <div className="relative z-10 container">
          {/* Top bar */}
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <span className="text-primary text-sm font-bold font-mono">V</span>
              </div>
              <span className="text-sm font-semibold tracking-tight">ValueOS</span>
            </div>
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/60 backdrop-blur border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            >
              <Command className="w-3.5 h-3.5" />
              <span className="text-[11px] font-mono">K to search</span>
            </button>
          </div>

          {/* Hero content */}
          <div className="pt-12 pb-20 md:pt-20 md:pb-32 max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80 bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                  Interactive Wireframes
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  10 Screens &middot; Responsive &middot; Annotated
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
                The Value{" "}
                <span className="bg-gradient-to-r from-primary via-violet-400 to-sky-400 bg-clip-text text-transparent">
                  Operating System
                </span>
              </h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mb-8">
                Agentic UI wireframes for enterprise B2B revenue teams. Value Cases — not CRM deals — are the primary object. Decision-readiness progression replaces sales pipeline stages. Every AI action is observable, every claim traces to evidence.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/wireframes/command-center">
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors">
                    Explore Wireframes
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
                <button
                  onClick={() => setOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-card border border-border text-foreground font-medium text-sm hover:border-primary/30 transition-colors"
                >
                  <Command className="w-3.5 h-3.5" />
                  Quick Navigate
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Decision Readiness Flow ─── */}
      <section className="border-y border-border bg-card/30">
        <div className="container py-6 md:py-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Decision-Readiness Progression</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-0">
            {stageFlow.map((stage, i) => (
              <div key={stage.label} className="flex items-center">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card border border-border">
                  <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                  <span className="text-xs font-medium">{stage.label}</span>
                </div>
                {i < stageFlow.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 mx-1 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Design Principles ─── */}
      <section className="container py-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">Core Principles</span>
          </div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-2">
            Six principles that shape every screen
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mb-8">
            These are not decorative — they are enforced in code. Policy gates block non-compliant actions. Evidence tiers classify every data point. Autonomy levels govern agent behavior.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {principles.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                className="p-5 rounded-xl bg-card border border-border hover:border-primary/20 transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg ${p.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-4.5 h-4.5 ${p.color}`} />
                </div>
                <h3 className="text-sm font-semibold mb-1.5">{p.title}</h3>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{p.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ─── Screen Grid ─── */}
      <section className="container pb-12 md:pb-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">All Screens</span>
          </div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-2">
            10 interactive wireframes
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mb-8">
            Each screen is fully responsive (desktop, tablet, mobile), includes design annotations (press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono mx-0.5">A</kbd>), and demonstrates a specific agentic UI pattern.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {screens.map((screen, i) => {
            const Icon = screen.icon;
            return (
              <motion.div
                key={screen.href}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
              >
                <Link href={screen.href}>
                  <div className={`group p-5 rounded-xl bg-card border ${screen.border} hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer h-full`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-9 h-9 rounded-lg ${screen.bg} flex items-center justify-center`}>
                        <Icon className={`w-4.5 h-4.5 ${screen.color}`} />
                      </div>
                      <div>
                        <h3 className="text-[14px] font-semibold group-hover:text-primary transition-colors">{screen.title}</h3>
                        <span className={`text-[9px] font-mono uppercase tracking-wider ${screen.color}`}>{screen.tag}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{screen.description}</p>
                    <div className="flex items-center gap-1 text-[11px] text-primary/70 group-hover:text-primary transition-colors">
                      <span>Open wireframe</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ─── Keyboard Shortcuts ─── */}
      <section className="border-t border-border">
        <div className="container py-8 md:py-12">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Keyboard Shortcuts</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            <div className="flex items-center gap-3">
              <kbd className="px-2 py-1 rounded bg-card border border-border text-xs font-mono">⌘ K</kbd>
              <span className="text-sm text-muted-foreground">Command Palette</span>
            </div>
            <div className="flex items-center gap-3">
              <kbd className="px-2 py-1 rounded bg-card border border-border text-xs font-mono">A</kbd>
              <span className="text-sm text-muted-foreground">Toggle Annotations</span>
            </div>
            <div className="flex items-center gap-3">
              <kbd className="px-2 py-1 rounded bg-card border border-border text-xs font-mono">Drag</kbd>
              <span className="text-sm text-muted-foreground">Move cards on Maturity Board</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border">
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
                <span className="text-primary text-[10px] font-bold font-mono">V</span>
              </div>
              <div>
                <span className="text-xs font-semibold">ValueOS Wireframes</span>
                <span className="text-[10px] text-muted-foreground ml-2">by Valynt</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span>React + TypeScript + Tailwind CSS</span>
              <span className="hidden sm:inline">&middot;</span>
              <span>10 Screens &middot; Responsive &middot; Annotated</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
