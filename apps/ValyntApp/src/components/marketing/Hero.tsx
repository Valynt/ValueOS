import {
  Bot,
  ChevronRight,
  FileCheck,
  GitMerge,
  ShieldCheck,
} from "lucide-react";

export function Hero() {
  return (
    <section
      className="md:pt-48 md:pb-16 max-w-7xl z-10 border-white/5 border-b mr-auto ml-auto pt-32 pr-6 pb-20 pl-6 relative"
      aria-label="Hero section"
    >
      <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-8 animate-fade-up"
          role="status"
          style={{
            border: "1px solid var(--mkt-border-brand)",
            backgroundColor: "var(--mkt-bg-brand-subtle)",
          }}
        >
          <span
            className="flex h-1.5 w-1.5 rounded-full"
            aria-hidden="true"
            style={{
              backgroundColor: "var(--mkt-brand-primary)",
              boxShadow: "0 0 8px rgba(var(--mkt-brand-primary-rgb), 0.5)",
            }}
          ></span>
          <span className="text-xs font-mono" style={{ color: "var(--mkt-brand-primary)" }}>
            VALYNT OS™ Online
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter text-white mb-6 leading-[1.1] animate-fade-up delay-100">
          Value, operationalized.
        </h1>

        <p
          className="text-lg md:text-xl max-w-3xl mb-10 font-light leading-relaxed animate-fade-up delay-200"
          style={{ color: "var(--mkt-text-muted)" }}
        >
          The AI-native{" "}
          <strong style={{ color: "var(--mkt-brand-primary)" }}>Value Operating System</strong>{" "}
          that models, measures, and proves your outcomes — automatically.{" "}
          <strong style={{ color: "var(--mkt-text-primary)" }}>
            Reduce CAC by 20%. Cut sales cycles by 30 days. Eliminate 67% of
            churn.
          </strong>{" "}
          VALYNT aligns Sales, Customer Success, Product, and Finance around a
          shared source of economic truth.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-up delay-300">
          <button
            className="h-10 px-6 rounded-full text-sm font-semibold transition-all flex items-center gap-2"
            aria-label="Explore the Value OS"
            style={{
              backgroundColor: "var(--mkt-brand-primary)",
              color: "var(--mkt-bg-dark)",
            }}
          >
            Explore the Value OS
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            className="h-10 px-6 rounded-full text-sm font-medium transition-all"
            style={{
              border: "1px solid var(--mkt-border-subtle)",
              backgroundColor: "transparent",
              color: "var(--mkt-text-secondary)",
            }}
          >
            See the VALYNT Engine in Action
          </button>
        </div>
      </div>

      <div
        className="mt-20 relative rounded-lg overflow-hidden shadow-2xl animate-fade-up delay-300 group"
        style={{
          border: "1px solid rgba(var(--mkt-text-secondary), 0.1)",
          backgroundColor: "var(--mkt-bg-card)",
        }}
      >
        <div className="absolute inset-0 bg-grid-small opacity-20"></div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

        <div className="md:p-12 grid grid-cols-1 md:grid-cols-3 z-10 pt-6 pr-6 pb-6 pl-6 relative gap-x-6 gap-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <GitMerge className="w-4 h-4 text-white" />
              <span className="text-xs font-mono" style={{ color: "var(--mkt-text-muted)" }}>
                VALUE TREE MAPPING
              </span>
            </div>
            <div
              className="p-4 rounded"
              style={{
                border: "1px solid rgba(224, 224, 224, 0.05)",
                backgroundColor: "rgba(255, 255, 255, 0.02)",
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm text-white font-medium">
                  Outcome: Reduce Churn
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    color: "var(--mkt-brand-primary)",
                    backgroundColor: "var(--mkt-bg-brand-subtle)",
                  }}
                >
                  Linked
                </span>
              </div>
              <div
                className="h-1 w-full rounded-full overflow-hidden"
                style={{ backgroundColor: "rgba(var(--mkt-text-secondary), 0.1)" }}
              >
                <div className="h-full w-3/4 bg-white rounded-full"></div>
              </div>
            </div>
            <div
              className="p-4 rounded"
              style={{
                border: "1px solid rgba(224, 224, 224, 0.05)",
                backgroundColor: "rgba(255, 255, 255, 0.02)",
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm" style={{ color: "var(--mkt-text-muted)" }}>
                  Metric: Expansion Revenue
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    color: "var(--mkt-accent-blue)",
                    backgroundColor: "rgba(var(--mkt-accent-blue-rgb), 0.1)",
                  }}
                >
                  Optimizing
                </span>
              </div>
              <div
                className="h-1 w-full rounded-full overflow-hidden"
                style={{ backgroundColor: "rgba(var(--mkt-text-secondary), 0.1)" }}
              >
                <div
                  className="h-full w-1/2 rounded-full"
                  style={{ backgroundColor: "var(--mkt-accent-blue)" }}
                ></div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-px h-full bg-gradient-to-b from-transparent via-white/10 to-transparent absolute left-1/2 -translate-x-1/2"></div>
            </div>
            <div className="h-full flex flex-col justify-center items-center gap-4 relative z-10">
              <div
                className="p-3 rounded-full transition-shadow duration-500"
                style={{
                  border: "1px solid var(--mkt-border-subtle)",
                  backgroundColor: "var(--mkt-bg-card-deep)",
                  boxShadow: "0 0 15px rgba(255, 255, 255, 0.1)",
                }}
              >
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div
                className="px-3 py-1.5 rounded-full text-[10px] font-mono flex items-center gap-2"
                style={{
                  border: "1px solid var(--mkt-border-brand)",
                  backgroundColor: "var(--mkt-bg-brand-subtle)",
                  color: "var(--mkt-brand-primary)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: "var(--mkt-brand-primary)" }}
                ></span>
                OPPORTUNITY AGENT ACTIVE
              </div>
              <div
                className="p-3 rounded-full"
                style={{
                  border: "1px solid rgba(var(--mkt-text-secondary), 0.1)",
                  backgroundColor: "var(--mkt-bg-card-deep)",
                }}
              >
                <FileCheck className="w-5 h-5" style={{ color: "var(--mkt-text-muted)" }} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 justify-end">
              <span className="text-xs font-mono" style={{ color: "var(--mkt-text-muted)" }}>
                CFO VALIDATION
              </span>
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div
              className="font-mono text-[10px] space-y-2 text-right"
              style={{ color: "var(--mkt-text-muted)" }}
            >
              <p
                className="pr-3 py-1"
                style={{ borderRight: "2px solid var(--mkt-border-subtle)" }}
              >
                ROI_Calculation:{" "}
                <span className="text-white">Conservative</span>
              </p>
              <p
                className="pr-3 py-1"
                style={{ borderRight: "2px solid var(--mkt-brand-primary)", color: "var(--mkt-brand-primary)" }}
              >
                Net_Present_Value: $1.2M{" "}
                  <span style={{ color: "rgba(var(--mkt-brand-primary-rgb), 0.4)" }}>
                  // verified
                </span>
              </p>
              <p
                className="pr-3 py-1"
                style={{ borderRight: "2px solid var(--mkt-border-subtle)" }}
              >
                Payback_Period: 6.2mo{" "}
                <span style={{ color: "rgba(112, 112, 112, 0.7)" }}>
                  // optimal
                </span>
              </p>
              <p
                className="pr-3 py-1"
                style={{ borderRight: "2px solid var(--mkt-border-subtle)" }}
              >
                Risk_Factor: Low{" "}
                <span style={{ color: "rgba(112, 112, 112, 0.7)" }}>
                  // audited
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
