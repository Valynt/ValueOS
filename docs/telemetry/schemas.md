# Telemetry Schema Validation & Event Correctness

## Executive Summary

**Purpose**: Define comprehensive telemetry event schemas and validation rules for ValueOS observability system.

**Current State**: SDUITelemetry.ts and MetricsCollector.ts exist but lack schema validation
**Target**: Complete event correctness verification with JSON schemas
**Critical Need**: Ensure telemetry data integrity for monitoring and debugging

---

## Telemetry Event Schema Registry

### Core Event Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://valueos.ai/schemas/telemetry/core-event.json",
  "title": "Core Telemetry Event",
  "description": "Base schema for all telemetry events",
  "type": "object",
  "required": ["type", "timestamp", "metadata"],
  "properties": {
    "type": {
      "type": "string",
      "enum": [
        "sdui.render.start",
        "sdui.render.complete",
        "sdui.render.error",
        "sdui.component.mount",
        "sdui.component.unmount",
        "sdui.component.error",
        "sdui.hydration.start",
        "sdui.hydration.complete",
        "sdui.hydration.error",
        "sdui.user.interaction",
        "chat.request.start",
        "chat.request.complete",
        "chat.request.error",
        "workflow.state.load",
        "workflow.state.save",
        "workflow.stage.transition",
        "agent.invocation.start",
        "agent.invocation.complete",
        "agent.invocation.error",
        "circuit_breaker.state_change",
        "rate_limit.exceeded",
        "security.auth.success",
        "security.auth.failure",
        "security.authz.denied"
      ]
    },
    "timestamp": {
      "type": "integer",
      "description": "Unix timestamp in milliseconds",
      "minimum": 1600000000000,
      "maximum": 2000000000000
    },
    "traceId": {
      "type": "string",
      "pattern": "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$",
      "description": "UUID trace identifier"
    },
    "spanId": {
      "type": "string",
      "pattern": "^[a-f0-9]{16}$",
      "description": "16-character hex span identifier"
    },
    "parentSpanId": {
      "type": "string",
      "pattern": "^[a-f0-9]{16}$",
      "description": "Parent span identifier for nested operations"
    },
    "duration": {
      "type": "integer",
      "minimum": 0,
      "maximum": 300000,
      "description": "Duration in milliseconds (max 5 minutes)"
    },
    "metadata": {
      "type": "object",
      "description": "Event-specific metadata",
      "additionalProperties": true
    },
    "error": {
      "$ref": "#/definitions/Error"
    },
    "userId": {
      "type": "string",
      "pattern": "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"
    },
    "tenantId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "sessionId": {
      "type": "string",
      "pattern": "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Event schema version"
    }
  },
  "definitions": {
    "Error": {
      "type": "object",
      "required": ["message"],
      "properties": {
        "message": {
          "type": "string",
          "minLength": 1,
          "maxLength": 1000
        },
        "stack": {
          "type": "string",
          "maxLength": 10000
        },
        "code": {
          "type": "string",
          "pattern": "^[A-Z_0-9]+$"
        },
        "type": {
          "type": "string",
          "enum": ["ValidationError", "NetworkError", "TimeoutError", "SecurityError", "SystemError"]
        }
      }
    }
  }
}
```

### SDUI Rendering Events Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://valueos.ai/schemas/telemetry/sdui-render.json",
  "title": "SDUI Rendering Event",
  "allOf": [
    { "$ref": "core-event.json" },
    {
      "properties": {
        "type": {
          "enum": ["sdui.render.start", "sdui.render.complete", "sdui.render.error"]
        },
        "metadata": {
          "type": "object",
          "required": ["pageId", "componentCount"],
          "properties": {
            "pageId": {
              "type": "string",
              "pattern": "^page_[a-f0-9]{8}$"
            },
            "componentCount": {
              "type": "integer",
              "minimum": 0,
              "maximum": 1000
            },
            "renderStrategy": {
              "type": "string",
              "enum": ["client", "server", "hybrid"]
            },
            "cacheHit": {
              "type": "boolean"
            },
            "optimizationLevel": {
              "type": "string",
              "enum": ["none", "basic", "advanced"]
            },
            "bundleSize": {
              "type": "integer",
              "minimum": 0,
              "maximum": 10485760
            },
            "hydrationTime": {
              "type": "integer",
              "minimum": 0,
              "maximum": 10000
            }
          }
        }
      }
    }
  ]
}
```

