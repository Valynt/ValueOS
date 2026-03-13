/**
 * SOF Realization Page Template
 *
 * Extended Realization template with Feedback Loop Viewer and System Stability.
 */

import type { FeedbackLoop, InterventionPoint, SystemMap } from "@valueos/sdui-types";

import type { SDUIPageDefinition } from "../schema";

/**
 * Generate SOF-enhanced Realization page
 */
export function generateSOFRealizationPage(data: {
  businessCase: Record<string, unknown> | undefined;
  systemMap: SystemMap;
  interventionPoint: InterventionPoint;
  feedbackLoops?: FeedbackLoop[];
  realizationData?: {
    implementationStatus: "planning" | "implementing" | "completed";
    observedChanges: unknown[];
    kpiMeasurements?: unknown[];
  };
}): SDUIPageDefinition {
  const activeLoops =
    data.feedbackLoops?.filter((loop) => loop.realization_stage === "active") || [];
  const closedLoops = data.feedbackLoops?.filter((loop) => loop.closure_status === "closed") || [];

  const sections: SDUIPageDefinition["sections"] = [
    // Header
    {
      type: "component",
      component: "PageHeader",
      version: 1,
      props: {
        title: "Realization Tracking",
        subtitle: "Monitor feedback loops and behavior changes",
        breadcrumbs: [
          { label: "Home", href: "/" },
          { label: "Opportunities", href: "/opportunities" },
          { label: (data.businessCase?.name as string) || "Business Case" },
          { label: "Realization" },
        ],
      },
    },

    // Status Overview
    {
      type: "component",
      component: "Grid",
      version: 1,
      props: {
        columns: 4,
        gap: 4,
        children: [
          {
            type: "component",
            component: "StatCard",
            version: 1,
            props: {
              label: "Implementation",
              value: data.realizationData?.implementationStatus || "planning",
              icon: "rocket",
              color: "blue",
            },
          },
          {
            type: "component",
            component: "StatCard",
            version: 1,
            props: {
              label: "Active Loops",
              value: activeLoops.length,
              icon: "refresh",
              color: "green",
            },
          },
          {
            type: "component",
            component: "StatCard",
            version: 1,
            props: {
              label: "Closed Loops",
              value: closedLoops.length,
              icon: "check-circle",
              color: "purple",
            },
          },
          {
            type: "component",
            component: "StatCard",
            version: 1,
            props: {
              label: "Behavior Changes",
              value: data.realizationData?.observedChanges?.length || 0,
              icon: "trending-up",
              color: "orange",
            },
          },
        ],
      },
    },

    // Main Content
    {
      type: "component",
      component: "Grid",
      version: 1,
      props: {
        columns: 2,
        gap: 6,
        children: [
          // Left Column: Feedback Loops
          {
            type: "component",
            component: "Stack",
            version: 1,
            props: {
              gap: 4,
              children: [
                // Feedback Loop Summary
                {
                  type: "component",
                  component: "Card",
                  version: 1,
                  props: {
                    title: "Feedback Loop Status",
                    description: "System dynamics and loop closure",
                    children: [
                      {
                        type: "component",
                        component: "FeedbackLoopSummary",
                        version: 1,
                        props: {
                          loops: data.feedbackLoops || [],
                          systemMap: data.systemMap,
                        },
                      },
                    ],
                  },
                },

                // Active Feedback Loops
                ...activeLoops.map((loop) => ({
                  type: "component",
                  component: "FeedbackLoopViewer",
                  version: 1,
                  props: {
                    loop,
                    showMetrics: true,
                    showBehaviorChanges: true,
                  },
                })),

                // Closed Loops (Collapsed)
                closedLoops.length > 0 && {
                  type: "component",
                  component: "Card",
                  version: 1,
                  props: {
                    title: "Closed Feedback Loops",
                    description: `${closedLoops.length} loop(s) successfully closed`,
                    collapsible: true,
                    defaultCollapsed: true,
                    children: closedLoops.map((loop) => ({
                      type: "component",
                      component: "FeedbackLoopViewer",
                      version: 1,
                      props: {
                        loop,
                        compact: true,
                        showMetrics: false,
                        showBehaviorChanges: false,
                      },
                    })),
                  },
                },
              ].filter(Boolean) as SDUIPageDefinition["sections"],
            },
          },

          // Right Column: Behavior Changes & System Updates
          {
            type: "component",
            component: "Stack",
            version: 1,
            props: {
              gap: 4,
              children: [
                // System Stability Indicators
                {
                  type: "component",
                  component: "Card",
                  version: 1,
                  props: {
                    title: "System Stability",
                    description: "Overall system health and dynamics",
                    children: [
                      {
                        type: "component",
                        component: "SystemStabilityIndicator",
                        version: 1,
                        props: {
                          feedbackLoops: data.feedbackLoops || [],
                          systemMap: data.systemMap,
                        },
                      },
                    ],
                  },
                },

                // Behavior Change Timeline
                data.realizationData &&
                  data.realizationData.observedChanges.length > 0 && {
                    type: "component",
                    component: "Card",
                    version: 1,
                    props: {
                      title: "Behavior Change Timeline",
                      description: "Observed changes over time",
                      children: [
                        {
                          type: "component",
                          component: "BehaviorChangeTimeline",
                          version: 1,
                          props: {
                            changes: data.realizationData.observedChanges,
                          },
                        },
                      ],
                    },
                  },

                // System Update Log
                {
                  type: "component",
                  component: "Card",
                  version: 1,
                  props: {
                    title: "System Updates",
                    description: "Recent system state changes",
                    children: [
                      {
                        type: "component",
                        component: "SystemUpdateLog",
                        version: 1,
                        props: {
                          updates: data.feedbackLoops?.flatMap((loop) => loop.system_updates) || [],
                          maxItems: 10,
                        },
                      },
                    ],
                  },
                },

                // Loop Metrics Panel
                data.feedbackLoops &&
                  data.feedbackLoops.some((loop) => loop.loop_metrics.length > 0) && {
                    type: "component",
                    component: "Card",
                    version: 1,
                    props: {
                      title: "Loop Performance Metrics",
                      description: "Quantitative loop measurements",
                      children: [
                        {
                          type: "component",
                          component: "LoopMetricsPanel",
                          version: 1,
                          props: {
                            loops: data.feedbackLoops.filter(
                              (loop) => loop.loop_metrics.length > 0
                            ),
                          },
                        },
                      ],
                    },
                  },

                // Recommendations
                {
                  type: "component",
                  component: "Card",
                  version: 1,
                  props: {
                    title: "Realization Recommendations",
                    description: "Actions to strengthen feedback loops",
                    children: [
                      {
                        type: "component",
                        component: "RealizationRecommendations",
                        version: 1,
                        props: {
                          feedbackLoops: data.feedbackLoops || [],
                          realizationData: data.realizationData,
                        },
                      },
                    ],
                  },
                },
              ].filter(Boolean) as SDUIPageDefinition["sections"],
            },
          },
        ],
      },
    },

    // KPI Dashboard
    data.realizationData?.kpiMeasurements &&
      data.realizationData.kpiMeasurements.length > 0 && {
        type: "component",
        component: "Card",
        version: 1,
        props: {
          title: "KPI Performance",
          description: "Measured outcomes vs. targets",
          children: [
            {
              type: "component",
              component: "KPIDashboard",
              version: 1,
              props: {
                measurements: data.realizationData.kpiMeasurements,
                interventionPoint: data.interventionPoint,
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
            label: "Back to Target",
            variant: "secondary",
            onClick: "backToTarget",
          },
          {
            label: "Log Behavior Change",
            variant: "secondary",
            onClick: "logBehaviorChange",
          },
          {
            label: "Update Metrics",
            variant: "secondary",
            onClick: "updateMetrics",
          },
          {
            label: "Continue to Expansion",
            variant: "primary",
            onClick: "continueToExpansion",
            disabled: closedLoops.length === 0,
          },
        ],
      },
    },
  ].filter(Boolean) as SDUIPageDefinition["sections"];

  return {
    type: "page",
    version: 1,
    sections,
    metadata: {
      theme: "dark",
      lifecycle_stage: "realization",
      sofEnabled: true,
      requiresFeedbackLoops: true,
    },
  };
}

export default generateSOFRealizationPage;