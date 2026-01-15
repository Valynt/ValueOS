/**
 * Mock Agent Stream Generator
 * 
 * Generates realistic agent event sequences for UI development.
 * Simulates the full agent workflow: clarify → plan → execute → review.
 */

import type {
  AgentEvent,
  AgentPhase,
  Artifact,
  PlanStep,
  PlanAssumption,
  ClarifyOption,
} from './types';

// Utility to generate unique IDs
const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// Delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Event emitter type
type EventCallback = (event: AgentEvent) => void;

/**
 * Mock stream configuration
 */
export interface MockStreamConfig {
  /** Delay between events in ms */
  eventDelay?: number;
  /** Whether to include clarification step */
  includeClarify?: boolean;
  /** Company name for the analysis */
  companyName?: string;
  /** Simulate errors */
  simulateError?: boolean;
}

const defaultConfig: MockStreamConfig = {
  eventDelay: 300,
  includeClarify: true,
  companyName: 'Acme Corp',
  simulateError: false,
};

/**
 * Create a phase change event
 */
function createPhaseEvent(runId: string, from: AgentPhase, to: AgentPhase, reason?: string): AgentEvent {
  return {
    id: generateId(),
    type: 'phase_changed',
    timestamp: Date.now(),
    runId,
    payload: { from, to, reason },
  };
}

/**
 * Create a message delta event (for streaming text)
 */
function createMessageDelta(runId: string, messageId: string, delta: string, done: boolean): AgentEvent {
  return {
    id: generateId(),
    type: 'message_delta',
    timestamp: Date.now(),
    runId,
    payload: { messageId, delta, done },
  };
}

/**
 * Stream text character by character
 */
async function streamText(
  runId: string,
  text: string,
  onEvent: EventCallback,
  charDelay = 20
): Promise<string> {
  const messageId = generateId();
  const words = text.split(' ');
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i] + (i < words.length - 1 ? ' ' : '');
    onEvent(createMessageDelta(runId, messageId, word, false));
    await delay(charDelay * 2);
  }
  
  onEvent(createMessageDelta(runId, messageId, '', true));
  return messageId;
}

/**
 * Generate clarification question
 */
function createClarifyQuestion(
  runId: string,
  question: string,
  options: ClarifyOption[]
): AgentEvent {
  return {
    id: generateId(),
    type: 'clarify_question',
    timestamp: Date.now(),
    runId,
    payload: {
      questionId: generateId(),
      question,
      options,
      defaultOption: options[1]?.id, // Usually middle option
      allowFreeform: true,
    },
  };
}

/**
 * Generate plan proposal
 */
function createPlanProposal(
  runId: string,
  companyName: string
): AgentEvent {
  const steps: PlanStep[] = [
    { id: 'step_1', label: 'Research company financials', description: 'Analyze 10-K, earnings reports', estimatedDuration: 5000 },
    { id: 'step_2', label: 'Identify value drivers', description: 'Map pain points to solutions', estimatedDuration: 4000 },
    { id: 'step_3', label: 'Calculate ROI projections', description: 'Build 3-year financial model', estimatedDuration: 6000 },
    { id: 'step_4', label: 'Generate executive summary', description: 'Create buyer-ready narrative', estimatedDuration: 3000 },
  ];

  const assumptions: PlanAssumption[] = [
    { id: 'asm_1', label: 'Employee Count', value: 2400, editable: true, source: '10-K Filing' },
    { id: 'asm_2', label: 'Annual Revenue', value: '$340M', editable: true, source: '10-K Filing' },
    { id: 'asm_3', label: 'Industry', value: 'Enterprise SaaS', editable: true },
    { id: 'asm_4', label: 'Efficiency Target', value: '15%', editable: true },
  ];

  return {
    id: generateId(),
    type: 'plan_proposed',
    timestamp: Date.now(),
    runId,
    payload: {
      planId: generateId(),
      steps,
      estimatedDuration: steps.reduce((sum, s) => sum + (s.estimatedDuration || 0), 0),
      assumptions,
    },
  };
}

/**
 * Generate tool events for a step
 */
