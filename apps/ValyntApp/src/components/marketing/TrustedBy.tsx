import { Box, Circle, Command, Hexagon, Triangle } from "lucide-react";

export function TrustedBy() {
  return (
    <section
      className="pb-24 border-b"
      style={{ borderColor: "rgba(224, 224, 224, 0.05)" }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <p
          className="text-center text-xs font-medium mb-8 uppercase tracking-widest"
          style={{ color: "var(--mkt-text-muted)" }}
        >
          Trusting the System
        </p>
        <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-40 grayscale">
          <div className="flex items-center gap-2">
            <Hexagon className="w-6 h-6" style={{ color: "var(--mkt-text-secondary)" }} />
            <span
              className="font-bold tracking-tight text-lg"
              style={{ color: "var(--mkt-text-secondary)" }}
            >
              AcmeCorp
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Triangle className="w-6 h-6" style={{ color: "var(--mkt-text-secondary)" }} />
            <span
              className="font-bold tracking-tight text-lg"
              style={{ color: "var(--mkt-text-secondary)" }}
            >
              Vortex
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Box className="w-6 h-6" style={{ color: "var(--mkt-text-secondary)" }} />
            <span
              className="font-bold tracking-tight text-lg"
              style={{ color: "var(--mkt-text-secondary)" }}
            >
              HyperCube
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="w-6 h-6" style={{ color: "var(--mkt-text-secondary)" }} />
            <span
              className="font-bold tracking-tight text-lg"
              style={{ color: "var(--mkt-text-secondary)" }}
            >
              Orbit
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Command className="w-6 h-6" style={{ color: "var(--mkt-text-secondary)" }} />
            <span
              className="font-bold tracking-tight text-lg"
              style={{ color: "var(--mkt-text-secondary)" }}
            >
              Command
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
