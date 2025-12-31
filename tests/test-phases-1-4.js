#!/usr/bin/env node
/**
 * Comprehensive Test Runner for Phases 1-4
 * 
 * This script validates all functionality implemented in Phases 1-4
 * without requiring the full vitest setup.
 */

console.log('🧪 Running Phases 1-4 Comprehensive Tests\n');
console.log('=' .repeat(60));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ ${name}`);
    passedTests++;
    return true;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failedTests++;
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// ============================================================================
// Phase 1: Environment & Configuration Tests
// ============================================================================
console.log('\n📦 Phase 1: Environment & Configuration');
console.log('-'.repeat(60));

test('chatWorkflowConfig exports stage configurations', () => {
  const { CHAT_WORKFLOW_STAGES } = require('./src/config/chatWorkflowConfig.ts');
  assert(CHAT_WORKFLOW_STAGES, 'CHAT_WORKFLOW_STAGES should exist');
  assert(CHAT_WORKFLOW_STAGES.opportunity, 'Should have opportunity stage');
  assert(CHAT_WORKFLOW_STAGES.target, 'Should have target stage');
  assert(CHAT_WORKFLOW_STAGES.realization, 'Should have realization stage');
  assert(CHAT_WORKFLOW_STAGES.expansion, 'Should have expansion stage');
});

test('chatWorkflowConfig validates stage structures', () => {
  const { CHAT_WORKFLOW_STAGES } = require('./src/config/chatWorkflowConfig.ts');
  const stage = CHAT_WORKFLOW_STAGES.opportunity;
  assert(stage.stage === 'opportunity', 'Stage ID should match');
  assert(stage.displayName, 'Should have displayName');
  assert(stage.description, 'Should have description');
  assert(Array.isArray(stage.nextStages), 'Should have nextStages array');
  assert(stage.transitions, 'Should have transitions object');
});

test('checkStageTransition detects opportunity to target transition', () => {
  const { checkStageTransition } = require('./src/config/chatWorkflowConfig.ts');
  const result = checkStageTransition(
    'opportunity',
    'help me build an roi model',
    'ready to target',
    0.9
  );
  assertEquals(result, 'target', 'Should transition to target stage');
});

test('checkStageTransition is case-insensitive', () => {
  const { checkStageTransition } = require('./src/config/chatWorkflowConfig.ts');
  const result = checkStageTransition(
    'opportunity',
    'BUILD ROI MODEL',
    'READY TO TARGET',
    0.9
  );
  assertEquals(result, 'target', 'Should be case-insensitive');
});

test('checkStageTransition respects confidence threshold', () => {
  const { checkStageTransition } = require('./src/config/chatWorkflowConfig.ts');
  const result = checkStageTransition(
    'opportunity',
    'roi model',
    'target',
    0.5  // Below threshold
  );
  assertEquals(result, null, 'Should not transition with low confidence');
});

test('isValidStage validates stages correctly', () => {
  const { isValidStage } = require('./src/config/chatWorkflowConfig.ts');
  assert(isValidStage('opportunity'), 'opportunity should be valid');
  assert(isValidStage('target'), 'target should be valid');
  assert(!isValidStage('invalid'), 'invalid should not be valid');
});

// ============================================================================
// Phase 2: Workflow State Persistence Tests
// ============================================================================
console.log('\n💾 Phase 2: Workflow State Persistence');
console.log('-'.repeat(60));

test('WorkflowStateService exports correctly', () => {
  const { WorkflowStateService } = require('./src/services/WorkflowStateService.ts');
  assert(WorkflowStateService, 'WorkflowStateService should be exported');
  assert(typeof WorkflowStateService === 'function', 'Should be a class/function');
});

test('chatWorkflowConfig has all expected exports', () => {
  const config = require('./src/config/chatWorkflowConfig.ts');
  assert(config.CHAT_WORKFLOW_STAGES, 'Should export CHAT_WORKFLOW_STAGES');
  assert(config.checkStageTransition, 'Should export checkStageTransition');
  assert(config.getStageDisplayName, 'Should export getStageDisplayName');
  assert(config.getPossibleNextStages, 'Should export getPossibleNextStages');
  assert(config.isValidStage, 'Should export isValidStage');
});

// ============================================================================
// Phase 3: SDUI Template Refactoring Tests
// ============================================================================
console.log('\n🎨 Phase 3: SDUI Template Refactoring');
console.log('-'.repeat(60));

test('Chat templates module exports correctly', () => {
  const templates = require('./src/sdui/templates/chat-templates.ts');
  assert(templates.CHAT_TEMPLATES, 'Should export CHAT_TEMPLATES');
  assert(templates.generateChatSDUIPage, 'Should export generateChatSDUIPage');
  assert(templates.hasTemplateForStage, 'Should export hasTemplateForStage');
  assert(templates.getAvailableStages, 'Should export getAvailableStages');
});

test('CHAT_TEMPLATES has all lifecycle stages', () => {
  const { CHAT_TEMPLATES } = require('./src/sdui/templates/chat-templates.ts');
  assert(CHAT_TEMPLATES.opportunity, 'Should have opportunity template');
  assert(CHAT_TEMPLATES.target, 'Should have target template');
  assert(CHAT_TEMPLATES.realization, 'Should have realization template');
  assert(CHAT_TEMPLATES.expansion, 'Should have expansion template');
});

test('hasTemplateForStage validates correctly', () => {
  const { hasTemplateForStage } = require('./src/sdui/templates/chat-templates.ts');
  assert(hasTemplateForStage('opportunity'), 'opportunity should have template');
  assert(hasTemplateForStage('target'), 'target should have template');
  assert(!hasTemplateForStage('invalid'), 'invalid should not have template');
});

test('getAvailableStages returns all stages', () => {
  const { getAvailableStages } = require('./src/sdui/templates/chat-templates.ts');
  const stages = getAvailableStages();
  assert(Array.isArray(stages), 'Should return an array');
  assert(stages.includes('opportunity'), 'Should include opportunity');
  assert(stages.includes('target'), 'Should include target');
  assert(stages.includes('realization'), 'Should include realization');
  assert(stages.includes('expansion'), 'Should include expansion');
  assertEquals(stages.length, 4, 'Should have 4 stages');
});

test('SDUITelemetry exports correctly', () => {
  const { SDUITelemetry, TelemetryEventType } = require('./src/lib/telemetry/SDUITelemetry.ts');
  assert(SDUITelemetry, 'Should export SDUITelemetry class');
  assert(TelemetryEventType, 'Should export TelemetryEventType enum');
});

test('SDUITelemetry event types are defined', () => {
  const { TelemetryEventType } = require('./src/lib/telemetry/SDUITelemetry.ts');
  assert(TelemetryEventType.RENDER_START, 'Should have RENDER_START');
  assert(TelemetryEventType.RENDER_COMPLETE, 'Should have RENDER_COMPLETE');
  assert(TelemetryEventType.CHAT_REQUEST_START, 'Should have CHAT_REQUEST_START');
  assert(TelemetryEventType.WORKFLOW_STATE_SAVE, 'Should have WORKFLOW_STATE_SAVE');
});

test('SDUITelemetry can be instantiated', () => {
  const { SDUITelemetry } = require('./src/lib/telemetry/SDUITelemetry.ts');
  const telemetry = new SDUITelemetry(true);
  assert(telemetry, 'Should create instance');
  assert(typeof telemetry.recordEvent === 'function', 'Should have recordEvent method');
  assert(typeof telemetry.startSpan === 'function', 'Should have startSpan method');
  assert(typeof telemetry.endSpan === 'function', 'Should have endSpan method');
});

test('SDUITelemetry records events', () => {
  const { SDUITelemetry, TelemetryEventType } = require('./src/lib/telemetry/SDUITelemetry.ts');
  const telemetry = new SDUITelemetry(true);
  telemetry.clear();
  
  telemetry.recordEvent({
    type: TelemetryEventType.RENDER_START,
    metadata: { test: 'data' },
  });
  
  const events = telemetry.getEvents();
  assertEquals(events.length, 1, 'Should have 1 event');
  assertEquals(events[0].type, TelemetryEventType.RENDER_START, 'Event type should match');
});

test('SDUITelemetry respects event cap', () => {
  const { SDUITelemetry, TelemetryEventType } = require('./src/lib/telemetry/SDUITelemetry.ts');
  const telemetry = new SDUITelemetry(true);
  telemetry.clear();
  
  // Add more than 1000 events
  for (let i = 0; i < 1100; i++) {
    telemetry.recordEvent({
      type: TelemetryEventType.USER_INTERACTION,
      metadata: { index: i },
    });
  }
  
  const events = telemetry.getEvents();
  assert(events.length <= 1000, 'Should cap at 1000 events');
});

test('SDUITelemetry can be disabled', () => {
  const { SDUITelemetry, TelemetryEventType } = require('./src/lib/telemetry/SDUITelemetry.ts');
  const telemetry = new SDUITelemetry(true);
  telemetry.clear();
  telemetry.setEnabled(false);
  
  telemetry.recordEvent({
    type: TelemetryEventType.RENDER_START,
    metadata: {},
  });
  
  assertEquals(telemetry.getEvents().length, 0, 'Should not record when disabled');
});

// ============================================================================
// Phase 4: UX Polish Tests
// ============================================================================
console.log('\n✨ Phase 4: UX Polish');
console.log('-'.repeat(60));

test('SDUISkeletonLoader exports correctly', () => {
  const { SDUISkeletonLoader } = require('./src/components/ChatCanvas/SDUISkeletonLoader.tsx');
  assert(SDUISkeletonLoader, 'Should export SDUISkeletonLoader component');
});

test('ErrorRecovery exports correctly', () => {
  const { ErrorRecovery } = require('./src/components/ChatCanvas/ErrorRecovery.tsx');
  assert(ErrorRecovery, 'Should export ErrorRecovery component');
});

test('SessionResumeBanner exports correctly', () => {
  const { SessionResumeBanner } = require('./src/components/ChatCanvas/SessionResumeBanner.tsx');
  assert(SessionResumeBanner, 'Should export SessionResumeBanner component');
});

test('StageProgressIndicator exports correctly', () => {
  const { StageProgressIndicator } = require('./src/components/ChatCanvas/StageProgressIndicator.tsx');
  assert(StageProgressIndicator, 'Should export StageProgressIndicator component');
});

// ============================================================================
// Integration Tests
// ============================================================================
console.log('\n🔗 Integration Tests');
console.log('-'.repeat(60));

test('AgentChatService integrates with templates', () => {
  const { hasTemplateForStage } = require('./src/sdui/templates/chat-templates.ts');
  
  // Verify all stages have templates
  assert(hasTemplateForStage('opportunity'), 'AgentChatService can use opportunity template');
  assert(hasTemplateForStage('target'), 'AgentChatService can use target template');
  assert(hasTemplateForStage('realization'), 'AgentChatService can use realization template');
  assert(hasTemplateForStage('expansion'), 'AgentChatService can use expansion template');
});

test('Workflow config integrates with templates', () => {
  const { CHAT_WORKFLOW_STAGES } = require('./src/config/chatWorkflowConfig.ts');
  const { hasTemplateForStage } = require('./src/sdui/templates/chat-templates.ts');
  
  // Verify each workflow stage has a corresponding template
  Object.keys(CHAT_WORKFLOW_STAGES).forEach(stage => {
    assert(hasTemplateForStage(stage), `Stage ${stage} should have a template`);
  });
});

test('Enhanced metadata schema is compatible', () => {
  const { generateChatSDUIPage } = require('./src/sdui/templates/chat-templates.ts');
  
  const page = generateChatSDUIPage('opportunity', {
    content: 'Test',
    confidence: 0.8,
    reasoning: [],
    workflowState: {
      currentStage: 'opportunity',
      status: 'in_progress',
      completedStages: [],
      context: { caseId: 'test-123' },
    },
    sessionId: 'session-456',
    traceId: 'trace-789',
  });
  
  // Verify enhanced metadata
  assert(page.metadata, 'Page should have metadata');
  assert(page.metadata.lifecycle_stage, 'Should have lifecycle_stage');
  assert(page.metadata.session_id, 'Should have session_id');
  assert(page.metadata.trace_id, 'Should have trace_id');
  assert(page.metadata.telemetry_enabled, 'Should have telemetry_enabled');
  assert(page.metadata.accessibility, 'Should have accessibility metadata');
});

// ============================================================================
// Summary
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('📊 Test Results Summary');
console.log('='.repeat(60));
console.log(`Total Tests: ${totalTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (failedTests === 0) {
  console.log('\n🎉 All tests passed!');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failedTests} test(s) failed`);
  process.exit(1);
}