async function executeStep(
  runId: string,
  stepId: string,
  stepName: string,
  duration: number,
  onEvent: EventCallback
): Promise<void> {
  // Tool started
  onEvent({
    id: generateId(),
    type: 'tool_started',
    timestamp: Date.now(),
    runId,
    payload: {
      toolName: stepName,
      toolId: stepId,
      description: `Executing: ${stepName}`,
      estimatedDuration: duration,
    },
  });

  // Simulate work
  await delay(duration);

  // Tool finished
  onEvent({
    id: generateId(),
    type: 'tool_finished',
    timestamp: Date.now(),
    runId,
    payload: {
      toolId: stepId,
      toolName: stepName,
      status: 'success',
      duration,
    },
  });

  // Create checkpoint
  onEvent({
    id: generateId(),
    type: 'checkpoint_created',
    timestamp: Date.now(),
    runId,
    payload: {
      checkpointId: generateId(),
      label: `Completed: ${stepName}`,
      progress: 100,
      canRestore: true,
    },
  });
}

/**
 * Generate a value model artifact
 */
function createValueModelArtifact(runId: string, companyName: string): Artifact {
  return {
    id: generateId(),
    type: 'value_model',
    title: `${companyName} Value Model`,
    status: 'proposed',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    content: {
      kind: 'json',
      data: {
        company: companyName,
        valueDrivers: [
          { name: 'Sales Efficiency', impact: 1800000, confidence: 0.85 },
          { name: 'Reduced Churn', impact: 920000, confidence: 0.78 },
          { name: 'Faster Onboarding', impact: 450000, confidence: 0.92 },
        ],
        totalValue: 3170000,
        timeHorizon: '3 years',
      },
    },
    source: { agentRunId: runId },
  };
}

/**
 * Generate a financial projection artifact
 */
function createFinancialArtifact(runId: string, companyName: string): Artifact {
  return {
    id: generateId(),
    type: 'financial_projection',
    title: `${companyName} ROI Projection`,
    status: 'proposed',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    content: {
      kind: 'chart',
      chartType: 'bar',
      data: [
        { label: 'Year 1', value: 1.8, category: 'Projected Value ($M)' },
        { label: 'Year 2', value: 2.4, category: 'Projected Value ($M)' },
        { label: 'Year 3', value: 3.2, category: 'Projected Value ($M)' },
      ],
      config: {
        metrics: {
          roi: 287,
          npv: 4100000,
          paybackMonths: 7.2,
          irr: 0.42,
        },
      },
    },
    source: { agentRunId: runId },
  };
}

/**
 * Generate an executive summary artifact
 */
function createSummaryArtifact(runId: string, companyName: string): Artifact {
  return {
    id: generateId(),
    type: 'executive_summary',
    title: `${companyName} Executive Summary`,
    status: 'proposed',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    content: {
      kind: 'markdown',
      markdown: `# Value Proposition for ${companyName}

## Executive Summary

Based on our analysis of ${companyName}'s operations and industry benchmarks, we project a **$7.4M total value** over 3 years with a **287% ROI**.

### Key Value Drivers

1. **Sales Efficiency (+15%)** - $1.8M annual impact
   - Reduced time-to-quote by 40%
   - Improved win rates through data-driven proposals

2. **Customer Retention** - $920K annual impact
   - Proactive value tracking reduces churn
   - QBR automation improves CSM efficiency

3. **Faster Onboarding** - $450K annual impact
   - Standardized value frameworks
   - Reduced ramp time for new reps

### Financial Metrics

| Metric | Value |
|--------|-------|
| Total 3-Year Value | $7.4M |
| ROI | 287% |
| Payback Period | 7.2 months |
| NPV (10% discount) | $4.1M |

### Recommendation

Proceed with implementation. The conservative estimate shows positive ROI within 8 months.`,
    },
    source: { agentRunId: runId },
  };
}

/**
 * Main mock stream generator
 * 
 * Simulates a complete agent workflow for building a value case.
 */
