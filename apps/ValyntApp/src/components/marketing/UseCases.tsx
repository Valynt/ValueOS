import { CheckCircle } from "lucide-react";

export function UseCases() {
  return (
    <section id="use-cases" className="py-24 max-w-7xl mx-auto px-6">
      <div className="mb-16">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
          Value Intelligence in Action
        </h2>
        <p
          className="max-w-xl text-sm md:text-base"
          style={{ color: "var(--mkt-text-muted)" }}
        >
          Real scenarios where VALYNT autonomous agents orchestrate outcomes
          across the value lifecycle.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="group glass-card p-6 rounded-xl border border-transparent hover:border-white/10 transition-all">
          <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent mb-6"></div>
          <h3 className="text-lg font-semibold text-white mb-1">Scenario A</h3>
          <p className="text-xs font-mono mb-4" style={{ color: "var(--mkt-text-muted)" }}>
            The "Perfect" Discovery Call
          </p>

          <div className="flex items-center gap-3 mb-6">
            <div
              className="px-2 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: "rgba(var(--mkt-brand-primary-rgb), 0.15)",
                color: "var(--mkt-brand-primary)",
              }}
            >
              Opportunity Agent
            </div>
          </div>

          <ul className="space-y-4 mb-8">
            <li className="flex gap-3 items-start">
              <CheckCircle
                className="w-4 h-4 mt-0.5 shrink-0"
                style={{ color: "var(--mkt-brand-primary)" }}
              />
              <p className="text-sm" style={{ color: "var(--mkt-text-muted)" }}>
                Instantly analyzes unstructured notes and transcripts.
              </p>
            </li>
            <li className="flex gap-3 items-start">
              <CheckCircle
                className="w-4 h-4 mt-0.5 shrink-0"
                style={{ color: "var(--mkt-brand-primary)" }}
              />
              <p className="text-sm" style={{ color: "var(--mkt-text-muted)" }}>
                Generates "Persona Fit" reports before you hang up.
              </p>
            </li>
          </ul>
        </div>

        <div className="group glass-card p-6 rounded-xl border border-transparent hover:border-white/10 transition-all">
          <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent mb-6"></div>
          <h3 className="text-lg font-semibold text-white mb-1">Scenario B</h3>
          <p className="text-xs font-mono mb-4" style={{ color: "var(--mkt-text-muted)" }}>
            The "CFO-Proof" Business Case
          </p>

          <div className="flex items-center gap-3 mb-6">
            <div
              className="px-2 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: "rgba(0, 174, 239, 0.15)",
                color: "var(--mkt-accent-blue)",
              }}
            >
              Integrity Agent
            </div>
          </div>

          <ul className="space-y-4 mb-8">
            <li className="flex gap-3 items-start">
              <CheckCircle
                className="w-4 h-4 mt-0.5 shrink-0"
                style={{ color: "var(--mkt-accent-blue)" }}
              />
              <p className="text-sm" style={{ color: "var(--mkt-text-muted)" }}>
                Audits every ROI calculation against manifesto rules.
              </p>
            </li>
            <li className="flex gap-3 items-start">
              <CheckCircle
                className="w-4 h-4 mt-0.5 shrink-0"
                style={{ color: "var(--mkt-accent-blue)" }}
              />
              <p className="text-sm" style={{ color: "var(--mkt-text-muted)" }}>
                Flags hype and enforces conservative estimates.
              </p>
            </li>
          </ul>
        </div>

        <div className="group glass-card p-6 rounded-xl border border-transparent hover:border-white/10 transition-all">
          <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent mb-6"></div>
          <h3 className="text-lg font-semibold text-white mb-1">Scenario C</h3>
          <p className="text-xs font-mono mb-4" style={{ color: "var(--mkt-text-muted)" }}>
            The "Auto-Pilot" Expansion
          </p>

          <div className="flex items-center gap-3 mb-6">
            <div
              className="px-2 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: "rgba(var(--mkt-brand-primary-rgb), 0.15)",
                color: "var(--mkt-brand-primary)",
              }}
            >
              Expansion Agent
            </div>
          </div>

          <ul className="space-y-4 mb-8">
            <li className="flex gap-3 items-start">
              <CheckCircle
                className="w-4 h-4 mt-0.5 shrink-0"
                style={{ color: "var(--mkt-brand-primary)" }}
              />
              <p className="text-sm" style={{ color: "var(--mkt-text-muted)" }}>
                Monitors realization data against benchmarks.
              </p>
            </li>
            <li className="flex gap-3 items-start">
              <CheckCircle
                className="w-4 h-4 mt-0.5 shrink-0"
                style={{ color: "var(--mkt-brand-primary)" }}
              />
              <p className="text-sm" style={{ color: "var(--mkt-text-muted)" }}>
                Drafts sales-ready upsell cases automatically.
              </p>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
