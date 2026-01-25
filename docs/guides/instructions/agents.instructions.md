---
applyTo: "apps/ValyntApp/src/lib/agent-fabric/agents/**"
description: AI Agent Modules development guidelines
---

# AI Agent Modules

**Paths:** `apps/ValyntApp/src/lib/agent-fabric/agents/*`

- Each agent = single class in `[AgentName]Agent.ts`
- MUST extend `BaseAgent`
- Use handlebars syntax for prompts (string concatenation FORBIDDEN)
- All LLM calls via `this.secureInvoke()` ONLY
- 100% test coverage required
- Mock `LLMGateway` and `MemorySystem` in tests
