/**
 * Agent Safety Layer
 *
 * Three enforcement gates applied to every hardened agent invocation:
 *
 * 1. Prompt injection protection — scans prompts and context for injection
 *    patterns before the LLM call is made.
 * 2. Tool access restrictions — validates tool names against the agent's
 *    declared allowlist before any tool is invoked.
 * 3. Output validation — runs Zod schema validation on LLM output and
 *    detects PII before the result is released to callers.
 *
 * All violations are logged to the audit trail. High-severity injection
 * signals block execution entirely; medium signals sanitize and continue.
 */

import { z } from "zod";
import { logger } from "../../logger.js";
import type {
  InjectionSignal,
  SafetyScanResult,
  ToolViolation,
} from "./AgentHardeningTypes.js";

// ---------------------------------------------------------------------------
// Injection pattern registry
// ---------------------------------------------------------------------------

interface InjectionPattern {
  id: string;
  regex: RegExp;
  severity: InjectionSignal["severity"];
  description: string;
}

/**
 * Patterns that indicate prompt injection attempts.
 * Ordered from highest to lowest severity.
 *
 * These cover the OWASP LLM Top 10 injection categories relevant to
 * enterprise agent systems (LLM01, LLM02).
 */
const INJECTION_PATTERNS: InjectionPattern[] = [
  // Role override / system prompt hijack
  {
    id: "role_override",
    regex: /ignore\s+(all\s+)?(previous|prior|above|system)\s+(instructions?|prompts?|rules?|constraints?)/i,
    severity: "high",
    description: "Attempts to override system instructions",
  },
  {
    id: "new_instructions",
    regex: /\bnew\s+instructions?\s*:/i,
    severity: "high",
    description: "Injects new instruction block",
  },
  {
    id: "jailbreak_dan",
    regex: /\b(DAN|do\s+anything\s+now|jailbreak|unrestricted\s+mode)\b/i,
    severity: "high",
    description: "Known jailbreak pattern",
  },
  // Exfiltration attempts
  {
    id: "exfiltrate_env",
    regex: /\b(print|output|reveal|show|display|return|echo)\s+(all\s+)?(env(ironment)?\s+var(iable)?s?|api\s+key|secret|token|password|credential)/i,
    severity: "high",
    description: "Attempts to exfiltrate secrets or credentials",
  },
  {
    id: "exfiltrate_system",
    regex: /\b(system\s+prompt|internal\s+config|devcontainer|runner\s+id|environment\s+id)\b/i,
    severity: "high",
    description: "Attempts to exfiltrate internal infrastructure details",
  },
  // Indirect injection via external content
  {
    id: "indirect_injection_marker",
    regex: /<\s*(inject|payload|cmd|exec|eval)\s*>/i,
    severity: "high",
    description: "Indirect injection marker in external content",
  },
  // Prompt delimiter abuse
  {
    id: "delimiter_abuse",
    regex: /(\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>|###\s*Human:|###\s*Assistant:)/,
    severity: "medium",
    description: "Attempts to inject model-specific delimiters",
  },
  // Instruction smuggling via encoding
  {
    id: "base64_instruction",
    regex: /base64\s*(decode|encoded|instruction)/i,
    severity: "medium",
    description: "Possible base64-encoded instruction smuggling",
  },
  // Persona switching
  {
    id: "persona_switch",
    regex: /\b(act\s+as|pretend\s+(you\s+are|to\s+be)|you\s+are\s+now|roleplay\s+as)\b/i,
    severity: "medium",
    description: "Attempts to switch agent persona",
  },
  // Repetition / token flooding (low severity, may be legitimate)
  {
    id: "token_flood",
    regex: /(.)\1{200,}/,
    severity: "low",
    description: "Excessive character repetition (possible token flooding)",
  },
];

// ---------------------------------------------------------------------------
// PII detection patterns (output scanning)
// ---------------------------------------------------------------------------

const PII_PATTERNS: RegExp[] = [
  // Email
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  // US SSN
  /\b\d{3}-\d{2}-\d{4}\b/,
  // Credit card (basic Luhn-format)
  /\b(?:\d[ -]?){13,16}\b/,
  // Phone (US)
  /\b(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  // API key patterns (common formats)
  /\b(sk-[A-Za-z0-9]{20,}|xoxb-[A-Za-z0-9-]+|ghp_[A-Za-z0-9]{36})\b/,
];

// ---------------------------------------------------------------------------
// PromptSanitizer
// ---------------------------------------------------------------------------

export interface SanitizeResult {
  sanitized_prompt: string;
  signals: InjectionSignal[];
  /** True when the prompt was modified. */
  was_modified: boolean;
  /** True when the prompt should be blocked entirely (high-severity signal). */
  should_block: boolean;
}

export class PromptSanitizer {
  /**
   * Scan and optionally sanitize a prompt string.
   *
   * High-severity signals set should_block=true — callers must not proceed.
   * Medium signals redact the matched text and set was_modified=true.
   * Low signals are recorded but do not modify the prompt.
   */
  scan(
    text: string,
    location: InjectionSignal["location"] = "prompt"
  ): SanitizeResult {
    const signals: InjectionSignal[] = [];
    let sanitized = text;
    let should_block = false;

    for (const pattern of INJECTION_PATTERNS) {
      const match = pattern.regex.exec(sanitized);
      if (!match) continue;

      const signal: InjectionSignal = {
        pattern: pattern.id,
        location,
        severity: pattern.severity,
        matched_text:
          pattern.severity !== "high"
            ? match[0].slice(0, 80)
            : "[redacted]",
      };
      signals.push(signal);

      if (pattern.severity === "high") {
        should_block = true;
      } else if (pattern.severity === "medium") {
        // Redact the matched segment
        sanitized = sanitized.replace(pattern.regex, "[REDACTED]");
      }
    }

    return {
      sanitized_prompt: sanitized,
      signals,
      was_modified: sanitized !== text,
      should_block,
    };
  }

  /**
   * Scan all string values in a context object recursively.
   * Returns aggregated signals across all fields.
   */
  scanContext(
    context: Record<string, unknown>,
    depth = 0
  ): InjectionSignal[] {
    if (depth > 5) return []; // Guard against deeply nested objects
    const signals: InjectionSignal[] = [];

    for (const [, value] of Object.entries(context)) {
      if (typeof value === "string") {
        const result = this.scan(value, "context");
        signals.push(...result.signals);
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        signals.push(
          ...this.scanContext(value as Record<string, unknown>, depth + 1)
        );
      }
    }

    return signals;
  }
}

// ---------------------------------------------------------------------------
// ToolAccessGuard
// ---------------------------------------------------------------------------

export class ToolAccessGuard {
  constructor(
    private readonly agentName: string,
    private readonly allowedTools: ReadonlySet<string>
  ) {}

  /**
   * Validate that a tool is in the agent's allowlist.
   * Returns a ToolViolation if denied, null if permitted.
   */
  check(toolName: string): ToolViolation | null {
    if (!this.allowedTools.has(toolName)) {
      logger.warn("Tool access denied", {
        agent: this.agentName,
        tool: toolName,
        allowed: [...this.allowedTools],
      });
      return {
        tool_name: toolName,
        reason: "not_in_allowlist",
      };
    }
    return null;
  }

  /**
   * Validate a batch of tool names.
   * Returns all violations found.
   */
  checkBatch(toolNames: string[]): ToolViolation[] {
    return toolNames
      .map((t) => this.check(t))
      .filter((v): v is ToolViolation => v !== null);
  }
}

// ---------------------------------------------------------------------------
// OutputValidator
// ---------------------------------------------------------------------------

export interface OutputValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: string[];
  pii_detected: boolean;
}

export class OutputValidator {
  /**
   * Validate LLM output against a Zod schema and scan for PII.
   */
  validate<T>(
    raw: unknown,
    schema: z.ZodSchema<T>
  ): OutputValidationResult<T> {
    const parseResult = schema.safeParse(raw);

    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      );
      return { valid: false, errors, pii_detected: false };
    }

    // PII scan on the serialized output
    const serialized = JSON.stringify(parseResult.data);
    const pii_detected = PII_PATTERNS.some((p) => p.test(serialized));

    if (pii_detected) {
      logger.warn("PII detected in agent output — redaction required", {
        schema_name: schema.description ?? "unknown",
      });
    }

    return {
      valid: true,
      data: parseResult.data,
      errors: [],
      pii_detected,
    };
  }
}

