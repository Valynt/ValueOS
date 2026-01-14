# Security Fixes for Production Quality Compliance

This plan addresses the critical and high-priority security issues identified in the ValueOS Production Quality Scorecard to achieve full compliance with .windsurfrules.md and Master System Map requirements.

## 🔴 Critical Fixes (Immediate)

### 1. Fix CallAnalysisService PII Bypass

**Issue**: Direct LLM calls without PII sanitization (lines 139-145)
**Risk**: High - PII leakage in sales call transcripts
**Files**: `/src/services/CallAnalysisService.ts`

**Changes Required**:

- Replace `this.llm.complete()` with `secureLLMComplete()`
- Add `sanitizeForLogging()` for transcript content
- Import required security modules
- Add proper tenant context and audit logging

### 2. Implement ResearchAgent BaseAgent Inheritance

**Issue**: Empty ResearchAgent file doesn't extend BaseAgent
**Risk**: Medium - Breaks agent inheritance compliance
**Files**: `/src/lib/agent-fabric/agents/ResearchAgent.ts`

**Changes Required**:

- Create proper ResearchAgent class extending BaseAgent
- Implement required abstract methods (execute, lifecycleStage, etc.)
- Add SecureMessageBus registration
- Include PII sanitization for LLM calls

## 🟡 High Priority Fixes (This Sprint)

### 3. Extend SecureMessageBus to All Services

**Issue**: Services use EventEmitter/.send() bypassing SecureMessageBus
**Risk**: Medium - Inconsistent security coverage
**Files**: Multiple service files using EventEmitter patterns

**Services to Fix**:

- WorkflowEventListener (EventEmitter)
- MessageQueue (direct messaging)
- RealtimeUpdateService (WebSocket)
- AgentPrefetchService (event patterns)

**Changes Required**:

- Create SecureMessageBus adapters for EventEmitter
- Replace direct .send() calls with sendToAgent()
- Add message signing and encryption
- Implement audit logging for all service communication

### 4. Create External API Adapters

**Issue**: Direct fetch/axios calls bypass security controls
**Risk**: Medium - External calls lack audit trail
**Files**: 50+ files with external API calls

**Key Integration Points**:

- AWS SDK calls (secrets, S3, etc.)
- CRM adapters (Salesforce, HubSpot)
- Ground truth APIs (EDGAR, XBRL)
- Authentication services

**Changes Required**:

- Create ExternalAPIAdapter class wrapping SecureMessageBus
- Replace direct fetch calls with adapter methods
- Add tenant isolation and budget tracking
- Implement circuit breaker for external dependencies

## 🟢 Medium Priority (Next Sprint)

### 5. EventEmitter Bridge

**Issue**: Legacy Node.js EventEmitter patterns
**Files**: SecretRotationScheduler, SecretVolumeWatcher
**Solution**: Create EventEmitterSecureBridge wrapper

### 6. Port Conflict Documentation

**Issue**: Grafana port 3000 conflicts with backend port 3001
**Files**: Update documentation and port mapping guides

## Implementation Order

1. **CallAnalysisService** - Fix immediate PII security vulnerability
2. **ResearchAgent** - Complete agent inheritance compliance
3. **SecureMessageBus Service Integration** - Extend security coverage
4. **External API Adapters** - Comprehensive external call security
5. **EventEmitter Bridge** - Legacy system integration
6. **Documentation Updates** - Port mapping clarity

## Testing Requirements

- Security tests for PII masking at all LLM entry points
- Integration tests for SecureMessageBus service communication
- External API adapter tests with circuit breaker validation
- Agent inheritance compliance tests
- End-to-end security audit verification

## Success Metrics

- 100% agent inheritance compliance (15/15 agents)
- 100% PII masking at LLM entry points
- 95%+ service communication via SecureMessageBus
- 100% external API calls through secure adapters
- Zero security vulnerabilities in production scan

## Dependencies

- BaseAgent class (already compliant)
- SecureMessageBus implementation (already complete)
- piiFilter.ts (already comprehensive)
- secureLLMWrapper.ts (already available)
- Port configuration (already consistent)
