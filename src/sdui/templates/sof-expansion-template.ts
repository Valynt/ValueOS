/**
 * SOF Expansion Page Template
 * 
 * Extended Expansion template with System Replication and Scaling Analysis.
 */

import type { SDUIPageDefinition } from '../types';
import type { SystemMap, InterventionPoint, FeedbackLoop } from '../../types/sof';

/**
 * Generate SOF-enhanced Expansion page
 */
export function generateSOFExpansionPage(data: {
  businessCase: any;
  systemMap: SystemMap;
  interventionPoint: InterventionPoint;
  feedbackLoops: FeedbackLoop[];
  expansionData?: {
    targetContexts: any[];
    scalingFactors?: any[];
    replicationReadiness?: number;
  };
}): SDUIPageDefinition {
  const closedLoops = data.feedbackLoops.filter((loop) => loop.closure_status === 'closed');
  const isReadyForExpansion = closedLoops.length > 0;

  const components: SDUIPageDefinition['components'] = [
    // Header
    {
      type: 'PageHeader',
      props: {
        title: 'Expansion Planning',
        subtitle: 'Replicate successful interventions to new contexts',
        breadcrumbs: [
          { label: 'Home', href: '/' },
          { label: 'Opportunities', href: '/opportunities' },
          { label: data.businessCase?.name || 'Business Case' },
          { label: 'Expansion' },
        ],
      },
    },

    // Readiness Check
    !isReadyForExpansion && {
      type: 'Alert',
      props: {
        variant: 'warning',
        title: 'Not Ready for Expansion',
        message: 'At least one feedback loop must be closed before expanding to new contexts.',
      },
    },

    // Expansion Overview
    isReadyForExpansion && {
      type: 'Grid',
      props: {
        columns: 3,
        gap: 4,
      },
      children: [
        {
          type: 'StatCard',
          props: {
            label: 'Closed Loops',
            value: closedLoops.length,
            icon: 'check-circle',
            color: 'green',
          },
        },
        {
          type: 'StatCard',
          props: {
            label: 'Target Contexts',
            value: data.expansionData?.targetContexts?.length || 0,
            icon: 'map',
            color: 'blue',
          },
        },
        {
          type: 'StatCard',
          props: {
            label: 'Replication Readiness',
            value: `${data.expansionData?.replicationReadiness || 0}%`,
            icon: 'trending-up',
            color: 'purple',
          },
        },
      ],
    },

    // Main Content
    isReadyForExpansion && {
      type: 'Tabs',
      props: {
        defaultTab: 'analysis',
      },
      children: [
        // System Analysis Tab
        {
          type: 'TabPanel',
          props: {
            id: 'analysis',
            label: 'System Analysis',
            icon: 'search',
          },
          children: [
            {
              type: 'Stack',
              props: { gap: 4 },
              children: [
                // System Replication Analyzer
                {
                  type: 'Card',
                  props: {
                    title: 'System Replication Analysis',
                    description: 'Identify transferable patterns and context dependencies',
                  },
                  children: [
                    {
                      type: 'SystemReplicationAnalyzer',
                      props: {
                        systemMap: data.systemMap,
                        interventionPoint: data.interventionPoint,
                        feedbackLoops: closedLoops,
                      },
                    },
                  ],
                },

                // Transferability Matrix
                {
                  type: 'Card',
                  props: {
                    title: 'Transferability Assessment',
                    description: 'Which system elements can be replicated?',
                  },
                  children: [
                    {
                      type: 'TransferabilityMatrix',
                      props: {
                        systemMap: data.systemMap,
                        interventionPoint: data.interventionPoint,
                      },
                    },
                  ],
                },

                // Context Dependencies
                {
                  type: 'Card',
                  props: {
                    title: 'Context Dependencies',
                    description: 'Critical factors that vary by context',
                  },
                  children: [
                    {
                      type: 'ContextDependencyList',
                      props: {
                        systemMap: data.systemMap,
                        interventionPoint: data.interventionPoint,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },

        // Target Contexts Tab
        {
          type: 'TabPanel',
          props: {
            id: 'contexts',
            label: 'Target Contexts',
            icon: 'map-pin',
          },
          children: [
            {
              type: 'Stack',
              props: { gap: 4 },
              children: [
                // Context Selector
                {
                  type: 'Card',
                  props: {
                    title: 'Select Target Contexts',
                    description: 'Choose contexts for intervention replication',
                  },
                  children: [
                    {
                      type: 'ContextSelector',
                      props: {
                        availableContexts: data.expansionData?.targetContexts || [],
                        systemMap: data.systemMap,
                      },
                    },
                  ],
                },

                // Context Comparison
                data.expansionData?.targetContexts && data.expansionData.targetContexts.length > 0 && {
                  type: 'Card',
                  props: {
                    title: 'Context Comparison',
                    description: 'Compare target contexts to source context',
                  },
                  children: [
                    {
                      type: 'ContextComparisonTable',
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

                // Adaptation Requirements
                data.expansionData?.targetContexts && data.expansionData.targetContexts.length > 0 && {
                  type: 'Card',
                  props: {
                    title: 'Adaptation Requirements',
                    description: 'How to adapt intervention for each context',
                  },
                  children: data.expansionData.targetContexts.map((context) => ({
                    type: 'AdaptationPlan',
                    props: {
                      context,
                      interventionPoint: data.interventionPoint,
                      systemMap: data.systemMap,
                    },
                  })),
                },
              ].filter(Boolean),
            },
          ],
        },

        // Scaling Strategy Tab
        {
          type: 'TabPanel',
          props: {
            id: 'scaling',
            label: 'Scaling Strategy',
            icon: 'trending-up',
          },
          children: [
            {
              type: 'Stack',
              props: { gap: 4 },
              children: [
                // Scaling Factor Analysis
                {
                  type: 'Card',
                  props: {
                    title: 'Scaling Factors',
                    description: 'Key factors that enable or constrain scaling',
                  },
                  children: [
                    {
                      type: 'ScalingFactorAnalysis',
                      props: {
                        systemMap: data.systemMap,
                        interventionPoint: data.interventionPoint,
                        feedbackLoops: closedLoops,
                        scalingFactors: data.expansionData?.scalingFactors || [],
                      },
                    },
                  ],
                },

                // Scaling Sequence
                {
                  type: 'Card',
                  props: {
                    title: 'Scaling Sequence',
                    description: 'Recommended order for context expansion',
                  },
                  children: [
                    {
                      type: 'ScalingSequenceTimeline',
                      props: {
                        targetContexts: data.expansionData?.targetContexts || [],
                        scalingFactors: data.expansionData?.scalingFactors || [],
                      },
                    },
                  ],
                },

                // Risk Assessment
                {
                  type: 'Card',
                  props: {
                    title: 'Scaling Risks',
                    description: 'Potential challenges in expansion',
                  },
                  children: [
                    {
                      type: 'ScalingRiskMatrix',
                      props: {
                        targetContexts: data.expansionData?.targetContexts || [],
                        interventionPoint: data.interventionPoint,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },

        // Replication Playbook Tab
        {
          type: 'TabPanel',
          props: {
            id: 'playbook',
            label: 'Replication Playbook',
            icon: 'book',
          },
          children: [
            {
              type: 'Card',
              props: {
                title: 'Intervention Replication Playbook',
                description: 'Step-by-step guide for replicating this intervention',
              },
              children: [
                {
                  type: 'ReplicationPlaybook',
                  props: {
                    systemMap: data.systemMap,
                    interventionPoint: data.interventionPoint,
                    feedbackLoops: closedLoops,
                    targetContexts: data.expansionData?.targetContexts || [],
                  },
                },
              ],
            },
          ],
        },
      ],
    },

    // Actions Footer
    {
      type: 'ActionBar',
      props: {
        actions: [
          {
            label: 'Back to Realization',
            variant: 'secondary',
            onClick: 'backToRealization',
          },
          {
            label: 'Export Playbook',
            variant: 'secondary',
            onClick: 'exportPlaybook',
            disabled: !isReadyForExpansion,
          },
          {
            label: 'Create Expansion Plan',
            variant: 'primary',
            onClick: 'createExpansionPlan',
            disabled: !isReadyForExpansion || !data.expansionData?.targetContexts?.length,
          },
        ],
      },
    },
  ].filter(Boolean);

  return {
    type: 'ExpansionPage',
    layout: 'default',
    components,
    metadata: {
      stage: 'expansion',
      sofEnabled: true,
      requiresClosedLoops: true,
      supportsReplication: true,
    },
  };
}

export default generateSOFExpansionPage;
