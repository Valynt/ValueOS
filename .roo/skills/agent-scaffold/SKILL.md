---
name: agent-scaffold
 description: Generate complete agent scaffolding with all required components. Use when creating new agents to ensure consistent patterns and proper integration.
license: MIT
compatibility: ValueOS agent-fabric
metadata:
  author: ValueOS
  version: "1.0"
  generatedBy: "1.2.0"
---

# Agent Scaffold Skill

Generates complete agent scaffolding with all required components for the ValueOS agent-fabric system.

## When to Use

- Creating new agents in the agent-fabric system
- Ensuring consistent agent patterns and proper integration
- Setting up agents with proper memory system integration
- Generating boilerplate code for agent development

## Input

- **agentName**: Kebab-case name (e.g., "opportunity-analyzer")
- **agentType**: Type of agent (opportunity, target, financial, integrity, narrative, expansion, realization, compliance)
- **lifecycleStage**: Stage in the value lifecycle (discovery, modeling, validation, realization, expansion)
- **description**: Brief description of the agent's purpose
- **capabilities**: Array of capabilities the agent provides

## Output

Complete agent structure including:

- Agent class extending BaseAgent
- Zod schemas for LLM responses
- Memory system integration
- Tool registration
- Test scaffolding
- Documentation

## Implementation Steps

1. **Validate Input Parameters**
   - Check agent name format (kebab-case)
   - Validate agent type against known types
   - Ensure lifecycle stage is valid

2. **Generate Agent Class**
   - Create agent file in `packages/backend/src/lib/agent-fabric/agents/`
   - Extend BaseAgent with proper lifecycle and version
   - Implement required methods (execute, secureInvoke calls)
   - Add Zod schemas for LLM response validation

3. **Create Zod Schemas**
   - Generate input schema based on agent type
   - Create output schema with hallucination_check
   - Add proper TypeScript types

4. **Set Up Memory Integration**
   - Configure semantic memory for the agent
   - Set up episodic memory for session tracking
   - Add tenant isolation (organizationId filtering)

5. **Register Tools and Capabilities**
   - Register agent in ToolRegistry
   - Add to appropriate agent collections
   - Configure message bus integration

6. **Generate Test Scaffolding**
   - Create unit test file
   - Set up mock infrastructure
   - Add integration test patterns

7. **Create Documentation**
   - Generate agent documentation
   - Add usage examples
   - Document configuration options

## Example Usage

```bash
# Create a new opportunity analysis agent
/agent-scaffold --agentName="opportunity-analyzer" --agentType="opportunity" --lifecycleStage="discovery" --description="Analyzes sales opportunities and generates value hypotheses" --capabilities=["opportunity-analysis","value-hypothesis-generation"]

# Create a financial modeling agent
/agent-scaffold --agentName="financial-modeler" --agentType="financial" --lifecycleStage="modeling" --description="Creates detailed financial models for value cases" --capabilities=["roi-calculation","financial-projection","risk-analysis"]
```

## Generated File Structure

```
packages/backend/src/lib/agent-fabric/agents/
├── {AgentName}Agent.ts              # Main agent class
├── {AgentName}Agent.test.ts         # Unit tests
├── {AgentName}Agent.integration.test.ts # Integration tests
└── schemas/
    └── {AgentName}Schemas.ts        # Zod schemas and types
```

## Integration Points

- **Agent Registry**: Automatically registers agent
- **Tool Registry**: Adds agent capabilities
- **Message Bus**: Configures inter-agent communication
- **Memory System**: Sets up tenant-isolated memory
- **Audit System**: Configures audit logging

## Error Handling

- Validates all input parameters
- Checks for existing agent names
- Verifies file system permissions
- Provides detailed error messages with fixes

## Best Practices Enforced

- Uses secureInvoke for all LLM calls
- Implements proper tenant isolation
- Includes hallucination detection
- Follows agent naming conventions
- Includes comprehensive error handling
- Provides proper TypeScript types