export async function generateMockAgentStream(
  userMessage: string,
  onEvent: EventCallback,
  config: MockStreamConfig = {}
): Promise<void> {
  const cfg = { ...defaultConfig, ...config };
  const runId = generateId();
  const { eventDelay, includeClarify, companyName } = cfg;

  try {
    // Phase: Idle → Processing
    onEvent(createPhaseEvent(runId, 'idle', 'clarify', 'Starting analysis'));
    await delay(eventDelay!);

    // Initial acknowledgment
    await streamText(
      runId,
      `I'll help you build a value case for ${companyName}. Let me gather some information first.`,
      onEvent
    );
    await delay(eventDelay!);

    // Clarification phase (optional)
    if (includeClarify) {
      await streamText(
        runId,
        `I found ${companyName}'s 10-K filing. They have approximately 2,400 employees and $340M in annual revenue. What efficiency target should I use for the model?`,
        onEvent
      );
      await delay(eventDelay!);

      onEvent(createClarifyQuestion(runId, 'Select efficiency target:', [
        { id: 'opt_1', label: '10% (Conservative)', value: '10', description: 'Lower risk, proven results' },
        { id: 'opt_2', label: '15% (Recommended)', value: '15', description: 'Industry standard for similar deployments' },
        { id: 'opt_3', label: '20% (Aggressive)', value: '20', description: 'Best-case scenario' },
      ]));

      // Wait for user response (in real app, this would pause)
      // For mock, we'll continue after a delay
      await delay(2000);
    }

    // Phase: Plan
    onEvent(createPhaseEvent(runId, 'clarify', 'plan', 'Preparing execution plan'));
    await delay(eventDelay!);

    await streamText(
      runId,
      `Great choice. Here's my plan to build the value case:`,
      onEvent
    );
    await delay(eventDelay!);

    onEvent(createPlanProposal(runId, companyName!));

    // Wait for plan approval (simulated)
    await delay(2000);

    // Phase: Execute
    onEvent(createPhaseEvent(runId, 'plan', 'execute', 'Executing plan'));
    await delay(eventDelay!);

    // Execute each step
    const steps = [
      { id: 'step_1', name: 'Research company financials', duration: 1500 },
      { id: 'step_2', name: 'Identify value drivers', duration: 1200 },
      { id: 'step_3', name: 'Calculate ROI projections', duration: 1800 },
      { id: 'step_4', name: 'Generate executive summary', duration: 1000 },
    ];

    for (const step of steps) {
      await executeStep(runId, step.id, step.name, step.duration, onEvent);
      await delay(eventDelay!);
    }

    // Phase: Review
    onEvent(createPhaseEvent(runId, 'execute', 'review', 'Presenting results'));
    await delay(eventDelay!);

    // Generate artifacts
    const valueModel = createValueModelArtifact(runId, companyName!);
    const financial = createFinancialArtifact(runId, companyName!);
    const summary = createSummaryArtifact(runId, companyName!);

    onEvent({
      id: generateId(),
      type: 'artifact_proposed',
      timestamp: Date.now(),
      runId,
      payload: { artifact: valueModel },
    });
    await delay(eventDelay!);

    onEvent({
      id: generateId(),
      type: 'artifact_proposed',
      timestamp: Date.now(),
      runId,
      payload: { artifact: financial },
    });
    await delay(eventDelay!);

    onEvent({
      id: generateId(),
      type: 'artifact_proposed',
      timestamp: Date.now(),
      runId,
      payload: { artifact: summary },
    });
    await delay(eventDelay!);

    // Final message
    await streamText(
      runId,
      `I've completed the analysis for ${companyName}. The projected 3-year ROI is **287%** with a payback period of **7.2 months**. You can review the value model, financial projections, and executive summary on the canvas. Would you like me to adjust any assumptions?`,
      onEvent
    );

    // Phase: Finalize
    onEvent(createPhaseEvent(runId, 'review', 'finalize', 'Ready for approval'));

  } catch (error) {
    onEvent({
      id: generateId(),
      type: 'error',
      timestamp: Date.now(),
      runId,
      payload: {
        code: 'STREAM_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        recoverable: true,
        suggestions: ['Try again', 'Provide more context'],
      },
    });
  }
}

/**
 * Quick mock for testing - generates a simple response
 */
export async function generateQuickMockResponse(
  userMessage: string,
  onEvent: EventCallback
): Promise<void> {
  const runId = generateId();
  
  onEvent(createPhaseEvent(runId, 'idle', 'execute', 'Processing'));
  
  await streamText(
    runId,
    `I understand you want to: "${userMessage}". Let me work on that for you...`,
    onEvent
  );
  
  await delay(500);
  
  await streamText(
    runId,
    `Based on my analysis, here are the key insights I found. Would you like me to elaborate on any specific area?`,
    onEvent
  );
  
  onEvent(createPhaseEvent(runId, 'execute', 'idle', 'Complete'));
}