### Agent Invocation Events Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://valueos.ai/schemas/telemetry/agent-invocation.json",
  "title": "Agent Invocation Event",
  "allOf": [
    { "$ref": "core-event.json" },
    {
      "properties": {
        "type": {
          "enum": ["agent.invocation.start", "agent.invocation.complete", "agent.invocation.error"]
        },
        "metadata": {
          "type": "object",
          "required": ["agentType", "agentId"],
          "properties": {
            "agentType": {
              "type": "string",
              "enum": ["governance-agent", "analytical-agent", "execution-agent", "ui-agent", "system-agent"]
            },
            "agentId": {
              "type": "string",
              "pattern": "^[a-z-]+_[a-f0-9]{8}$"
            },
            "queryLength": {
              "type": "integer",
              "minimum": 0,
              "maximum": 100000
            },
            "contextSize": {
              "type": "integer",
              "minimum": 0,
              "maximum": 1048576
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            },
            "llmCalls": {
              "type": "integer",
              "minimum": 0,
              "maximum": 100
            },
            "tokenUsage": {
              "type": "integer",
              "minimum": 0,
              "maximum": 100000
            },
            "cost": {
              "type": "number",
              "minimum": 0,
              "maximum": 100
            },
            "workflowStage": {
              "type": "string",
              "enum": ["opportunity", "target", "realization", "expansion"]
            }
          }
        }
      }
    }
  ]
}
```

### Security Events Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://valueos.ai/schemas/telemetry/security.json",
  "title": "Security Event",
  "allOf": [
    { "$ref": "core-event.json" },
    {
      "properties": {
        "type": {
          "enum": ["security.auth.success", "security.auth.failure", "security.authz.denied", "security.threat.detected"]
        },
        "metadata": {
          "type": "object",
          "required": ["agentType", "resource"],
          "properties": {
            "agentType": {
              "type": "string",
              "enum": ["governance-agent", "analytical-agent", "execution-agent", "ui-agent", "system-agent"]
            },
            "resource": {
              "type": "string",
              "enum": ["workflow_state", "agent_memory", "canvas_state", "sdui_render", "system_config"]
            },
            "action": {
              "type": "string",
              "enum": ["read", "write", "delete", "execute", "approve", "reject", "propose"]
            },
            "scope": {
              "type": "string",
              "enum": ["global", "tenant", "user", "session"]
            },
            "ipAddress": {
              "type": "string",
              "pattern": "^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
            },
            "userAgent": {
              "type": "string",
              "maxLength": 500
            },
            "threatLevel": {
              "type": "string",
              "enum": ["low", "medium", "high", "critical"]
            },
            "riskScore": {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            }
          }
        }
      }
    }
  ]
}
```

---

## Event Correctness Verification

### Validation Rules Engine

