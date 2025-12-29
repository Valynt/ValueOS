/**
 * Truth Engine "Torture Suite" (VOS-QA-001)
 *
 * Adversarial testing to verify the 4-Layer Truth Architecture
 * catches all failure modes:
 *
 * 1. The Lazy Agent: Numbers without citations (Layer 2)
 * 2. The Hallucinating Agent: Fake citations (Layer 2)
 * 3. The Illogical Agent: Valid citations, wrong math (Layer 1)
 * 4. The Rogue Agent: Tries to bypass audit (Layer 4)
 *
 * If any test fails, we have a vulnerability in production.
 *
 * @see /docs/PHASE4_PLUS_ENTERPRISE_TICKETS.md - VOS-QA-001
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addReasoningStep,
  Citation,
  createReasoningChain,
  DefaultIntegrityAgent,
  findUncitedClaims,
  getIntegrityAgent,
  IIntegrityAgent,
  IntegrityCheckResult,
  IntegrityError,
  IntegrityIssue,
  parseCitations,
  ReasoningChain,
  setIntegrityAgent,
  verifyCitations,
} from "../GroundTruthEngine";

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock integrity agent for controlled testing
 */
function createMockIntegrityAgent(behavior: {
  shouldPass: boolean;
  issues?: IntegrityIssue[];
  confidence?: number;
}): IIntegrityAgent {
  return {
    audit: vi.fn().mockResolvedValue({
      passed: behavior.shouldPass,
      confidence: behavior.confidence ?? (behavior.shouldPass ? 0.95 : 0.2),
      issues: behavior.issues ?? [],
      recommendations: behavior.shouldPass ? [] : ["Fix the issues"],
      checkedAt: new Date().toISOString(),
      checkedBy: "mock-integrity-agent",
    } as IntegrityCheckResult),
    checkLogic: vi.fn().mockResolvedValue(behavior.issues ?? []),
    verifyCalculations: vi.fn().mockResolvedValue([]),
  };
}

// ============================================================================
// LAYER 2: CITATION ENFORCEMENT TESTS
// ============================================================================

