export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 border-y"
      style={{
        borderColor: "rgba(224, 224, 224, 0.05)",
        backgroundColor: "var(--mkt-bg-card)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
            Automate Value in 3 Steps
          </h2>
          <p
            className="text-sm max-w-2xl mx-auto mt-3"
            style={{ color: "var(--mkt-text-muted)" }}
          >
            No manual work for your team. No complex data entry. Just seamless
            automation that runs in the background while your reps stay in flow
            and leadership gets continuous proof.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent border-t border-dashed border-white/20 z-0"></div>

          <div className="relative z-10 flex flex-col items-center text-center group">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl transition-all duration-300"
              style={{
                backgroundColor: "var(--mkt-bg-card-deep)",
                border: "1px solid rgba(var(--mkt-text-secondary), 0.1)",
              }}
            >
              <span
                className="text-2xl font-mono transition-colors"
                style={{ color: "var(--mkt-text-muted)" }}
              >
                01
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">
              Define Your Truth
            </h3>
            <p
              className="text-sm leading-relaxed px-4"
              style={{ color: "var(--mkt-text-muted)" }}
            >
              Connect your "Value Tree." Map your capabilities to customer
              outcomes and financial impacts once. This becomes your single
              source of truth—your{" "}
              <strong style={{ color: "var(--mkt-accent-green)" }}>Value Fabric</strong>.
            </p>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center group">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl transition-all duration-300"
              style={{
                backgroundColor: "var(--mkt-bg-card-deep)",
                border: "1px solid rgba(var(--mkt-accent-blue-rgb), 0.5)",
                boxShadow: "0 0 20px rgba(var(--mkt-accent-blue-rgb), 0.2)",
              }}
            >
              <span className="text-2xl font-mono text-white">02</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">
              Deploy Your Agents
            </h3>
            <p
              className="text-sm leading-relaxed px-4"
              style={{ color: "var(--mkt-text-muted)" }}
            >
              Activate your digital workforce. The{" "}
              <strong style={{ color: "var(--mkt-accent-blue)" }}>Opportunity Agent</strong>{" "}
              scrapes discovery data to map pain points, while the{" "}
              <strong style={{ color: "var(--mkt-accent-blue)" }}>Target Agent</strong> commits
              to specific KPIs.
            </p>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center group">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl transition-all duration-300"
              style={{
                backgroundColor: "var(--mkt-bg-card-deep)",
                border: "1px solid rgba(var(--mkt-text-secondary), 0.1)",
              }}
            >
              <span
                className="text-2xl font-mono transition-colors"
                style={{ color: "var(--mkt-text-muted)" }}
              >
                03
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">
              Prove & Expand
            </h3>
            <p
              className="text-sm leading-relaxed px-4"
              style={{ color: "var(--mkt-text-muted)" }}
            >
              Sit back as the{" "}
              <strong style={{ color: "var(--mkt-accent-green)" }}>Realization Agent</strong>{" "}
              monitors actual usage data against promised targets, and the{" "}
              <strong style={{ color: "var(--mkt-accent-green)" }}>Expansion Agent</strong>{" "}
              proactively identifies upsell opportunities.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