```typescript
interface EventValidationRule {
  name: string;
  severity: 'error' | 'warning' | 'info';
  validate(event: TelemetryEvent): ValidationResult;
  description: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

class EventCorrectnessVerifier {
  private rules: EventValidationRule[] = [];

  constructor() {
    this.initializeRules();
  }

  validateEvent(event: TelemetryEvent): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    for (const rule of this.rules) {
      const ruleResult = rule.validate(event);

      result.errors.push(...ruleResult.errors);
      result.warnings.push(...ruleResult.warnings);
      result.suggestions.push(...ruleResult.suggestions);

      if (ruleResult.errors.length > 0 && rule.severity === 'error') {
        result.valid = false;
      }
    }

    return result;
  }

  private initializeRules(): void {
    // Timestamp validation
    this.addRule({
      name: 'timestamp-range',
      severity: 'error',
      description: 'Timestamp must be within reasonable range',
      validate: (event) => {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        const oneHourFromNow = now + 60 * 60 * 1000;

        if (event.timestamp < oneHourAgo || event.timestamp > oneHourFromNow) {
          return {
            valid: false,
            errors: [`Timestamp ${event.timestamp} is outside valid range`],
            warnings: [],
            suggestions: ['Check system clock synchronization']
          };
        }

        return { valid: true, errors: [], warnings: [], suggestions: [] };
      }
    });

    // Trace ID format validation
    this.addRule({
      name: 'trace-id-format',
      severity: 'error',
      description: 'Trace ID must be valid UUID format',
      validate: (event) => {
        if (event.traceId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(event.traceId)) {
          return {
            valid: false,
            errors: [`Invalid trace ID format: ${event.traceId}`],
            warnings: [],
            suggestions: ['Use UUID v4 format for trace IDs']
          };
        }

        return { valid: true, errors: [], warnings: [], suggestions: [] };
      }
    });

    // Duration consistency validation
    this.addRule({
      name: 'duration-consistency',
      severity: 'warning',
      description: 'Duration should be consistent with event type',
      validate: (event) => {
        if (event.duration === undefined) {
          return { valid: true, errors: [], warnings: [], suggestions: [] };
        }

        // Start events shouldn't have duration
        if (event.type.endsWith('.start') && event.duration > 0) {
          return {
            valid: true,
            errors: [],
            warnings: ['Start events should not have duration'],
            suggestions: ['Remove duration from start events or use complete event']
          };
        }

        // Complete events should have duration
        if (event.type.endsWith('.complete') && event.duration === 0) {
          return {
            valid: true,
            errors: [],
            warnings: ['Complete events should have duration'],
            suggestions: ['Add duration measurement to complete events']
          };
        }

        return { valid: true, errors: [], warnings: [], suggestions: [] };
      }
    });

    // Metadata completeness validation
    this.addRule({
      name: 'metadata-completeness',
      severity: 'warning',
      description: 'Required metadata fields must be present',
      validate: (event) => {
        const requiredFields = this.getRequiredMetadataFields(event.type);
        const missingFields = requiredFields.filter(field => !(field in event.metadata));

        if (missingFields.length > 0) {
          return {
            valid: true,
            errors: [],
            warnings: [`Missing required metadata fields: ${missingFields.join(', ')}`],
            suggestions: [`Add required fields: ${missingFields.join(', ')}`]
          };
        }

        return { valid: true, errors: [], warnings: [], suggestions: [] };
      }
    });

    // Error event validation
    this.addRule({
      name: 'error-event-completeness',
      severity: 'error',
      description: 'Error events must have error details',
      validate: (event) => {
        if (event.type.endsWith('.error') && !event.error) {
          return {
            valid: false,
            errors: ['Error events must include error details'],
            warnings: [],
            suggestions: ['Add error object with message, stack, and code']
          };
        }

        return { valid: true, errors: [], warnings: [], suggestions: [] };
      }
    });

    // Performance threshold validation
    this.addRule({
      name: 'performance-thresholds',
      severity: 'warning',
      description: 'Performance metrics should be within expected ranges',
      validate: (event) => {
        const warnings: string[] = [];

        if (event.duration) {
          if (event.type.startsWith('sdui.render') && event.duration > 5000) {
            warnings.push('SDUI render duration exceeds 5 seconds');
          }

          if (event.type.startsWith('agent.invocation') && event.duration > 30000) {
            warnings.push('Agent invocation duration exceeds 30 seconds');
          }
        }

        return {
          valid: true,
          errors: [],
          warnings,
          suggestions: warnings.length > 0 ? ['Investigate performance bottlenecks'] : []
        };
      }
    });
  }

  private getRequiredMetadataFields(eventType: string): string[] {
    const fieldMap: Record<string, string[]> = {
      'sdui.render.start': ['pageId', 'componentCount'],
      'sdui.render.complete': ['pageId', 'componentCount', 'renderStrategy'],
      'agent.invocation.start': ['agentType', 'agentId', 'queryLength'],
      'agent.invocation.complete': ['agentType', 'agentId', 'confidence', 'llmCalls'],
      'security.auth.success': ['agentType', 'resource', 'action'],
      'security.auth.failure': ['agentType', 'resource', 'action'],
      'workflow.state.save': ['stage', 'status'],
      'chat.request.start': ['agentType', 'queryLength']
    };

    return fieldMap[eventType] || [];
  }

  private addRule(rule: EventValidationRule): void {
    this.rules.push(rule);
  }
}
```

### Real-Time Event Validation