describe("Layer 2: Citation Enforcement", () => {
  describe("findUncitedClaims()", () => {
    it("should DETECT uncited percentage claims", () => {
      const text = "The estimated ROI is 50%.";
      const uncited = findUncitedClaims(text);

      // The pattern captures the number, may or may not include %
      expect(uncited.some((c) => c.includes("50"))).toBe(true);
    });

    it("should DETECT uncited dollar amounts", () => {
      const text = "This will save $5,000,000 annually.";
      const uncited = findUncitedClaims(text);

      expect(
        uncited.some((c) => c.includes("5,000,000") || c.includes("$5"))
      ).toBe(true);
    });

    it("should DETECT uncited large numbers", () => {
      const text = "We expect 150,000 new customers.";
      const uncited = findUncitedClaims(text);

      expect(uncited).toContain("150,000");
    });

    it("should IGNORE properly cited numbers", () => {
      const text = "The ROI is 120% [Source: VMRT-BENCH-001].";
      const uncited = findUncitedClaims(text);

      // The number should NOT appear in uncited claims
      expect(uncited.some((c) => c.includes("120"))).toBe(false);
    });

    it("should IGNORE years (false positive prevention)", () => {
      const text = "In 2024, revenue grew significantly.";
      const uncited = findUncitedClaims(text);

      expect(uncited).not.toContain("2024");
    });

    it("should IGNORE small context numbers", () => {
      const text = "There are 3 departments involved.";
      const uncited = findUncitedClaims(text);

      expect(uncited).not.toContain("3");
    });
  });

  describe("parseCitations()", () => {
    it("should PARSE valid VMRT citations", () => {
      const text = "Based on data [Source: VMRT-BENCH-001], we expect growth.";
      const citations = parseCitations(text);

      expect(citations).toHaveLength(1);
      expect(citations[0].id).toBe("VMRT-BENCH-001");
      expect(citations[0].type).toBe("VMRT");
    });

    it("should PARSE valid CRM citations", () => {
      const text = "Customer data [Source: CRM-DEAL-12345] shows potential.";
      const citations = parseCitations(text);

      expect(citations).toHaveLength(1);
      expect(citations[0].id).toBe("CRM-DEAL-12345");
      expect(citations[0].type).toBe("CRM");
    });

    it("should PARSE citations with field specifiers", () => {
      const text = "Revenue of $5M [Source: CRM-ACCT-001:annual_revenue].";
      const citations = parseCitations(text);

      expect(citations).toHaveLength(1);
      expect(citations[0].field).toBe("annual_revenue");
    });

    it("should PARSE multiple citations", () => {
      const text =
        "Based on [Source: VMRT-A] and [Source: CRM-B], we conclude.";
      const citations = parseCitations(text);

      expect(citations).toHaveLength(2);
    });

    it("should RETURN empty array for text without citations", () => {
      const text = "No sources here, just vibes.";
      const citations = parseCitations(text);

      expect(citations).toHaveLength(0);
    });
  });

  describe("verifyCitations() - The Lazy Agent Test", () => {
    it("should REJECT output with numbers but no citations", () => {
      // THE LAZY AGENT: Returns numbers without proof
      const lazyOutput =
        "The estimated ROI is 50%. This will save $2,000,000 annually.";

      const issues = verifyCitations(lazyOutput);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.category === "missing_citation")).toBe(true);
    });

    it("should ACCEPT output with all numbers cited", () => {
      const validOutput =
        "The ROI is 50% [Source: VMRT-BENCH-001]. " +
        "Savings of $2,000,000 [Source: CRM-DEAL-123] annually.";

      const issues = verifyCitations(validOutput);

      // Should have NO missing_citation issues
      const missingCitationIssues = issues.filter(
        (i) => i.category === "missing_citation"
      );
      expect(missingCitationIssues.length).toBe(0);
    });

    it("should REJECT partial citations (some numbers uncited)", () => {
      const partialOutput =
        "Revenue grew 25% [Source: FIN-001] but costs also rose 15%."; // 15% uncited!

      const issues = verifyCitations(partialOutput);

      expect(
        issues.some(
          (i) => i.category === "missing_citation" && i.message.includes("15")
        )
      ).toBe(true);
    });
  });
});

// ============================================================================
// LAYER 1: ADVERSARIAL PEER REVIEW TESTS
// ============================================================================

