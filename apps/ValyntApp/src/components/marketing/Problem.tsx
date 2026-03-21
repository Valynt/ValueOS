import {
  AlertTriangle,
  FileSpreadsheet,
  MicOff,
  TrendingDown,
} from "lucide-react";

export function Problem() {
  return (
    <section
      id="problem"
      className="py-24 max-w-7xl mx-auto px-6 border-b"
      style={{
        borderColor: "rgba(224, 224, 224, 0.05)",
        backgroundColor: "var(--mkt-bg-card)",
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
        <div>
          <div
            className="inline-block px-3 py-1 rounded-full mb-4 text-xs font-mono uppercase tracking-wider"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "rgba(239, 68, 68, 0.9)",
            }}
          >
            The Villain
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-6">
            Welcome to{" "}
            <span style={{ color: "var(--mkt-error)" }}>The Feature Treadmill.</span>
            <br />
            <span style={{ color: "var(--mkt-text-muted)" }}>
              Where value disappears into a black hole.
            </span>
          </h2>
          <p className="leading-relaxed mb-8" style={{ color: "var(--mkt-text-muted)" }}>
            You're trapped in the old way:{" "}
            <strong style={{ color: "var(--mkt-error)" }}>The Black Hole of R&D</strong>{" "}
            — where features get built, shipped, and instantly forgotten. Sales
            pitches hype. CSMs scramble. Executives demand proof. But no one can
            connect the dots from capability to cash. Your value story isn't
            just broken —{" "}
            <strong style={{ color: "var(--mkt-text-primary)" }}>
              it's being actively destroyed
            </strong>{" "}
            by manual chaos and departmental silos.
          </p>
          <div
            className="p-4 rounded-lg"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.05)",
              border: "1px solid rgba(239, 68, 68, 0.1)",
            }}
          >
            <p
              className="text-sm font-mono"
              style={{ color: "rgba(239, 68, 68, 0.8)" }}
            >
              <AlertTriangle className="w-4 h-4 inline mr-2 -mt-0.5" />
              The Feature Treadmill is costing you 8× your potential growth.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card group p-6 rounded-xl cursor-default">
            <div className="flex gap-4">
              <div
                className="mt-1 p-2 rounded h-fit transition-colors"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  color: "var(--mkt-text-muted)",
                }}
              >
                <MicOff className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">The Disconnect</h3>
                <p
                  className="text-sm transition-colors"
                  style={{ color: "var(--mkt-text-muted)" }}
                >
                  Marketing speaks hype. Sales sells dreams. Customer Success
                  delivers... confusion.
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card group p-6 rounded-xl cursor-default">
            <div className="flex gap-4">
              <div
                className="mt-1 p-2 rounded h-fit transition-colors"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  color: "var(--mkt-text-muted)",
                }}
              >
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">The Grind</h3>
                <p
                  className="text-sm transition-colors"
                  style={{ color: "var(--mkt-text-muted)" }}
                >
                  You're drowning in manual spreadsheet models that crumble
                  under CFO scrutiny.
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card group p-6 rounded-xl cursor-default">
            <div className="flex gap-4">
              <div
                className="mt-1 p-2 rounded h-fit transition-colors"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  color: "var(--mkt-text-muted)",
                }}
              >
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">The Drift</h3>
                <p
                  className="text-sm transition-colors"
                  style={{ color: "var(--mkt-text-muted)" }}
                >
                  You close the deal, but 6 months later, the customer churns
                  because no one can prove you delivered.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
