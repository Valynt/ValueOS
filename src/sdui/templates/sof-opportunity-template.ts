/**
 * SOF Opportunity Page Template
 * 
 * Extended Opportunity template with System Mapping panel.
 */

import type { SDUIPageDefinition } from '../types';
import type { SystemMap } from '../../types/sof';

/**
 * Generate SOF-enhanced Opportunity page
 */
export function generateSOFOpportunityPage(data: {
  businessCase: any;
  systemMap?: SystemMap;
  personas?: any[];
  kpis?: any[];
}): SDUIPageDefinition {
  const components: SDUIPageDefinition['components'] = [
    // Header
    {
      type: 'PageHeader',
      props: {
        title: 'Opportunity Discovery',
        subtitle: 'Identify and map systemic opportunities',
        breadcrumbs: [
          { label: 'Home', href: '/' },
          { label: 'Opportunities', href: '/opportunities' },
          { label: data.businessCase?.name || 'New Opportunity' },
        ],
      },
    },

    // Main Content Grid
    {
      type: 'Grid',
      props: {
        columns: 2,
        gap: 6,
      },
      children: [
        // Left Column: Traditional Opportunity Content
        {
          type: 'Stack',
          props: { gap: 4 },
          children: [
            // Opportunity Overview
            {
              type: 'Card',
              props: {
                title: 'Opportunity Overview',
                description: 'Core opportunity details and context',
              },
              children: [
                {
                  type: 'OpportunityForm',
                  props: {
                    businessCase: data.businessCase,
                  },
                },
              ],
            },

            // Persona-System-KPI Triad
            {
              type: 'Card',
              props: {
                title: 'Persona-System-KPI Triad',
                description: 'Connect stakeholders to system elements and metrics',
              },
              children: [
                {
                  type: 'TriadMapper',
                  props: {
                    personas: data.personas || [],
                    systemEntities: data.systemMap?.entities || [],
                    kpis: data.kpis || [],
                  },
                },
              ],
            },

            // Discovery Questions
            {
              type: 'Card',
              props: {
                title: 'Discovery Questions',
              },
              children: [
                {
                  type: 'DiscoveryQuestionnaire',
                  props: {
                    stage: 'opportunity',
                  },
                },
              ],
            },
          ],
        },

        // Right Column: System Mapping
        {
          type: 'Stack',
          props: { gap: 4 },
          children: [
            // System Map Canvas
            {
              type: 'Card',
              props: {
                title: 'System Map',
                description: 'Visualize the opportunity system',
              },
              children: [
                data.systemMap
                  ? {
                      type: 'SystemMapCanvas',
                      props: {
                        entities: data.systemMap.entities,
                        relationships: data.systemMap.relationships,
                        leveragePoints: data.systemMap.leverage_points,
                        constraints: data.systemMap.constraints,
                        title: data.systemMap.name,
                        description: data.systemMap.description,
                        interactive: true,
                      },
                    }
                  : {
                      type: 'EmptyState',
                      props: {
                        title: 'No System Map Yet',
                        description: 'Complete discovery to generate system map',
                        action: {
                          label: 'Start Discovery',
                          onClick: 'startDiscovery',
                        },
                      },
                    },
              ],
            },

            // System Insights
            data.systemMap && {
              type: 'Card',
              props: {
                title: 'System Insights',
              },
              children: [
                {
                  type: 'SystemInsightsPanel',
                  props: {
                    systemMap: data.systemMap,
                  },
                },
              ],
            },

            // Leverage Points
            data.systemMap && data.systemMap.leverage_points.length > 0 && {
              type: 'Card',
              props: {
                title: 'Leverage Points',
                description: 'High-impact intervention opportunities',
              },
              children: [
                {
                  type: 'LeveragePointsList',
                  props: {
                    leveragePoints: data.systemMap.leverage_points,
                  },
                },
              ],
            },
          ].filter(Boolean),
        },
      ],
    },

    // Actions Footer
    {
      type: 'ActionBar',
      props: {
        actions: [
          {
            label: 'Save Draft',
            variant: 'secondary',
            onClick: 'saveDraft',
          },
          {
            label: 'Generate System Map',
            variant: 'primary',
            onClick: 'generateSystemMap',
            disabled: !data.businessCase,
          },
          {
            label: 'Continue to Target',
            variant: 'primary',
            onClick: 'continueToTarget',
            disabled: !data.systemMap,
          },
        ],
      },
    },
  ];

  return {
    type: 'OpportunityPage',
    layout: 'default',
    components,
    metadata: {
      stage: 'opportunity',
      sofEnabled: true,
      requiresSystemMap: true,
    },
  };
}

export default generateSOFOpportunityPage;