describe("Layer 1: Adversarial Peer Review (IntegrityAgent)", () => {
  let integrityAgent: DefaultIntegrityAgent;

  beforeEach(() => {
    integrityAgent = new DefaultIntegrityAgent();
  });

  describe("audit() - Basic Validation", () => {
    it("should PASS well-formed output with valid citations", async () => {
      const request = {
        originalPrompt: "Calculate ROI",
        agentOutput: {
          roi: 120,
          formatted: "ROI is 120% [Source: VMRT-BENCH-001]",
        },
        citedSources: [
          {
            id: "VMRT-BENCH-001",
            type: "VMRT" as const,
            value: 120,
            accessedAt: new Date().toISOString(),
          },
        ],
        riskLevel: "high" as const,
        producingAgent: {
          id: "test-agent",
          role: "TargetAgent" as any,
        },
      };

      const result = await integrityAgent.audit(request);

      expect(result.passed).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should FAIL output with uncited numerical claims", async () => {
      // THE LAZY AGENT strikes again
      const request = {
        originalPrompt: "Calculate savings",
        agentOutput: {
          savings: 5000000,
          formatted: "You will save $5,000,000 annually.", // No citation!
        },
        citedSources: [], // No sources provided
        riskLevel: "critical" as const,
        producingAgent: {
          id: "lazy-agent",
          role: "TargetAgent" as any,
        },
      };

      const result = await integrityAgent.audit(request);

      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.category === "missing_citation")).toBe(
        true
      );
    });

    it("should FAIL output with invalid source IDs", async () => {
      // THE HALLUCINATING AGENT: Makes up fake source IDs
      const request = {
        originalPrompt: "Get customer data",
        agentOutput: { data: "Fake data [Source: VMRT-999]" },
        citedSources: [
          {
            id: "", // Invalid: empty ID
            type: "VMRT" as const,
            value: "fake",
            accessedAt: new Date().toISOString(),
          },
        ],
        riskLevel: "high" as const,
        producingAgent: {
          id: "hallucinating-agent",
          role: "TargetAgent" as any,
        },
      };

      const result = await integrityAgent.audit(request);

      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.category === "invalid_source")).toBe(
        true
      );
    });
  });

  describe("audit() - The Illogical Agent Test", () => {
    it("should FLAG output with no reasoning steps", async () => {
      // THE ILLOGICAL AGENT: Valid citations but no explanation
      const emptyReasoningChain = createReasoningChain("agent-1", "session-1");
      // No steps added!

      const request = {
        originalPrompt: "Complex calculation",
        agentOutput: { result: "42 [Source: DATA-1]" },
        citedSources: [
          {
            id: "DATA-1",
            type: "VMRT" as const,
            value: 42,
            accessedAt: new Date().toISOString(),
          },
        ],
        reasoningChain: emptyReasoningChain,
        riskLevel: "high" as const,
        producingAgent: {
          id: "illogical-agent",
          role: "TargetAgent" as any,
        },
      };

      const result = await integrityAgent.audit(request);

      // Should flag the empty reasoning chain
      expect(result.issues.some((i) => i.category === "logical_fallacy")).toBe(
        true
      );
    });

    it("should FLAG reasoning chain with unverified steps", async () => {
      let chain = createReasoningChain("agent-1", "session-1");

      // Add unverified steps
      chain = addReasoningStep(chain, {
        action: "Fetched data",
        input: {},
        output: { count: 10 },
        citations: [],
        verified: false, // NOT VERIFIED
      });

      const issues = await integrityAgent.checkLogic(chain);

      expect(
        issues.some(
          (i) =>
            i.category === "logical_fallacy" && i.message.includes("unverified")
        )
      ).toBe(true);
    });
  });

  describe("verifyCalculations() - Math Validation", () => {
    it("should PASS correct ROI calculation", async () => {
      const inputs = { revenue: 150000, cost: 100000 };
      const formula = "roi";
      const result = 50; // (150000 - 100000) / 100000 * 100 = 50%

      const issues = await integrityAgent.verifyCalculations(
        inputs,
        formula,
        result
      );

      expect(issues.length).toBe(0);
    });

    it("should FAIL incorrect ROI calculation", async () => {
      const inputs = { revenue: 150000, cost: 100000 };
      const formula = "roi";
      const wrongResult = 120; // This is wrong!

      const issues = await integrityAgent.verifyCalculations(
        inputs,
        formula,
        wrongResult
      );

      expect(issues.some((i) => i.category === "calculation_error")).toBe(true);
    });
  });
});

// ============================================================================
// LAYER 3: REASONING CHAIN TESTS
// ============================================================================