```typescript
class TelemetryEventValidator {
  private verifier: EventCorrectnessVerifier;
  private metricsCollector: MetricsCollector;

  constructor() {
    this.verifier = new EventCorrectnessVerifier();
    this.metricsCollector = new MetricsCollector();
  }

  async validateAndRecord(event: TelemetryEvent): Promise<boolean> {
    // Validate event
    const validation = this.verifier.validateEvent(event);

    // Record validation metrics
    await this.metricsCollector.recordValidationMetrics(event.type, validation);

    // Log validation issues
    if (!validation.valid) {
      logger.error('Telemetry event validation failed', {
        eventType: event.type,
        errors: validation.errors,
        event
      });
    }

    if (validation.warnings.length > 0) {
      logger.warn('Telemetry event validation warnings', {
        eventType: event.type,
        warnings: validation.warnings,
        event
      });
    }

    // Record event if valid
    if (validation.valid) {
      await this.recordEvent(event);
    }

    return validation.valid;
  }

  private async recordEvent(event: TelemetryEvent): Promise<void> {
    // Send to telemetry pipeline
    await this.sendToTelemetryPipeline(event);

    // Update metrics
    await this.updateEventMetrics(event);
  }
}
```

---

## Schema Version Management

### Versioning Strategy

```typescript
interface SchemaVersion {
  version: string;
  schema: string;
  compatibility: 'backward' | 'forward' | 'none';
  deprecationDate?: Date;
  removalDate?: Date;
}

class SchemaRegistry {
  private schemas = new Map<string, SchemaVersion>();
  private currentVersion = '1.0.0';

  constructor() {
    this.initializeSchemas();
  }

  getSchema(eventType: string, version?: string): SchemaVersion | null {
    const targetVersion = version || this.currentVersion;
    const key = `${eventType}@${targetVersion}`;
    return this.schemas.get(key) || null;
  }

  validateEvent(event: TelemetryEvent): ValidationResult {
    const schema = this.getSchema(event.type, event.version);

    if (!schema) {
      return {
        valid: false,
        errors: [`No schema found for event type ${event.type} version ${event.version || 'latest'}`],
        warnings: [],
        suggestions: ['Check event type and version']
      };
    }

    return this.validateAgainstSchema(event, schema);
  }

  private initializeSchemas(): void {
    // Register core schemas
    this.registerSchema('core-event', '1.0.0', coreEventSchema, 'backward');
    this.registerSchema('sdui-render', '1.0.0', sduiRenderSchema, 'backward');
    this.registerSchema('agent-invocation', '1.0.0', agentInvocationSchema, 'backward');
    this.registerSchema('security', '1.0.0', securitySchema, 'backward');
  }

  private registerSchema(
    eventType: string,
    version: string,
    schema: string,
    compatibility: 'backward' | 'forward' | 'none'
  ): void {
    this.schemas.set(`${eventType}@${version}`, {
      version,
      schema,
      compatibility
    });
  }
}
```

---

## Implementation Roadmap

### Phase 1: Schema Validation (Week 1)
- [ ] Implement JSON schema validation
- [ ] Create EventCorrectnessVerifier
- [ ] Add real-time validation to SDUITelemetry
- [ ] Create validation metrics collection

### Phase 2: Enhanced Monitoring (Week 2)
- [ ] Add schema version management
- [ ] Implement validation dashboards
- [ ] Create alerting for validation failures
- [ ] Add performance threshold monitoring

### Phase 3: Advanced Features (Week 3)
- [ ] Implement schema migration tools
- [ ] Add backward compatibility checking
- [ ] Create automated schema generation
- [ ] Add event correlation analysis

---

## Success Criteria

### Functional Requirements
- [ ] All telemetry events validated against schemas
- [ ] Real-time validation with < 1ms overhead
- [ ] Comprehensive error reporting and suggestions
- [ ] Schema version management implemented

### Performance Requirements
- [ ] Validation overhead < 5% of telemetry pipeline
- [ ] Schema validation < 10ms per event
- [ ] No impact on event collection latency
- [ ] Memory usage < 50MB for validation engine

### Reliability Requirements
- [ ] Zero invalid events in production
- [ ] 99.9% validation accuracy
- [ ] Graceful degradation for schema mismatches
- [ ] Comprehensive audit trail

---

*Document Status*: ✅ **Complete**
*Implementation*: Schema definitions complete, validation engine designed
*Next Review*: Sprint 2, Week 1 (Schema Validation Implementation)
*Approval Required*: Observability Plane Lead, Data Engineer
