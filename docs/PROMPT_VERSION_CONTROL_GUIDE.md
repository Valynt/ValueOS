# Prompt Version Control Guide

## Overview

The Prompt Version Control system enables systematic management, testing, and optimization of LLM prompts through versioning, A/B testing, and performance tracking.

## Key Features

- **Versioning**: Track changes to prompts over time
- **A/B Testing**: Compare prompt variants with real users
- **Performance Metrics**: Track latency, cost, success rate, and user satisfaction
- **Template Variables**: Reusable prompts with dynamic content
- **Rollback**: Easily revert to previous versions

## Quick Start

### 1. Create a Prompt Version

```typescript
import { promptVersionControl } from './services/PromptVersionControl';

const version = await promptVersionControl.createVersion({
  promptKey: 'canvas.generate',
  template: `Generate a business model canvas for:
  
Business: {{businessDescription}}
Industry: {{industry}}

Provide detailed sections for all 9 components.`,
  variables: ['businessDescription', 'industry'],
  metadata: {
    author: 'john@example.com',
    description: 'Improved canvas generation with industry focus',
    tags: ['canvas', 'generation', 'v2'],
    model: 'meta-llama/Llama-3-70b-chat-hf',
    temperature: 0.7,
    maxTokens: 1000
  }
});

console.log(`Created version ${version.version}`);
```

### 2. Execute a Prompt

```typescript
const { prompt, version, executionId } = await promptVersionControl.executePrompt(
  'canvas.generate',
  {
    businessDescription: 'A SaaS platform for project management',
    industry: 'Technology'
  },
  userId
);

// Use prompt with LLM
const response = await llmFallback.processRequest({
  prompt,
  model: version.metadata.model,
  userId
});

// Record results
await promptVersionControl.recordExecution(executionId, {
  response: response.content,
  latency: response.latency,
  cost: response.cost,
  tokens: {
    prompt: response.promptTokens,
    completion: response.completionTokens,
    total: response.totalTokens
  },
  success: true
});
```

### 3. Activate a Version

```typescript
// Activate version 2
await promptVersionControl.activateVersion('canvas.generate', 2);

// Now all executions will use version 2
```

## Versioning

### Version Lifecycle

```
draft → testing → active → deprecated
```

- **draft**: Initial creation, not used in production
- **testing**: Being evaluated (e.g., in A/B test)
- **active**: Currently used in production
- **deprecated**: Replaced by newer version

### List Versions

```typescript
const versions = await promptVersionControl.listVersions('canvas.generate');

versions.forEach(v => {
  console.log(`Version ${v.version}: ${v.status}`);
  console.log(`Performance:`, v.performance);
});
```

### Compare Versions

```typescript
const comparison = await promptVersionControl.compareVersions(
  'canvas.generate',
  [1, 2, 3]
);

comparison.forEach(v => {
  console.log(`Version ${v.version}:`);
  console.log(`  Avg Latency: ${v.performance.avgLatency}ms`);
  console.log(`  Avg Cost: $${v.performance.avgCost}`);
  console.log(`  Success Rate: ${v.performance.successRate * 100}%`);
  console.log(`  User Satisfaction: ${v.performance.userSatisfaction}/5`);
});
```

## Template Variables

### Basic Variables

```typescript
const template = `
Generate a {{documentType}} for {{companyName}}.

Focus on: {{focus}}
`;

const rendered = promptVersionControl.renderPrompt(template, {
  documentType: 'business plan',
  companyName: 'Acme Corp',
  focus: 'market analysis'
});
```

### Conditional Content

```typescript
const template = `
Generate a business model canvas.

