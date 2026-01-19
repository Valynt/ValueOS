/**
 * SOF Opportunity Page Template
 * 
 * Extended Opportunity template with System Mapping panel.
 */

import type { SDUIPageDefinition } from '../schema';
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
  const sections: SDUIPageDefinition['sections'] = [
    // Header
    {
      type: 'component',
      component: 'PageHeader',
      version: 1,
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
      type: 'component',
      component: 'Grid',
      version: 1,
      props: {
        columns: 2,
        gap: 6,
        children: [
          // Left Column: Traditional Opportunity Content
          {
            type: 'component',
            component: 'Stack',
            version: 1,
            props: {
              gap: 4,
              children: [
                // Opportunity Overview
                {
                  type: 'component',
                  component: 'Card',
                  version: 1,
                  props: {
                    title: 'Opportunity Overview',
                    description: 'Core opportunity details and context',
                    children: [
                      {
                        type: 'component',
                        component: 'OpportunityForm',
                        version: 1,
                        props: {
                          businessCase: data.businessCase,
                        },
                      },
                    ],
                  },
                },

                // Persona-System-KPI Triad
                {
                  type: 'component',
                  component: 'Card',
                  version: 1,
                  props: {
                    title: 'Persona-System-KPI Triad',
                    description: 'Connect stakeholders to system elements and metrics',
                    children: [
                      {
                        type: 'component',
                        component: 'TriadMapper',
                        version: 1,
                        props: {
                          personas: data.personas || [],
                          systemEntities: data.systemMap?.entities || [],
                          kpis: data.kpis || [],
                        },
                      },
                    ],
                  },
                },

                // Discovery Questions
                {
                  type: 'component',
                  component: 'Card',
                  version: 1,
                  props: {
                    title: 'Discovery Questions',
                    children: [
                      {
                        type: 'component',
                        component: 'DiscoveryQuestionnaire',
                        version: 1,
                        props: {
                          stage: 'opportunity',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },

          // Right Column: System Mapping
          {
            type: 'component',
            component: 'Stack',
            version: 1,
            props: {
              gap: 4,
              children: ([
                // System Map Canvas
                {
                  type: 'component',
                  component: 'Card',
                  version: 1,
                  props: {
                    title: 'System Map',
                    description: 'Visualize the opportunity system',
                    children: [
                      data.systemMap
                        ? {
                            type: 'component',
                            component: 'SystemMapCanvas',
                            version: 1,
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
                            type: 'component',
                            component: 'EmptyState',
                            version: 1,
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
                },

                // System Insights
                data.systemMap && {
                  type: 'component',
                  component: 'Card',
                  version: 1,
                  props: {
                    title: 'System Insights',
                    children: [
                      {
                        type: 'component',
                        component: 'SystemInsightsPanel',
                        version: 1,
                        props: {
                          systemMap: data.systemMap,
                        },
                      },
                    ],
                  },
                },

                // Leverage Points
                data.systemMap && data.systemMap.leverage_points.length > 0 && {
                  type: 'component',
                  component: 'Card',
                  version: 1,
                  props: {
                    title: 'Leverage Points',
                    description: 'High-impact intervention opportunities',
                    children: [
                      {
                        type: 'component',
                        component: 'LeveragePointsList',
                        version: 1,
                        props: {
                          leveragePoints: data.systemMap.leverage_points,
                        },
                      },
                    ],
                  },
                },
              ].filter(Boolean) as any[]),
            },
          },
        ],
      },
    },

    // Actions Footer
    {
      type: 'component',
      component: 'ActionBar',
      version: 1,
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
    type: 'page',
    version: 1,
    sections,
    metadata: {
      theme: 'dark',
      lifecycle_stage: 'opportunity',
      sofEnabled: true,
      requiresSystemMap: true,
    },
  };
}

export default generateSOFOpportunityPage;
