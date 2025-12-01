# Tool Libraries

**Paths:** `src/tools/*` & `src/services/tools/*`

- Tools must implement `Tool<TInput, TOutput>` interface
- Register in `ToolRegistry.ts` (dynamic creation FORBIDDEN)
- Check `LocalRules` (LR-001) before execution
- External API tools MUST use `RateLimiter` middleware