describe("Layer 3: Reasoning Chain Transparency", () => {
  it("should CREATE valid reasoning chain", () => {
    const chain = createReasoningChain("agent-123", "session-456");

    expect(chain.agentId).toBe("agent-123");
    expect(chain.sessionId).toBe("session-456");
    expect(chain.steps).toHaveLength(0);
    expect(chain.verified).toBe(false);
  });

  it("should ADD steps with correct ordering", () => {
    let chain = createReasoningChain("agent-1", "session-1");

    chain = addReasoningStep(chain, {
      action: "Step 1: Fetch data",
      input: { query: "customers" },
      output: { count: 100 },
      citations: [],
      verified: true,
    });

    chain = addReasoningStep(chain, {
      action: "Step 2: Filter results",
      input: { filter: "SaaS" },
      output: { count: 25 },
      citations: [],
      verified: true,
    });

    expect(chain.steps).toHaveLength(2);
    expect(chain.steps[0].order).toBe(1);
    expect(chain.steps[1].order).toBe(2);
  });

  it("should ACCUMULATE citations across steps", () => {
    let chain = createReasoningChain("agent-1", "session-1");

    const citation1: Citation = {
      id: "CRM-1",
      type: "CRM",
      value: 100,
      accessedAt: new Date().toISOString(),
    };

    const citation2: Citation = {
      id: "VMRT-1",
      type: "VMRT",
      value: 50,
      accessedAt: new Date().toISOString(),
    };

    chain = addReasoningStep(chain, {
      action: "Step 1",
      input: {},
      output: {},
      citations: [citation1],
      verified: true,
    });

    chain = addReasoningStep(chain, {
      action: "Step 2",
      input: {},
      output: {},
      citations: [citation2],
      verified: true,
    });

    expect(chain.citations).toHaveLength(2);
    expect(chain.citations[0].id).toBe("CRM-1");
    expect(chain.citations[1].id).toBe("VMRT-1");
  });

  it("should EXPOSE reasoning chain for human review", () => {
    let chain = createReasoningChain("agent-1", "session-1");

    chain = addReasoningStep(chain, {
      action: "Fetched 12 CRM records",
      input: { source: "CRM" },
      output: { records: 12 },
      citations: [],
      verified: true,
      verificationMethod: "data_match",
    });

    chain = addReasoningStep(chain, {
      action: "Filtered for SaaS industry",
      input: { filter: "industry=SaaS" },
      output: { records: 5 },
      citations: [],
      verified: true,
      verificationMethod: "data_match",
    });

    // Human should be able to see EXACTLY what the agent did
    expect(chain.steps[0].action).toBe("Fetched 12 CRM records");
    expect(chain.steps[1].action).toBe("Filtered for SaaS industry");

    // This is where a human could spot: "Wait, why SaaS? This client is Manufacturing!"
  });
});

// ============================================================================
// LAYER 4: AUDIT TRAIL TESTS (via IntegrityError)
// ============================================================================

describe("Layer 4: Audit Trail & Error Handling", () => {
  it("should CREATE IntegrityError with full context", () => {
    const issues: IntegrityIssue[] = [
      {
        severity: "error",
        category: "missing_citation",
        message: "Uncited claim: 50%",
      },
      {
        severity: "critical",
        category: "hallucination_risk",
        message: "Source not found in VMRT",
      },
    ];

    const checkResult: IntegrityCheckResult = {
      passed: false,
      confidence: 0.1,
      issues,
      recommendations: ["Add citations"],
      checkedAt: new Date().toISOString(),
      checkedBy: "integrity-agent-1",
    };

    const error = new IntegrityError(issues, checkResult);

    expect(error.name).toBe("IntegrityError");
    expect(error.issues).toHaveLength(2);
    expect(error.checkResult.passed).toBe(false);
    expect(error.checkResult.checkedBy).toBe("integrity-agent-1");
    expect(error.message).toContain("[missing_citation]");
  });

  it("should INCLUDE all issues in error message for audit", () => {
    const issues: IntegrityIssue[] = [
      {
        severity: "error",
        category: "missing_citation",
        message: "ROI uncited",
      },
      {
        severity: "error",
        category: "calculation_error",
        message: "Math wrong",
      },
    ];

    const error = new IntegrityError(issues, {
      passed: false,
      confidence: 0,
      issues,
      recommendations: [],
      checkedAt: new Date().toISOString(),
      checkedBy: "test",
    });

    // Error message should include both issues for audit trail
    expect(error.message).toContain("ROI uncited");
    expect(error.message).toContain("Math wrong");
  });
});

// ============================================================================
// INTEGRATION TESTS: THE FULL TORTURE
// ============================================================================

