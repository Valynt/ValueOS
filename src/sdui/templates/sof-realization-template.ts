/**
 * SOF Realization Page Template
 * 
 * Extended Realization template with Feedback Loop Viewer and System Stability.
 */

import type { SDUIPageDefinition } from '../types';
import type { SystemMap, InterventionPoint, FeedbackLoop } from '../../types/sof';

/**
 * Generate SOF-enhanced Realization page
 */
export function generateSOFRealizationPage(data: {
  businessCase: any;
  systemMap: SystemMap;
  interventionPoint: InterventionPoint;
  feedbackLoops?: FeedbackLoop[];
  realizationData?: {
    implementationStatus: 'planning' | 'implementing' | 'completed';
    observedChanges: any[];
    kpiMeasurements?: any[];
  };
}): SDUIPageDefinition {
  const activeLoops = data.feedbackLoops?.filter((loop) => loop.realization_stage === 'active') || [];
  const closedLoops = data.feedbackLoops?.filter((loop) => loop.closure_status === 'closed') || [];

  const components: SDUIPageDefinition['components'] = [
    // Header
    {
      type: 'PageHeader',
      props: {
        title: 'Realization Tracking',
        subtitle: 'Monitor feedback loops and behavior changes',
        breadcrumbs: [
          { label: 'Home', href: '/' },
          { label: 'Opportunities', href: '/opportunities' },
          { label: data.businessCase?.name || 'Business Case' },
          { label: 'Realization' },
        ],
      },
    },

    // Status Overview
    {
      type: 'Grid',
      props: {
        columns: 4,
        gap: 4,
      },
      children: [
        {
          type: 'StatCard',
          props: {
            label: 'Implementation',
            value: data.realizationData?.implementationStatus || 'planning',
            icon: 'rocket',
            color: 'blue',
          },
        },
        {
          type: 'StatCard',
          props: {
            label: 'Active Loops',
            value: activeLoops.length,
            icon: 'refresh',
            color: 'green',
          },
        },
        {
          type: 'StatCard',
          props: {
            label: 'Closed Loops',
            value: closedLoops.length,
            icon: 'check-circle',
            color: 'purple',
          },
        },
        {
          type: 'StatCard',
          props: {
            label: 'Behavior Changes',
            value: data.realizationData?.observedChanges?.length || 0,
            icon: 'trending-up',
            color: 'orange',
          },
        },
      ],
    },

    // Main Content
    {
      type: 'Grid',
      props: {
        columns: 2,
        gap: 6,
      },
      children: [
        // Left Column: Feedback Loops
        {
          type: 'Stack',
          props: { gap: 4 },
          children: [
            // Feedback Loop Summary
            {
              type: 'Card',
              props: {
                title: 'Feedback Loop Status',
                description: 'System dynamics and loop closure',
              },
              children: [
                {
                  type: 'FeedbackLoopSummary',
                  props: {
                    loops: data.feedbackLoops || [],
                    systemMap: data.systemMap,
                  },
                },
              ],
            },

            // Active Feedback Loops
            ...activeLoops.map((loop) => ({
              type: 'FeedbackLoopViewer',
              props: {
                loop,
                showMetrics: true,
                showBehaviorChanges: true,
              },
            })),

            // Closed Loops (Collapsed)
            closedLoops.length > 0 && {
              type: 'Card',
              props: {
                title: 'Closed Feedback Loops',
                description: `${closedLoops.length} loop(s) successfully closed`,
                collapsible: true,
                defaultCollapsed: true,
              },
              children: closedLoops.map((loop) => ({
                type: 'FeedbackLoopViewer',
                props: {
                  loop,
                  compact: true,
                  showMetrics: false,
                  showBehaviorChanges: false,
                },
              })),
            },
          ].filter(Boolean),
        },

        // Right Column: Behavior Changes & System Updates
        {
          type: 'Stack',
          props: { gap: 4 },
          children: [
            // System Stability Indicators
            {
              type: 'Card',
              props: {
                title: 'System Stability',
                description: 'Overall system health and dynamics',
              },
              children: [
                {
                  type: 'SystemStabilityIndicator',
                  props: {
                    feedbackLoops: data.feedbackLoops || [],
                    systemMap: data.systemMap,
                  },
                },
              ],
            },

            // Behavior Change Timeline
            data.realizationData && data.realizationData.observedChanges.length > 0 && {
              type: 'Card',
              props: {
                title: 'Behavior Change Timeline',
                description: 'Observed changes over time',
              },
              children: [
                {
                  type: 'BehaviorChangeTimeline',
                  props: {
                    changes: data.realizationData.observedChanges,
                  },
                },
              ],
            },

            // System Update Log
            {
              type: 'Card',
              props: {
                title: 'System Updates',
                description: 'Recent system state changes',
              },
              children: [
                {
                  type: 'SystemUpdateLog',
                  props: {
                    updates: data.feedbackLoops?.flatMap((loop) => loop.system_updates) || [],
                    maxItems: 10,
                  },
                },
              ],
            },

            // Loop Metrics Panel
            data.feedbackLoops && data.feedbackLoops.some((loop) => loop.loop_metrics.length > 0) && {
              type: 'Card',
              props: {
                title: 'Loop Performance Metrics',
                description: 'Quantitative loop measurements',
              },
              children: [
                {
                  type: 'LoopMetricsPanel',
                  props: {
                    loops: data.feedbackLoops.filter((loop) => loop.loop_metrics.length > 0),
                  },
                },
              ],
            },

            // Recommendations
            {
              type: 'Card',
              props: {
                title: 'Realization Recommendations',
                description: 'Actions to strengthen feedback loops',
              },
              children: [
                {
                  type: 'RealizationRecommendations',
                  props: {
                    feedbackLoops: data.feedbackLoops || [],
                    realizationData: data.realizationData,
                  },
                },
              ],
            },
          ].filter(Boolean),
        },
      ],
    },

    // KPI Dashboard
    data.realizationData?.kpiMeasurements && data.realizationData.kpiMeasurements.length > 0 && {
      type: 'Card',
      props: {
        title: 'KPI Performance',
        description: 'Measured outcomes vs. targets',
      },
      children: [
        {
          type: 'KPIDashboard',
          props: {
            measurements: data.realizationData.kpiMeasurements,
            interventionPoint: data.interventionPoint,
          },
        },
      ],
    },

    // Actions Footer
    {
      type: 'ActionBar',
      props: {
        actions: [
          {
            label: 'Back to Target',
            variant: 'secondary',
            onClick: 'backToTarget',
          },
          {
            label: 'Log Behavior Change',
            variant: 'secondary',
            onClick: 'logBehaviorChange',
          },
          {
            label: 'Update Metrics',
            variant: 'secondary',
            onClick: 'updateMetrics',
          },
          {
            label: 'Continue to Expansion',
            variant: 'primary',
            onClick: 'continueToExpansion',
            disabled: closedLoops.length === 0,
          },
        ],
      },
    },
  ].filter(Boolean);

  return {
    type: 'RealizationPage',
    layout: 'default',
    components,
    metadata: {
      stage: 'realization',
      sofEnabled: true,
      requiresFeedbackLoops: true,
      tracksBehaviorChanges: true,
    },
  };
}

export default generateSOFRealizationPage;
