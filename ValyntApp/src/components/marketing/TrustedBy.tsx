import { Hexagon, Triangle, Box, Circle, Command } from "lucide-react";

export function TrustedBy() {
  return (
    <section
      className="pb-24 border-b"
      style={{ borderColor: "rgba(224, 224, 224, 0.05)" }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <p
          className="text-center text-xs font-medium mb-8 uppercase tracking-widest"
          style={{ color: "#707070" }}
        >
          Trusting the System
        </p>
        <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-40 grayscale">
          <div className="flex items-center gap-2">
            <Hexagon className="w-6 h-6" style={{ color: "#E0E0E0" }} />
            <span
              className="font-bold tracking-tight text-lg"
              style={{ color: "#E0E0E0" }}
            >
              AcmeCorp
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Triangle className="w-6 h-6" style={{ color: "#E0E0E0" }} />
            <span
              className="font-bold tracking-tight text-lg"
              style={{ color: "#E0E0E0" }}
            >
              Vortex
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Box className="w-6 h-6" style={{ color: "#E0E0E0" }} />
            <span
              className="font-bold tracking-tight text-lg"
              style={{ color: "#E0E0E0" }}
            >
              HyperCube
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="w-6 h-6" style={{ color: "#E0E0E0" }} />
            <span
              className="font-bold tracking-tight text-lg"
              style={{ color: "#E0E0E0" }}
            >
              Orbit
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Command className="w-6 h-6" style={{ color: "#E0E0E0" }} />
            <span
              className="font-bold tracking-tight text-lg"
              style={{ color: "#E0E0E0" }}
            >
              Command
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