describe("Integration: Full Torture Suite", () => {
  it("THE LAZY AGENT: Should be caught by Layer 2", async () => {
    const lazyOutput = "Revenue will increase 45% and save $3.5M annually.";

    const issues = verifyCitations(lazyOutput);

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.category === "missing_citation")).toBe(true);

    // This would throw IntegrityError in BaseAgent.executeWithIntegrityCheck()
  });

  it("THE HALLUCINATING AGENT: Should be caught by Layer 2+1", async () => {
    const integrityAgent = new DefaultIntegrityAgent();

    const hallucinatedRequest = {
      originalPrompt: "Get data",
      agentOutput: { data: "Value is 100 [Source: FAKE-999]" },
      citedSources: [
        {
          // Source with invalid/short ID
          id: "X",
          type: "VMRT" as const,
          value: 100,
          accessedAt: new Date().toISOString(),
        },
      ],
      riskLevel: "critical" as const,
      producingAgent: { id: "hallucinator", role: "TargetAgent" as any },
    };

    const result = await integrityAgent.audit(hallucinatedRequest);

    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.category === "invalid_source")).toBe(
      true
    );
  });

  it("THE ILLOGICAL AGENT: Should be caught by Layer 1", async () => {
    const integrityAgent = new DefaultIntegrityAgent();

    // Chain with all unverified steps
    let suspiciousChain = createReasoningChain("agent-1", "session-1");
    suspiciousChain = addReasoningStep(suspiciousChain, {
      action: "Made stuff up",
      input: {},
      output: {},
      citations: [],
      verified: false,
    });

    const issues = await integrityAgent.checkLogic(suspiciousChain);

    expect(issues.some((i) => i.category === "logical_fallacy")).toBe(true);
  });

  it("THE ROGUE AGENT: Cannot bypass - IntegrityError contains audit data", () => {
    // A rogue agent might try to suppress errors, but IntegrityError
    // contains all the data needed for forensic audit

    const issues: IntegrityIssue[] = [
      {
        severity: "critical",
        category: "hallucination_risk",
        message: "Agent claimed unverifiable fact",
        location: "output.roi",
      },
    ];

    const error = new IntegrityError(issues, {
      passed: false,
      confidence: 0,
      issues,
      recommendations: [],
      checkedAt: "2024-01-01T00:00:00.000Z",
      checkedBy: "integrity-agent",
    });

    // Even if caught, audit trail exists
    expect(error.checkResult.checkedAt).toBeDefined();
    expect(error.checkResult.checkedBy).toBeDefined();
    expect(error.issues[0].location).toBe("output.roi");

    // This data would be logged by BaseAgent before throwing
  });
});

// ============================================================================
// CONFIDENCE METRIC TESTS
// ============================================================================

describe("Confidence Metrics", () => {
  it("should CALCULATE high confidence for clean output", async () => {
    const agent = new DefaultIntegrityAgent();

    const cleanRequest = {
      originalPrompt: "Calculate",
      agentOutput: { result: "Value is 50 [Source: VMRT-TEST-001]" },
      citedSources: [
        {
          id: "VMRT-TEST-001",
          type: "VMRT" as const,
          value: 50,
          accessedAt: new Date().toISOString(),
        },
      ],
      riskLevel: "low" as const,
      producingAgent: { id: "good-agent", role: "TargetAgent" as any },
    };

    const result = await agent.audit(cleanRequest);

    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it("should CALCULATE low confidence for problematic output", async () => {
    const agent = new DefaultIntegrityAgent();

    const problematicRequest = {
      originalPrompt: "Calculate",
      agentOutput: { result: "Value is 50, 60, 70, 80, 90, 100!" }, // Many uncited!
      citedSources: [],
      riskLevel: "high" as const,
      producingAgent: { id: "bad-agent", role: "TargetAgent" as any },
    };

    const result = await agent.audit(problematicRequest);

    expect(result.confidence).toBeLessThan(0.5);
  });
});