{{#if includeFinancials}}
Include detailed financial projections.
{{/if}}

{{#if targetMarket}}
Target Market: {{targetMarket}}
{{/if}}
`;
```

### Lists

```typescript
const template = `
Analyze the following competitors:
{{#each competitors}}
- {{this}}
{{/each}}
`;
```

## A/B Testing

### Create A/B Test

```typescript
// Create two versions
const versionA = await promptVersionControl.createVersion({
  promptKey: 'canvas.generate',
  template: 'Template A...',
  // ...
});

const versionB = await promptVersionControl.createVersion({
  promptKey: 'canvas.generate',
  template: 'Template B...',
  // ...
});

// Create A/B test
const test = await promptVersionControl.createABTest({
  name: 'Canvas Generation: Detailed vs Concise',
  promptKey: 'canvas.generate',
  variants: [
    { name: 'Detailed', versionId: versionA.id, weight: 50 },
    { name: 'Concise', versionId: versionB.id, weight: 50 }
  ]
});

// Start test
await promptVersionControl.startABTest(test.id);
```

### Execute with A/B Test

```typescript
const { prompt, version } = await promptVersionControl.executePrompt(
  'canvas.generate',
  variables,
  userId,
  { abTestId: test.id }
);

// User is automatically assigned to a variant
// Assignment is deterministic based on userId
```

### Get Results

```typescript
const results = await promptVersionControl.getABTestResults(test.id);

results.forEach(r => {
  console.log(`Variant: ${r.variant}`);
  console.log(`  Executions: ${r.executions}`);
  console.log(`  Avg Latency: ${r.avgLatency}ms`);
  console.log(`  Avg Cost: $${r.avgCost}`);
  console.log(`  Success Rate: ${r.successRate * 100}%`);
  console.log(`  User Satisfaction: ${r.userSatisfaction}/5`);
});
```

### Complete Test

```typescript
// Select winner and activate
await promptVersionControl.completeABTest(test.id, 'Detailed');

// Winner is automatically activated
```

## Performance Tracking

### Automatic Metrics

Metrics are automatically calculated from executions:

- **avgLatency**: Average response time (ms)
- **avgCost**: Average cost per execution (USD)
- **avgTokens**: Average tokens used
- **successRate**: Percentage of successful executions
- **userSatisfaction**: Average user rating (1-5)

### User Feedback

```typescript
// After showing response to user
await promptVersionControl.addFeedback(executionId, {
  rating: 4,
  comment: 'Good suggestions but could be more specific'
});
```

### Query Performance

```sql
-- Get best performing versions
SELECT 
  prompt_key,
  version,
  (performance->>'avgLatency')::NUMERIC as avg_latency,
  (performance->>'avgCost')::NUMERIC as avg_cost,
  (performance->>'successRate')::NUMERIC as success_rate,
  (performance->>'userSatisfaction')::NUMERIC as user_satisfaction
FROM prompt_versions
WHERE status = 'active'
ORDER BY user_satisfaction DESC;

-- Get execution history
SELECT 
  pv.prompt_key,
  pv.version,
  pe.created_at,
  pe.latency,
  pe.cost,
  pe.success,
  pe.feedback
FROM prompt_executions pe
JOIN prompt_versions pv ON pe.prompt_version_id = pv.id
WHERE pe.user_id = 'user-id'
ORDER BY pe.created_at DESC
LIMIT 100;
```

## Best Practices

### 1. Semantic Versioning

Use meaningful version descriptions:

```typescript
// Good
metadata: {
  description: 'Added industry-specific examples',
  tags: ['canvas', 'generation', 'industry-focus']
}

// Bad
metadata: {
  description: 'Updated prompt',
  tags: ['update']
}
```

### 2. Test Before Activating

```typescript
// Create as draft
const version = await promptVersionControl.createVersion({
  // ...
  status: 'draft'
});

// Test manually
const { prompt } = await promptVersionControl.executePrompt(
  'canvas.generate',
  testVariables,
  'test-user',
  { version: version.version }
);

// Activate when ready
await promptVersionControl.activateVersion('canvas.generate', version.version);
```

### 3. Use A/B Tests for Major Changes

```typescript
// For incremental improvements, just activate
await promptVersionControl.activateVersion('canvas.generate', 2);

// For major changes, run A/B test
const test = await promptVersionControl.createABTest({
  name: 'Major Rewrite',
  promptKey: 'canvas.generate',
  variants: [
    { name: 'Current', versionId: currentVersion.id, weight: 50 },
    { name: 'New', versionId: newVersion.id, weight: 50 }
  ]
});
```

### 4. Monitor Performance

```typescript
// Set up alerts for performance degradation
const version = await promptVersionControl.getActiveVersion('canvas.generate');

if (version.performance.successRate < 0.9) {
  console.error('Success rate below 90%!');
  // Consider rolling back
}

if (version.performance.avgCost > 0.01) {
  console.warn('Average cost above $0.01');
  // Consider optimizing
}
```

### 5. Document Changes

```typescript
const version = await promptVersionControl.createVersion({
  promptKey: 'canvas.generate',
  template: newTemplate,
  variables: ['businessDescription', 'industry', 'targetMarket'],
  metadata: {
    author: 'john@example.com',
    description: `
      Changes:
      - Added targetMarket variable
      - Improved structure for better JSON parsing
      - Reduced token usage by 20%
      
      Rationale:
      - Users requested more targeted suggestions
      - Previous version had parsing issues
      - Cost optimization
    `,
    tags: ['canvas', 'generation', 'v3', 'cost-optimized']
  }
});
```

## API Reference

### PromptVersionControlService

#### createVersion(data)

Create a new prompt version.

**Parameters**:
- `promptKey` (string): Unique identifier for the prompt
- `template` (string): Prompt template with variables
- `variables` (string[]): List of variable names
- `metadata` (object): Version metadata

**Returns**: `Promise<PromptVersion>`

#### getActiveVersion(promptKey)

Get the currently active version.

**Parameters**:
- `promptKey` (string): Prompt identifier

**Returns**: `Promise<PromptVersion | null>`

#### executePrompt(promptKey, variables, userId, options?)

Execute a prompt with variables.

**Parameters**:
- `promptKey` (string): Prompt identifier
- `variables` (object): Variable values
- `userId` (string): User identifier
- `options` (object, optional):
  - `version` (number): Specific version to use
  - `abTestId` (string): A/B test to participate in

**Returns**: `Promise<{prompt, version, executionId}>`

#### recordExecution(executionId, results)

Record execution results.

**Parameters**:
- `executionId` (string): Execution identifier
- `results` (object): Execution results

**Returns**: `Promise<void>`

#### addFeedback(executionId, feedback)

Add user feedback.

**Parameters**:
- `executionId` (string): Execution identifier
- `feedback` (object): User feedback

**Returns**: `Promise<void>`

#### createABTest(data)

Create an A/B test.

**Parameters**:
- `name` (string): Test name
- `promptKey` (string): Prompt identifier
- `variants` (array): Test variants

**Returns**: `Promise<ABTest>`

#### getABTestResults(testId)

Get A/B test results.

**Parameters**:
- `testId` (string): Test identifier

**Returns**: `Promise<ABTest['results']>`

## Examples

### Example 1: Canvas Generation

```typescript
// Create optimized version
const version = await promptVersionControl.createVersion({
  promptKey: 'canvas.generate',
  template: `You are a business strategy expert. Generate a comprehensive business model canvas.

Business: {{businessDescription}}
Industry: {{industry}}
Target: {{targetMarket}}

Provide JSON with these keys: keyPartners, keyActivities, valuePropositions, customerRelationships, customerSegments, keyResources, channels, costStructure, revenueStreams.

Be specific and actionable.`,
  variables: ['businessDescription', 'industry', 'targetMarket'],
  metadata: {
    author: 'strategy-team@example.com',
    description: 'Optimized for specificity and JSON output',
    tags: ['canvas', 'generation', 'optimized'],
    model: 'meta-llama/Llama-3-70b-chat-hf',
    temperature: 0.7,
    maxTokens: 1000
  }
});

// Activate
await promptVersionControl.activateVersion('canvas.generate', version.version);
```

### Example 2: A/B Test for Tone

```typescript
// Version A: Professional tone
const versionA = await promptVersionControl.createVersion({
  promptKey: 'canvas.refine',
  template: 'Analyze the following business model canvas section and provide professional recommendations...',
  // ...
});

// Version B: Conversational tone
const versionB = await promptVersionControl.createVersion({
  promptKey: 'canvas.refine',
  template: 'Let\'s improve this part of your business model canvas! Here are some friendly suggestions...',
  // ...
});

// Test
const test = await promptVersionControl.createABTest({
  name: 'Tone: Professional vs Conversational',
  promptKey: 'canvas.refine',
  variants: [
    { name: 'Professional', versionId: versionA.id, weight: 50 },
    { name: 'Conversational', versionId: versionB.id, weight: 50 }
  ]
});

await promptVersionControl.startABTest(test.id);

// Run for 1 week, then check results
const results = await promptVersionControl.getABTestResults(test.id);

// Select winner based on user satisfaction
const winner = results.reduce((a, b) => 
  a.userSatisfaction > b.userSatisfaction ? a : b
);

await promptVersionControl.completeABTest(test.id, winner.variant);
```

## Troubleshooting

### Unresolved Variables

```typescript
// Check for missing variables
const template = 'Hello {{name}}, your {{item}} is ready.';
const rendered = promptVersionControl.renderPrompt(template, { name: 'John' });
// Warning: Unresolved variables: {{item}}
```

### Performance Degradation

```sql
-- Find slow versions
SELECT 
  prompt_key,
  version,
  (performance->>'avgLatency')::NUMERIC as avg_latency
FROM prompt_versions
WHERE (performance->>'avgLatency')::NUMERIC > 5000
ORDER BY avg_latency DESC;
```

### Low Success Rate

```sql
-- Find failing versions
SELECT 
  prompt_key,
  version,
  (performance->>'successRate')::NUMERIC as success_rate
FROM prompt_versions
WHERE (performance->>'successRate')::NUMERIC < 0.9
ORDER BY success_rate ASC;
```

## Support

For issues or questions:
- Documentation: This file
- Slack: #llm-optimization
- Email: llm-team@valuecanvas.com
