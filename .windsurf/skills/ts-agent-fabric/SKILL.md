# Agent Fabric Type Expert — SKILL.md

Fix agent-specific type complexity in the Agent Fabric.

## Activation
Use when seeing:
- BaseAgent extension type errors
- LLM response schema issues
- MessageBus payload type mismatches
- Memory system type errors

## Process

1. **LLM Response Schemas**
   ```typescript
   const ResponseSchema = z.object({
     result: z.string(),
     confidence: z.number().min(0).max(1),
     hallucination_check: z.boolean(), // Required
   });
   ```

2. **Agent State Types**
   ```typescript
   interface MyAgentState extends BaseAgentState {
     customField: string;
   }
   ```

3. **MessageBus CloudEvents**
   ```typescript
   const event: CloudEvent = {
     specversion: '1.0',
     type: 'agent.completed',
     source: 'agent/my-agent',
     id: generateId(),
     trace_id: session.traceId, // Required
     data: payload,
   };
   ```

4. **Memory Operations**
   ```typescript
   await memorySystem.store(embedding, {
     content: data,
     metadata: {
       tenant_id: this.organizationId, // Required
       agent_type: this.name,
     },
   });
   ```

## Constraints
- Maintain agent lifecycle type safety
- Preserve tenant isolation in all memory ops
- Keep CloudEvents structure valid
- Never remove hallucination_check from schemas

## Example Transformation

```typescript
// Before
class MyAgent extends BaseAgent {
  async process(data: unknown) {
    const result = await this.llm.complete(prompt);
    return result; // Untyped
  }
}

// After
class MyAgent extends BaseAgent {
  async process(data: InputType): Promise<OutputType> {
    const result = await this.secureInvoke(
      this.sessionId,
      prompt,
      OutputSchema,
      options
    );
    return result; // Typed via Zod schema
  }
}
```
