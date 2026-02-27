import { Calculator, Network, Scale, Search } from "lucide-react";

export function Solution() {
  return (
    <section
      id="solution"
      className="py-24 max-w-7xl mx-auto px-6 relative z-10"
    >
      <div className="mb-16">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
          Don't just buy software.
          <br />
          Hire a Digital Value Team.
        </h2>
        <p
          className="max-w-2xl text-sm md:text-base mb-4"
          style={{ color: "#707070" }}
        >
          VALYNT isn't another dashboard. It is an autonomous{" "}
          <strong style={{ color: "#00FF9D" }}>Value Operating System</strong>{" "}
          that weaves through your entire enterprise. Replace manual guesswork
          with intelligent agents.
        </p>
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg"
          style={{
            backgroundColor: "rgba(24, 195, 165, 0.1)",
            border: "1px solid rgba(24, 195, 165, 0.3)",
          }}
        >
          <span className="text-sm font-medium" style={{ color: "#18C3A5" }}>
            Zero-entry data capture for reps. 100% visibility for leadership.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6 h-auto md:h-[450px]">
        <div className="col-span-1 md:col-span-4 glass-card rounded-2xl p-8 relative overflow-hidden group cursor-pointer">
          <div
            className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background:
                "linear-gradient(to bottom right, rgba(0, 255, 157, 0.05), transparent)",
            }}
          ></div>
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div>
              <div
                className="w-10 h-10 rounded flex items-center justify-center mb-6 transition-colors"
                style={{
                  border: "1px solid rgba(224, 224, 224, 0.1)",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                }}
              >
                <Network className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">
                The Value Fabric
              </h3>
              <p className="text-sm max-w-md" style={{ color: "#707070" }}>
                We replace manual "guesswork" with a system of Intelligent
                Agents. These aren't simple chatbots; they are digital employees
                that think, plan, and execute value motions 24/7.
              </p>
            </div>

            <div className="mt-8 flex gap-3">
              <div
                className="px-3 py-1.5 rounded-full text-[10px] font-mono"
                style={{
                  border: "1px solid rgba(224, 224, 224, 0.1)",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  color: "#E0E0E0",
                }}
              >
                Autonomous
              </div>
              <div
                className="px-3 py-1.5 rounded-full text-[10px] font-mono"
                style={{
                  border: "1px solid rgba(224, 224, 224, 0.1)",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  color: "#E0E0E0",
                }}
              >
                Evidence-Based
              </div>
              <div
                className="px-3 py-1.5 rounded-full text-[10px] font-mono"
                style={{
                  border: "1px solid rgba(224, 224, 224, 0.1)",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  color: "#E0E0E0",
                }}
              >
                Strategic
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 glass-card rounded-2xl p-8 relative overflow-hidden group flex flex-col justify-between cursor-pointer">
          <div>
            <div
              className="w-10 h-10 rounded flex items-center justify-center mb-6 transition-colors"
              style={{
                border: "1px solid rgba(224, 224, 224, 0.1)",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
              }}
            >
              <Search className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">
              They Research
            </h3>
            <p className="text-sm" style={{ color: "#707070" }}>
              While you sleep, they analyze prospect data and unstructured notes
              to find pain points automatically.
            </p>
          </div>
        </div>

        <div className="col-span-1 md:col-span-3 glass-card rounded-2xl p-8 relative overflow-hidden group cursor-pointer">
          <div
            className="w-10 h-10 rounded flex items-center justify-center mb-6 transition-colors"
            style={{
              border: "1px solid rgba(224, 224, 224, 0.1)",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
            }}
          >
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-medium text-white mb-2">They Quantify</h3>
          <p className="text-sm mb-6" style={{ color: "#707070" }}>
            They build defensible, conservative ROI models automatically. No
            more broken spreadsheets.
          </p>
          <div
            className="h-16 w-full rounded flex flex-col justify-center px-4 gap-2"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(224, 224, 224, 0.05)",
            }}
          >
            <div
              className="flex justify-between text-[10px] uppercase font-mono tracking-wider"
              style={{ color: "#707070" }}
            >
              <span>Model Accuracy</span>
              <span>99.8%</span>
            </div>
            <div
              className="w-full h-1 rounded"
              style={{ backgroundColor: "rgba(112, 112, 112, 0.5)" }}
            >
              <div
                className="w-[99%] h-full rounded"
                style={{ backgroundColor: "#00FF9D" }}
              ></div>
            </div>
          </div>
        </div>

        <div className="col-span-1 md:col-span-3 glass-card rounded-2xl p-8 relative overflow-hidden flex flex-col justify-start group cursor-pointer">
          <div
            className="w-10 h-10 rounded flex items-center justify-center mb-6 transition-colors"
            style={{
              border: "1px solid rgba(224, 224, 224, 0.1)",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
            }}
          >
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-medium text-white mb-2">
              They Enforce
            </h3>
            <p className="text-sm" style={{ color: "#707070" }}>
              They ensure every claim you make is backed by data and integrity.
              Hype is strictly forbidden.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
