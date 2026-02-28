/**
 * Chat Target Stage SDUI Template
 *
 * Template for rendering agent responses during the Target stage.
 * Focus: ROI modeling, business case building, target setting
 *
 * Phase 3: Stage-specific SDUI generation
 */
import { v4 as uuidv4 } from "uuid";
/**
 * Generate Target stage SDUI page
 *
 * Components:
 * - AgentResponseCard: Main response with reasoning
 * - ROICalculator: Interactive ROI modeling (if relevant)
 * - BusinessCaseBuilder: Template for building case
 * - MetricsTable: Target KPIs and baselines
 */
export function generateTargetPage(context) {
    const { content, confidence, reasoning, workflowState, sessionId, traceId } = context;
    const sections = [
        {
            type: "component",
            component: "AgentResponseCard",
            version: 1,
            props: {
                response: {
                    id: uuidv4(),
                    agentId: "target",
                    agentName: "Target Agent",
                    timestamp: new Date().toISOString(),
                    content,
                    confidence,
                    reasoning: reasoning.map((r, i) => ({
                        id: `step-${i}`,
                        step: i + 1,
                        description: r,
                        confidence: Math.max(0.5, confidence - i * 0.05),
                    })),
                    status: "pending",
                },
                showReasoning: true,
                showActions: true,
                stage: "target",
            },
        },
    ];
    // Add ROI insights if high confidence
    if (confidence > 0.75) {
        sections.push({
            type: "component",
            component: "InsightCard",
            version: 1,
            props: {
                title: "Business Case Elements",
                description: "Components of a compelling ROI story",
                items: [
                    { icon: "dollar-sign", label: "Cost Savings", description: "Quantify efficiency gains" },
                    {
                        icon: "trending-up",
                        label: "Revenue Impact",
                        description: "Growth opportunities identified",
                    },
                    { icon: "shield", label: "Risk Mitigation", description: "Avoided costs and risks" },
                    { icon: "clock", label: "Time to Value", description: "Expected timeline to ROI" },
                ],
            },
        });
    }
    return {
        type: "page",
        version: 1,
        sections,
        metadata: {
            theme: "dark",
            lifecycle_stage: "target",
            case_id: workflowState.context.caseId,
            session_id: sessionId,
            generated_at: Date.now(),
            agent_name: "Target Agent",
            confidence_score: confidence,
            priority: "high", // Business case building is high priority
            required_components: ["AgentResponseCard"],
            optional_components: ["InsightCard", "ROICalculator"],
            accessibility: {
                level: "AA",
                screen_reader_optimized: true,
                keyboard_navigation: true,
            },
            telemetry_enabled: true,
            trace_id: traceId,
        },
    };
}
//# sourceMappingURL=chat-target-template.js.map