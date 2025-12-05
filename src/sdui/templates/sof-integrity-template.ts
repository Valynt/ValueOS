/**
 * SOF Integrity Page Template
 * 
 * Extended Integrity template with Governance Integration and System Health Monitoring.
 */

import type { SDUIPageDefinition } from '../types';
import type { SystemMap, InterventionPoint, FeedbackLoop } from '../../types/sof';

/**
 * Generate SOF-enhanced Integrity page
 */
export function generateSOFIntegrityPage(data: {
  businessCase: any;
  systemMap: SystemMap;
  interventionPoint: InterventionPoint;
  feedbackLoops: FeedbackLoop[];
  integrityData?: {
    governanceControls: any[];
    auditTrail: any[];
    systemHealthScore?: number;
    complianceStatus?: 'compliant' | 'at-risk' | 'non-compliant';
  };
}): SDUIPageDefinition {
  const allLoops = data.feedbackLoops || [];
  const activeLoops = allLoops.filter((loop) => loop.realization_stage === 'active');
  const closedLoops = allLoops.filter((loop) => loop.closure_status === 'closed');

  const components: SDUIPageDefinition['components'] = [
    // Header
    {
      type: 'PageHeader',
      props: {
        title: 'Integrity & Governance',
        subtitle: 'Monitor system health and ensure compliance',
        breadcrumbs: [
          { label: 'Home', href: '/' },
          { label: 'Opportunities', href: '/opportunities' },
          { label: data.businessCase?.name || 'Business Case' },
          { label: 'Integrity' },
        ],
      },
    },

    // System Health Overview
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
            label: 'System Health',
            value: `${data.integrityData?.systemHealthScore || 0}%`,
            icon: 'heart',
            color: data.integrityData?.systemHealthScore >= 80 ? 'green' : 
                   data.integrityData?.systemHealthScore >= 60 ? 'yellow' : 'red',
          },
        },
        {
          type: 'StatCard',
          props: {
            label: 'Compliance Status',
            value: data.integrityData?.complianceStatus || 'unknown',
            icon: 'shield',
            color: data.integrityData?.complianceStatus === 'compliant' ? 'green' :
                   data.integrityData?.complianceStatus === 'at-risk' ? 'yellow' : 'red',
          },
        },
        {
          type: 'StatCard',
          props: {
            label: 'Active Controls',
            value: data.integrityData?.governanceControls?.length || 0,
            icon: 'lock',
            color: 'blue',
          },
        },
        {
          type: 'StatCard',
          props: {
            label: 'Audit Events',
            value: data.integrityData?.auditTrail?.length || 0,
            icon: 'file-text',
            color: 'purple',
          },
        },
      ],
    },

    // Main Content
    {
      type: 'Tabs',
      props: {
        defaultTab: 'health',
      },
      children: [
        // System Health Tab
        {
          type: 'TabPanel',
          props: {
            id: 'health',
            label: 'System Health',
            icon: 'activity',
          },
          children: [
            {
              type: 'Stack',
              props: { gap: 4 },
              children: [
                // Overall System Health
                {
                  type: 'Card',
                  props: {
                    title: 'System Health Dashboard',
                    description: 'Real-time system stability and performance',
                  },
                  children: [
                    {
                      type: 'SystemHealthDashboard',
                      props: {
                        systemMap: data.systemMap,
                        feedbackLoops: allLoops,
                        interventionPoint: data.interventionPoint,
                        healthScore: data.integrityData?.systemHealthScore,
                      },
                    },
                  ],
                },

                // Feedback Loop Health
                {
                  type: 'Card',
                  props: {
                    title: 'Feedback Loop Health',
                    description: 'Status of all feedback loops',
                  },
                  children: [
                    {
                      type: 'FeedbackLoopHealthTable',
                      props: {
                        loops: allLoops,
                        showMetrics: true,
                      },
                    },
                  ],
                },

                // System Drift Detection
                {
                  type: 'Card',
                  props: {
                    title: 'System Drift Detection',
                    description: 'Identify deviations from expected behavior',
                  },
                  children: [
                    {
                      type: 'SystemDriftMonitor',
                      props: {
                        systemMap: data.systemMap,
                        feedbackLoops: allLoops,
                        interventionPoint: data.interventionPoint,
                      },
                    },
                  ],
                },

                // Health Alerts
                {
                  type: 'Card',
                  props: {
                    title: 'Health Alerts',
                    description: 'Active warnings and recommendations',
                  },
                  children: [
                    {
                      type: 'HealthAlertList',
                      props: {
                        systemMap: data.systemMap,
                        feedbackLoops: allLoops,
                        healthScore: data.integrityData?.systemHealthScore,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },

        // Governance Tab
        {
          type: 'TabPanel',
          props: {
            id: 'governance',
            label: 'Governance',
            icon: 'shield',
          },
          children: [
            {
              type: 'Stack',
              props: { gap: 4 },
              children: [
                // Governance Controls
                {
                  type: 'Card',
                  props: {
                    title: 'Active Governance Controls',
                    description: 'Policies and controls applied to this system',
                  },
                  children: [
                    {
                      type: 'GovernanceControlList',
                      props: {
                        controls: data.integrityData?.governanceControls || [],
                        systemMap: data.systemMap,
                        interventionPoint: data.interventionPoint,
                      },
                    },
                  ],
                },

                // Compliance Matrix
                {
                  type: 'Card',
                  props: {
                    title: 'Compliance Matrix',
                    description: 'Compliance status across all requirements',
                  },
                  children: [
                    {
                      type: 'ComplianceMatrix',
                      props: {
                        controls: data.integrityData?.governanceControls || [],
                        complianceStatus: data.integrityData?.complianceStatus,
                      },
                    },
                  ],
                },

                // Risk Register
                {
                  type: 'Card',
                  props: {
                    title: 'Risk Register',
                    description: 'Identified risks and mitigation strategies',
                  },
                  children: [
                    {
                      type: 'RiskRegister',
                      props: {
                        systemMap: data.systemMap,
                        interventionPoint: data.interventionPoint,
                        feedbackLoops: allLoops,
                      },
                    },
                  ],
                },

                // Control Effectiveness
                {
                  type: 'Card',
                  props: {
                    title: 'Control Effectiveness',
                    description: 'Measure how well controls are working',
                  },
                  children: [
                    {
                      type: 'ControlEffectivenessChart',
                      props: {
                        controls: data.integrityData?.governanceControls || [],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },

        // Audit Trail Tab
        {
          type: 'TabPanel',
          props: {
            id: 'audit',
            label: 'Audit Trail',
            icon: 'file-text',
          },
          children: [
            {
              type: 'Stack',
              props: { gap: 4 },
              children: [
                // Audit Timeline
                {
                  type: 'Card',
                  props: {
                    title: 'Audit Event Timeline',
                    description: 'Chronological record of all system changes',
                  },
                  children: [
                    {
                      type: 'AuditTimeline',
                      props: {
                        auditTrail: data.integrityData?.auditTrail || [],
                        systemMap: data.systemMap,
                      },
                    },
                  ],
                },

                // Change Log
                {
                  type: 'Card',
                  props: {
                    title: 'System Change Log',
                    description: 'Detailed log of system modifications',
                  },
                  children: [
                    {
                      type: 'SystemChangeLog',
                      props: {
                        auditTrail: data.integrityData?.auditTrail || [],
                        feedbackLoops: allLoops,
                      },
                    },
                  ],
                },

                // Audit Report Generator
                {
                  type: 'Card',
                  props: {
                    title: 'Generate Audit Report',
                    description: 'Create comprehensive audit documentation',
                  },
                  children: [
                    {
                      type: 'AuditReportGenerator',
                      props: {
                        systemMap: data.systemMap,
                        interventionPoint: data.interventionPoint,
                        feedbackLoops: allLoops,
                        auditTrail: data.integrityData?.auditTrail || [],
                        governanceControls: data.integrityData?.governanceControls || [],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },

        // System Evolution Tab
        {
          type: 'TabPanel',
          props: {
            id: 'evolution',
            label: 'System Evolution',
            icon: 'trending-up',
          },
          children: [
            {
              type: 'Stack',
              props: { gap: 4 },
              children: [
                // System Evolution Timeline
                {
                  type: 'Card',
                  props: {
                    title: 'System Evolution Over Time',
                    description: 'How the system has changed since intervention',
                  },
                  children: [
                    {
                      type: 'SystemEvolutionTimeline',
                      props: {
                        systemMap: data.systemMap,
                        feedbackLoops: allLoops,
                        auditTrail: data.integrityData?.auditTrail || [],
                      },
                    },
                  ],
                },

                // Intervention Impact Analysis
                {
                  type: 'Card',
                  props: {
                    title: 'Intervention Impact Analysis',
                    description: 'Long-term effects of the intervention',
                  },
                  children: [
                    {
                      type: 'InterventionImpactAnalysis',
                      props: {
                        interventionPoint: data.interventionPoint,
                        feedbackLoops: allLoops,
                        systemMap: data.systemMap,
                      },
                    },
                  ],
                },

                // Lessons Learned
                {
                  type: 'Card',
                  props: {
                    title: 'Lessons Learned',
                    description: 'Key insights from this intervention',
                  },
                  children: [
                    {
                      type: 'LessonsLearnedCapture',
                      props: {
                        systemMap: data.systemMap,
                        interventionPoint: data.interventionPoint,
                        feedbackLoops: allLoops,
                      },
                    },
                  ],
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
            label: 'Back to Expansion',
            variant: 'secondary',
            onClick: 'backToExpansion',
          },
          {
            label: 'Export Audit Report',
            variant: 'secondary',
            onClick: 'exportAuditReport',
          },
          {
            label: 'Add Governance Control',
            variant: 'secondary',
            onClick: 'addGovernanceControl',
          },
          {
            label: 'Complete Business Case',
            variant: 'primary',
            onClick: 'completeBusinessCase',
            disabled: data.integrityData?.complianceStatus !== 'compliant',
          },
        ],
      },
    },
  ].filter(Boolean);

  return {
    type: 'IntegrityPage',
    layout: 'default',
    components,
    metadata: {
      stage: 'integrity',
      sofEnabled: true,
      requiresGovernance: true,
      tracksCompliance: true,
      supportsAudit: true,
    },
  };
}

export default generateSOFIntegrityPage;
