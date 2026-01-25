# ValueOS: Engineering Onboarding & Architecture Manual

This manual serves as the definitive technical blueprint for engineers joining the ValueOS ecosystem. ValueOS is not merely a software suite; it is a **declarative, agent-centric operating environment** designed for high-scale AI orchestration. Our architecture prioritizes reproducibility, deep observability, and self-correcting logic.

---

## 1. The Declarative Foundation: Nix & Docker

The ValueOS philosophy dictates that "Environment is Code." We eliminate the "it works on my machine" fallacy by utilizing a dual-layered declarative stack.

### The Nix Layer (Local Development)
We use **Nix Flakes** to manage our development shells. This ensures every engineer uses the exact same versions of compilers, runtimes (Python, Go, Rust), and CLI tools without polluting the global OS.

| Component | Role | Benefit |
| :--- | :--- | :--- |
| `flake.nix` | Root configuration | Defines the entire dependency graph. |
| `devShell` | Isolated environment | Instant activation of the ValueOS toolchain. |
| `nix-direnv` | Auto-loading | Seamlessly enters the environment upon `cd`. |

### The Docker Layer (Containerization)
While Nix handles the developer's machine, Docker ensures the **immutable deployment** of our microservices and agent nodes. Our images are "distroless" where possible to reduce the attack surface.

```bash
# Example of building the local environment via Nix
nix develop

# Example of launching the localized stack
docker compose up -d --build
```

---

## 2. The One-Click Bootstrap: Taskfile

Efficiency at ValueOS is driven by **Taskfile**, our preferred orchestration tool over traditional Makefiles. It provides a structured, readable way to handle complex automation.

### Key Commands
New engineers should focus on the `Taskfile.yml` located in the root directory.

1.  **`task init`**: Provisions local secrets, pulls Docker images, and warms the Nix cache.
2.  **`task up`**: Launches the entire ValueOS mesh, including the database, cache, and agent gateway.
3.  **`task test`**: Runs the full suite of unit and integration tests.
4.  **`task bench`**: Triggers the Ground Truth benchmark layer to validate model performance.

> *Strategic Insight:* Taskfile acts as the documentation for our operational workflows. If a process is performed more than twice, it must be codified as a task.

---

## 3. The Observability Mesh: Jaeger & Grafana

In a multi-agent system, logs are insufficient. We utilize an **Observability Mesh** powered by OpenTelemetry (OTel).

### Distributed Tracing (Jaeger)
Every request and agent "thought" is assigned a unique `trace_id`. Jaeger allows us to visualize the flow of data across multiple LLM calls and tool executions.

*   **Spans:** Each function call or API request is a span.
*   **Tags:** We tag traces with `model_version`, `prompt_id`, and `cost_token` to analyze economic efficiency.

### System Metrics (Grafana)
Grafana provides the "Pulse" of ValueOS. Our dashboards monitor:
- **Agent Latency:** Time-to-first-token (TTFT).
- **Inference Cost:** Real-time spend tracking across OpenAI, Anthropic, and local LLMs.
- **Success Rates:** Percentage of agent tasks completed without human intervention.

---

## 4. Multi-Agent Debugging

Debugging non-deterministic AI agents requires a shift from "line-by-line" stepping to **State-Space Analysis**.

### The Debugging Workflow
1.  **Identify the Trace:** Locate the failing `trace_id` in Jaeger.
2.  **Examine the Context Window:** ValueOS captures the exact prompt and system instructions sent to the LLM at the time of failure.
3.  **Replay Mechanism:** Use `task debug --trace <id>` to re-run the specific agent interaction in a sandbox environment with the same seeds.

**Common Debugging Targets:**
- **Hallucination Loops:** Where Agent A and Agent B provide conflicting data.
- **Tool-Call Failures:** Schema mismatches between the LLM output and the internal API.

---

## 5. The Ground Truth Benchmark Layer

We do not merge code based on "vibes." Every PR must pass the **Ground Truth Benchmark (GTB)**.

### Evaluation Metrics
We use a combination of deterministic and model-based evaluations:

| Metric | Description | Tooling |
| :--- | :--- | :--- |
| **Faithfulness** | Ensures the agent's answer is derived only from provided context. | Ragas / Custom Evaluators |
| **Tool Accuracy** | Validates that the correct tool was called with correct arguments. | JSON Schema Validation |
| **Regression Score** | Compares current output against a "Golden Dataset." | ValueOS Benchmarker |

### Continuous Evaluation (CE)
The GTB runs in our CI/CD pipeline. If an agent's performance on the Golden Dataset drops by >2%, the build is automatically gated.

---

## 6. Self-Healing & Governance Protocols

ValueOS is designed to survive infrastructure volatility and agent drift through **Self-Healing Protocols**.

### Governance Guards
- **Rate Limiting:** Protects downstream APIs from "infinite loops" caused by recursive agent calls.
- **Cost Circuit Breakers:** Automatically kills any agent session that exceeds a pre-defined dollar threshold.

### Self-Healing Mechanisms
1.  **Node Recovery:** Kubernetes liveness probes restart stalled agent containers.
2.  **Retry with Context:** If an LLM returns a malformed JSON, the system automatically sends the error message back to the LLM for a self-correction attempt (limited to 3 retries).
3.  **State Rollback:** If a multi-step agent task fails mid-way, ValueOS uses a saga pattern to roll back any database changes made by the agent.

---

## Summary for New Engineers

To begin your journey at ValueOS, follow the **"Golden Path"**:
1.  Clone the repository and run `nix develop`.
2.  Execute `task init` to prepare your environment.
3.  Run `task up` and navigate to `localhost:3000` to see the Grafana dashboard.
4.  Submit your first "Hello World" agent and observe its trace in Jaeger at `localhost:16686`.

**Welcome to the frontier of declarative AI infrastructure.**
