"use strict";
/**
 * SOF Expansion Page Template
 *
 * Extended Expansion template with System Replication and Scaling Analysis.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSOFExpansionPage = generateSOFExpansionPage;
/**
 * Generate SOF-enhanced Expansion page
 */
function generateSOFExpansionPage(data) {
    const closedLoops = data.feedbackLoops.filter((loop) => loop.closure_status === "closed");
    const isReadyForExpansion = closedLoops.length > 0;
    const sections = [
        // Header
        {
            type: "component",
            component: "PageHeader",
            version: 1,
            props: {
                title: "Expansion Planning",
                subtitle: "Replicate successful interventions to new contexts",
                breadcrumbs: [
                    { label: "Home", href: "/" },
                    { label: "Opportunities", href: "/opportunities" },
                    { label: data.businessCase?.name || "Business Case" },
                    { label: "Expansion" },
                ],
            },
        },
        // Readiness Check
        !isReadyForExpansion && {
            type: "component",
            component: "Alert",
            version: 1,
            props: {
                variant: "warning",
                title: "Not Ready for Expansion",
                message: "At least one feedback loop must be closed before expanding to new contexts.",
            },
        },
        // Expansion Overview
        isReadyForExpansion && {
            type: "component",
            component: "Grid",
            version: 1,
            props: {
                columns: 3,
                gap: 4,
                children: [
                    {
                        type: "component",
                        component: "StatCard",
                        version: 1,
                        props: {
                            label: "Closed Loops",
                            value: closedLoops.length,
                            icon: "check-circle",
                            color: "green",
                        },
                    },
                    {
                        type: "component",
                        component: "StatCard",
                        version: 1,
                        props: {
                            label: "Target Contexts",
                            value: data.expansionData?.targetContexts?.length || 0,
                            icon: "map",
                            color: "blue",
                        },
                    },
                    {
                        type: "component",
                        component: "StatCard",
                        version: 1,
                        props: {
                            label: "Replication Readiness",
                            value: `${data.expansionData?.replicationReadiness || 0}%`,
                            icon: "trending-up",
                            color: "purple",
                        },
                    },
                ],
            },
        },
        // Main Content
        isReadyForExpansion && {
            type: "component",
            component: "Tabs",
            version: 1,
            props: {
                defaultTab: "analysis",
                children: [
                    // System Analysis Tab
                    {
                        type: "component",
                        component: "TabPanel",
                        version: 1,
                        props: {
                            id: "analysis",
                            label: "System Analysis",
                            icon: "search",
                            children: [
                                {
                                    type: "component",
                                    component: "Stack",
                                    version: 1,
                                    props: {
                                        gap: 4,
                                        children: [
                                            // System Replication Analyzer
                                            {
                                                type: "component",
                                                component: "Card",
                                                version: 1,
                                                props: {
                                                    title: "System Replication Analysis",
                                                    description: "Identify transferable patterns and context dependencies",
                                                    children: [
                                                        {
                                                            type: "component",
                                                            component: "SystemReplicationAnalyzer",
                                                            version: 1,
                                                            props: {
                                                                systemMap: data.systemMap,
                                                                interventionPoint: data.interventionPoint,
                                                                feedbackLoops: closedLoops,
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                            // Transferability Matrix
                                            {
                                                type: "component",
                                                component: "Card",
                                                version: 1,
                                                props: {
                                                    title: "Transferability Assessment",
                                                    description: "Which system elements can be replicated?",
                                                    children: [
                                                        {
                                                            type: "component",
                                                            component: "TransferabilityMatrix",
                                                            version: 1,
                                                            props: {
                                                                systemMap: data.systemMap,
                                                                interventionPoint: data.interventionPoint,
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                            // Context Dependencies
                                            {
                                                type: "component",
                                                component: "Card",
                                                version: 1,
                                                props: {
                                                    title: "Context Dependencies",
                                                    description: "Critical factors that vary by context",
                                                    children: [
                                                        {
                                                            type: "component",
                                                            component: "ContextDependencyList",
                                                            version: 1,
                                                            props: {
                                                                systemMap: data.systemMap,
                                                                interventionPoint: data.interventionPoint,
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                    // Target Contexts Tab
                    {
                        type: "component",
                        component: "TabPanel",
                        version: 1,
                        props: {
                            id: "contexts",
                            label: "Target Contexts",
                            icon: "map-pin",
                            children: [
                                {
                                    type: "component",
                                    component: "Stack",
                                    version: 1,
                                    props: {
                                        gap: 4,
                                        children: [
                                            // Context Selector
                                            {
                                                type: "component",
                                                component: "Card",
                                                version: 1,
                                                props: {
                                                    title: "Select Target Contexts",
                                                    description: "Choose contexts for intervention replication",
                                                    children: [
                                                        {
                                                            type: "component",
                                                            component: "ContextSelector",
                                                            version: 1,
                                                            props: {
                                                                availableContexts: data.expansionData?.targetContexts || [],
                                                                systemMap: data.systemMap,
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                            // Context Comparison
                                            data.expansionData?.targetContexts &&
                                                data.expansionData.targetContexts.length > 0 && {
                                                type: "component",
                                                component: "Card",
                                                version: 1,
                                                props: {
                                                    title: "Context Comparison",
                                                    description: "Compare target contexts to source context",
                                                    children: [
                                                        {
                                                            type: "component",
                                                            component: "ContextComparisonTable",
                                                            version: 1,
                                                            props: {
                                                                sourceContext: {
                                                                    systemMap: data.systemMap,
                                                                    interventionPoint: data.interventionPoint,
                                                                },
                                                                targetContexts: data.expansionData.targetContexts,
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                            // Adaptation Requirements
                                            data.expansionData?.targetContexts &&
                                                data.expansionData.targetContexts.length > 0 && {
                                                type: "component",
                                                component: "Card",
                                                version: 1,
                                                props: {
                                                    title: "Adaptation Requirements",
                                                    description: "How to adapt intervention for each context",
                                                    children: data.expansionData.targetContexts.map((context) => ({
                                                        type: "component",
                                                        component: "AdaptationPlan",
                                                        version: 1,
                                                        props: {
                                                            context,
                                                            interventionPoint: data.interventionPoint,
                                                            systemMap: data.systemMap,
                                                        },
                                                    })),
                                                },
                                            },
                                        ].filter(Boolean),
                                    },
                                },
                            ],
                        },
                    },
                    // Scaling Strategy Tab
                    {
                        type: "component",
                        component: "TabPanel",
                        version: 1,
                        props: {
                            id: "scaling",
                            label: "Scaling Strategy",
                            icon: "trending-up",
                            children: [
                                {
                                    type: "component",
                                    component: "Stack",
                                    version: 1,
                                    props: {
                                        gap: 4,
                                        children: [
                                            // Scaling Factor Analysis
                                            {
                                                type: "component",
                                                component: "Card",
                                                version: 1,
                                                props: {
                                                    title: "Scaling Factors",
                                                    description: "Key factors that enable or constrain scaling",
                                                    children: [
                                                        {
                                                            type: "component",
                                                            component: "ScalingFactorAnalysis",
                                                            version: 1,
                                                            props: {
                                                                systemMap: data.systemMap,
                                                                interventionPoint: data.interventionPoint,
                                                                feedbackLoops: closedLoops,
                                                                scalingFactors: data.expansionData?.scalingFactors || [],
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                            // Scaling Sequence
                                            {
                                                type: "component",
                                                component: "Card",
                                                version: 1,
                                                props: {
                                                    title: "Scaling Sequence",
                                                    description: "Recommended order for context expansion",
                                                    children: [
                                                        {
                                                            type: "component",
                                                            component: "ScalingSequenceTimeline",
                                                            version: 1,
                                                            props: {
                                                                targetContexts: data.expansionData?.targetContexts || [],
                                                                scalingFactors: data.expansionData?.scalingFactors || [],
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                            // Risk Assessment
                                            {
                                                type: "component",
                                                component: "Card",
                                                version: 1,
                                                props: {
                                                    title: "Scaling Risks",
                                                    description: "Potential challenges in expansion",
                                                    children: [
                                                        {
                                                            type: "component",
                                                            component: "ScalingRiskMatrix",
                                                            version: 1,
                                                            props: {
                                                                targetContexts: data.expansionData?.targetContexts || [],
                                                                interventionPoint: data.interventionPoint,
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                    // Replication Playbook Tab
                    {
                        type: "component",
                        component: "TabPanel",
                        version: 1,
                        props: {
                            id: "playbook",
                            label: "Replication Playbook",
                            icon: "book",
                            children: [
                                {
                                    type: "component",
                                    component: "Card",
                                    version: 1,
                                    props: {
                                        title: "Intervention Replication Playbook",
                                        description: "Step-by-step guide for replicating this intervention",
                                        children: [
                                            {
                                                type: "component",
                                                component: "ReplicationPlaybook",
                                                version: 1,
                                                props: {
                                                    systemMap: data.systemMap,
                                                    interventionPoint: data.interventionPoint,
                                                    feedbackLoops: closedLoops,
                                                    targetContexts: data.expansionData?.targetContexts || [],
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        },
        // Actions Footer
        {
            type: "component",
            component: "ActionBar",
            version: 1,
            props: {
                actions: [
                    {
                        label: "Back to Realization",
                        variant: "secondary",
                        onClick: "backToRealization",
                    },
                    {
                        label: "Export Playbook",
                        variant: "secondary",
                        onClick: "exportPlaybook",
                        disabled: !isReadyForExpansion,
                    },
                    {
                        label: "Create Expansion Plan",
                        variant: "primary",
                        onClick: "createExpansionPlan",
                        disabled: !isReadyForExpansion || !data.expansionData?.targetContexts?.length,
                    },
                ],
            },
        },
    ].filter(Boolean);
    return {
        type: "page",
        version: 1,
        sections,
        metadata: {
            theme: "dark",
            lifecycle_stage: "expansion",
            sofEnabled: true,
            requiresClosedLoops: true,
            supportsReplication: true,
        },
    };
}
exports.default = generateSOFExpansionPage;
//# sourceMappingURL=sof-expansion-template.js.map