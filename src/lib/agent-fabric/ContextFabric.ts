/**
 * Context Fabric Service
 *
 * Centralized service for gathering and injecting business context into AI agents.
 * Ensures agents generate tailored, specific insights rather than generic advice.
 *
 * Aggregates context from:
 * 1. User Identity (Role, Permissions)
 * 2. Organization Entity (Industry, Size, Region)
 * 3. Temporal State (Fiscal Year, Quarter)
 * 4. Intent/Session (Source of entry, current workflow stage)
 */

import { supabase } from "../../lib/supabase";
import { logger } from "../../lib/logger";
import { WorkflowState } from "../../repositories/WorkflowStateRepository";

// ============================================================================
// Types
// ============================================================================

export interface UserContext {
  userId: string;
  email?: string;
  role: string;
  department?: string;
  preferences?: Record<string, any>;
}

export interface EntityContext {
  tenantId: string;
  name: string;
  industry?: string;
  segment?: string; // Enterprise, Mid-Market, SMB
  region?: string;
  fiscalYearEnd?: string;
}

export interface TemporalContext {
  currentDate: string;
  fiscalYear: number;
  fiscalQuarter: number;
  daysToQuarterEnd: number;
}

export interface ProductContext {
  offeringName: string;
  valueProposition: string;
  targetBuyer: string;
}

export interface IntentContext {
  source?: string;
  initialQuery?: string;
  activeArtifactId?: string;
}

export interface ComprehensiveContext {
  user: UserContext;
  entity: EntityContext;
  temporal: TemporalContext;
  intent: IntentContext;
  workflow: Partial<WorkflowState>;
}

// ============================================================================
// Service
// ============================================================================

class ContextFabricService {
  /**
   * Build a comprehensive context object for an agent session
   */
  async buildContext(
    userId: string,
    tenantId: string,
    workflowState?: WorkflowState
  ): Promise<ComprehensiveContext> {
    logger.debug("Building context for session", { userId, tenantId });

    const [userCtx, entityCtx] = await Promise.all([
      this.getUserContext(userId),
      this.getEntityContext(tenantId),
    ]);

    const temporalCtx = this.getTemporalContext(entityCtx.fiscalYearEnd);

    return {
      user: userCtx,
      entity: entityCtx,
      temporal: temporalCtx,
      intent: {
        source: workflowState?.context?.source as string,
        initialQuery: workflowState?.context?.lastQuery as string,
      },
      workflow: workflowState || {},
    };
  }

  /**
   * Convert comprehensive context into a system prompt string
   * This is what gets injected into the LLM
   */
  formatContextForPrompt(context: ComprehensiveContext): string {
    return `
## BUSINESS CONTEXT
You are operating within the following specific business context. Use this to tailor your language, recommendations, and financial assumptions.

**User Context**:
- Role: ${context.user.role} ${context.user.department ? `(${context.user.department})` : ""}
- Goal: Create value realization artifacts for stakeholders.

**Entity Context**:
- Organization: ${context.entity.name}
- Industry: ${context.entity.industry || "Technology"}
- Segment: ${context.entity.segment || "Enterprise"}
- Region: ${context.entity.region || "Global"}

**Tenant Offering (Our Product)**:
- Product: ${(context.entity as any).product?.offeringName}
- Value Prop: ${(context.entity as any).product?.valueProposition}
- Buyer Persona: ${(context.entity as any).product?.targetBuyer}

**Temporal Context**:
- Current Date: ${context.temporal.currentDate}
- Fiscal Period: FY${context.temporal.fiscalYear} Q${context.temporal.fiscalQuarter}
- Urgency: ${context.temporal.daysToQuarterEnd} days remaining in quarter.

**Workflow State**:
- Current Stage: ${context.workflow.currentStage || "Opportunity"}
- Active Hypothesis: ${context.workflow.context?.company || "None"}
`.trim();
  }

  // --- Private Helpers ---

  private async getUserContext(userId: string): Promise<UserContext> {
    // In a real app, fetch from DB. For now, mock or minimal Supabase fetch.
    return {
      userId,
      role: "Value Consultant", // Default for now
      department: "Sales Engineering",
    };
  }

  private async getEntityContext(
    tenantId: string
  ): Promise<EntityContext & { product: ProductContext }> {
    // Mock for user's specific demo scenario
    return {
      tenantId,
      name: "PixelPerfect AI",
      industry: "SaaS / AI",
      segment: "Enterprise",
      region: "Global",
      fiscalYearEnd: "12-31",
      product: {
        offeringName: "AI Product Image Optimization Platform",
        valueProposition:
          "Automated enhancement of e-commerce imagery to drive conversion rates and reduce photography costs.",
        targetBuyer: "CMO, VP of Digital, Head of E-commerce",
      },
    };
  }

  private getTemporalContext(fiscalYearEnd: string = "12-31"): TemporalContext {
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    // Simple standard calendar FY calculation (can be enhanced for custom FY)
    const quarter = Math.floor(month / 3) + 1;

    // Calculate days to quarter end
    const quarterEndMonth = quarter * 3; // 3, 6, 9, 12
    const quarterEndDate = new Date(currentYear, quarterEndMonth, 0);
    const diffTime = Math.abs(quarterEndDate.getTime() - now.getTime());
    const daysToQuarterEnd = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      currentDate: now.toISOString().split("T")[0],
      fiscalYear: currentYear,
      fiscalQuarter: quarter,
      daysToQuarterEnd,
    };
  }
}

export const contextFabric = new ContextFabricService();