// ---------------------------------------------------------------------------
// SafetyLayer — orchestrates all three gates
// ---------------------------------------------------------------------------

export interface SafetyCheckInput {
  prompt: string;
  context: Record<string, unknown>;
  output?: unknown;
  outputSchema?: z.ZodTypeAny;
  toolsRequested?: string[];
  agentName: string;
  allowedTools: ReadonlySet<string>;
}

export class SafetyLayer {
  private readonly sanitizer = new PromptSanitizer();
  private readonly outputValidator = new OutputValidator();

  /**
   * Run all safety gates for a single agent invocation.
   *
   * Returns a SafetyScanResult. Callers must check verdict before proceeding:
   *   - "blocked": abort execution, log security event
   *   - "flagged": proceed with caution, log warning
   *   - "clean": proceed normally
   */
  check(input: SafetyCheckInput): SafetyScanResult & {
    sanitized_prompt: string;
  } {
    const guard = new ToolAccessGuard(
      input.agentName,
      input.allowedTools
    );

    // Gate 1: Prompt injection
    const promptScan = this.sanitizer.scan(input.prompt, "prompt");
    const contextSignals = this.sanitizer.scanContext(input.context);
    const allInjectionSignals = [
      ...promptScan.signals,
      ...contextSignals,
    ];

    // Gate 2: Tool access
    const toolViolations = input.toolsRequested
      ? guard.checkBatch(input.toolsRequested)
      : [];

    // Gate 3: Output validation
    let schema_valid = true;
    let schema_errors: string[] = [];
    let pii_detected = false;

    if (input.output !== undefined && input.outputSchema) {
      const validation = this.outputValidator.validate(
        input.output,
        input.outputSchema
      );
      schema_valid = validation.valid;
      schema_errors = validation.errors;
      pii_detected = validation.pii_detected;
    }

    // Determine overall verdict
    const hasHighInjection = allInjectionSignals.some(
      (s) => s.severity === "high"
    );
    const hasViolations = toolViolations.length > 0;
    const hasSchemaErrors = !schema_valid;

    let verdict: SafetyScanResult["verdict"] = "clean";
    if (hasHighInjection || hasViolations) {
      verdict = "blocked";
    } else if (
      allInjectionSignals.length > 0 ||
      hasSchemaErrors ||
      pii_detected
    ) {
      verdict = "flagged";
    }

    return {
      verdict,
      injection_signals: allInjectionSignals,
      schema_valid,
      schema_errors: schema_errors.length > 0 ? schema_errors : undefined,
      tool_violations: toolViolations,
      pii_detected,
      sanitized_prompt: promptScan.sanitized_prompt,
    };
  }
}

export const safetyLayer = new SafetyLayer();
