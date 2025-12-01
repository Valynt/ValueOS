# AI Agent Modules

**Paths:** `src/lib/agent-fabric/agents/*` & `src/agents/*`

- Each agent = single class in `[AgentName]Agent.ts`
- MUST extend `BaseAgent`
- Use handlebars syntax for prompts (string concatenation FORBIDDEN)
- All LLM calls via `this.secureInvoke()` ONLY
- 100% test coverage required
- Mock `LLMGateway` and `MemorySystem` in tests
