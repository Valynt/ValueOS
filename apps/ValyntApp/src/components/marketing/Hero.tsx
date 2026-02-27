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
            border: "1px solid rgba(24, 195, 165, 0.3)",
            backgroundColor: "rgba(24, 195, 165, 0.1)",
          }}
        >
          <span
            className="flex h-1.5 w-1.5 rounded-full"
            aria-hidden="true"
            style={{
              backgroundColor: "#18C3A5",
              boxShadow: "0 0 8px rgba(24, 195, 165, 0.5)",
            }}
          ></span>
          <span className="text-xs font-mono" style={{ color: "#18C3A5" }}>
            VALYNT OS™ Online
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter text-white mb-6 leading-[1.1] animate-fade-up delay-100">
          Value, operationalized.
        </h1>

        <p
          className="text-lg md:text-xl max-w-3xl mb-10 font-light leading-relaxed animate-fade-up delay-200"
          style={{ color: "#707070" }}
        >
          The AI-native{" "}
          <strong style={{ color: "#18C3A5" }}>Value Operating System</strong>{" "}
          that models, measures, and proves your outcomes — automatically.{" "}
          <strong style={{ color: "#FFFFFF" }}>
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
              backgroundColor: "#18C3A5",
              color: "#0B0C0F",
            }}
          >
            Explore the Value OS
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            className="h-10 px-6 rounded-full text-sm font-medium transition-all"
            style={{
              border: "1px solid rgba(224, 224, 224, 0.2)",
              backgroundColor: "transparent",
              color: "#E0E0E0",
            }}
          >
            See the VALYNT Engine in Action
          </button>
        </div>
      </div>

      <div
        className="mt-20 relative rounded-lg overflow-hidden shadow-2xl animate-fade-up delay-300 group"
        style={{
          border: "1px solid rgba(224, 224, 224, 0.1)",
          backgroundColor: "#1E1E1E",
        }}
      >
        <div className="absolute inset-0 bg-grid-small opacity-20"></div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

        <div className="md:p-12 grid grid-cols-1 md:grid-cols-3 z-10 pt-6 pr-6 pb-6 pl-6 relative gap-x-6 gap-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <GitMerge className="w-4 h-4 text-white" />
              <span className="text-xs font-mono" style={{ color: "#707070" }}>
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
                    color: "#18C3A5",
                    backgroundColor: "rgba(24, 195, 165, 0.1)",
                  }}
                >
                  Linked
                </span>
              </div>
              <div
                className="h-1 w-full rounded-full overflow-hidden"
                style={{ backgroundColor: "rgba(224, 224, 224, 0.1)" }}
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
                <span className="text-sm" style={{ color: "#707070" }}>
                  Metric: Expansion Revenue
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    color: "#00AEEF",
                    backgroundColor: "rgba(0, 174, 239, 0.1)",
                  }}
                >
                  Optimizing
                </span>
              </div>
              <div
                className="h-1 w-full rounded-full overflow-hidden"
                style={{ backgroundColor: "rgba(224, 224, 224, 0.1)" }}
              >
                <div
                  className="h-full w-1/2 rounded-full"
                  style={{ backgroundColor: "#00AEEF" }}
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
                  border: "1px solid rgba(224, 224, 224, 0.2)",
                  backgroundColor: "#0A0A0A",
                  boxShadow: "0 0 15px rgba(255, 255, 255, 0.1)",
                }}
              >
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div
                className="px-3 py-1.5 rounded-full text-[10px] font-mono flex items-center gap-2"
                style={{
                  border: "1px solid rgba(24, 195, 165, 0.3)",
                  backgroundColor: "rgba(24, 195, 165, 0.1)",
                  color: "#18C3A5",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: "#18C3A5" }}
                ></span>
                OPPORTUNITY AGENT ACTIVE
              </div>
              <div
                className="p-3 rounded-full"
                style={{
                  border: "1px solid rgba(224, 224, 224, 0.1)",
                  backgroundColor: "#0A0A0A",
                }}
              >
                <FileCheck className="w-5 h-5" style={{ color: "#707070" }} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 justify-end">
              <span className="text-xs font-mono" style={{ color: "#707070" }}>
                CFO VALIDATION
              </span>
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div
              className="font-mono text-[10px] space-y-2 text-right"
              style={{ color: "#707070" }}
            >
              <p
                className="pr-3 py-1"
                style={{ borderRight: "2px solid rgba(224, 224, 224, 0.2)" }}
              >
                ROI_Calculation:{" "}
                <span className="text-white">Conservative</span>
              </p>
              <p
                className="pr-3 py-1"
                style={{ borderRight: "2px solid #18C3A5", color: "#18C3A5" }}
              >
                Net_Present_Value: $1.2M{" "}
                <span style={{ color: "rgba(24, 195, 165, 0.4)" }}>
                  // verified
                </span>
              </p>
              <p
                className="pr-3 py-1"
                style={{ borderRight: "2px solid rgba(224, 224, 224, 0.2)" }}
              >
                Payback_Period: 6.2mo{" "}
                <span style={{ color: "rgba(112, 112, 112, 0.7)" }}>
                  // optimal
                </span>
              </p>
              <p
                className="pr-3 py-1"
                style={{ borderRight: "2px solid rgba(224, 224, 224, 0.2)" }}
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
