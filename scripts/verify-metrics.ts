import { getMetricsRegistry } from "../src/middleware/metricsMiddleware";
import "../src/lib/monitoring/metrics"; // Import to ensure side effects (registration) happen

async function verify() {
  const registry = getMetricsRegistry();
  const metrics = await registry.metrics();

  const hasLatency = metrics.includes("agent_query_latency_seconds");
  const hasCircuitBreaker = metrics.includes("llm_circuit_breaker_state");

  console.log("Verifying Metrics Registration:");
  console.log(
    `- agent_query_latency_seconds: ${hasLatency ? "✅ FOUND" : "❌ MISSING"}`
  );
  console.log(
    `- llm_circuit_breaker_state: ${hasCircuitBreaker ? "✅ FOUND" : "❌ MISSING"}`
  );

  if (hasLatency && hasCircuitBreaker) {
    console.log("\nSUCCESS: All expected metrics are registered.");
    process.exit(0);
  } else {
    console.error("\nFAILURE: Missing expected metrics.");
    process.exit(1);
  }
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
