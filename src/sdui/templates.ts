import { SDUIPageDefinition } from './schema';

export const OpportunityTemplate: SDUIPageDefinition = {
  type: 'page',
  version: 1,
  sections: [
    {
      type: 'component',
      component: 'InfoBanner',
      props: {
        title: 'Opportunity',
        description: 'Business problem',
      },
    },
    {
      type: 'component',
      component: 'DiscoveryCard',
      props: {
        questions: ['KPI?', 'Goal?'],
      },
    },
  ],
};

export const TargetTemplate: SDUIPageDefinition = {
  type: 'page',
  version: 1,
  sections: [
    {
      type: 'component',
      component: 'ValueTreeCard',
      props: {
        title: 'Target Outcomes',
        nodes: ['Reduce Cost', 'Increase Revenue'],
      },
    },
  ],
};

export const RealizationTemplate: SDUIPageDefinition = {
  type: 'page',
  version: 1,
  sections: [
    {
      type: 'component',
      component: 'InfoBanner',
      props: {
        title: 'Realization Tracking',
        description: 'Monitor realized value across initiatives',
      },
    },
    {
      type: 'component',
      component: 'DiscoveryCard',
      props: {
        title: 'Measurement Questions',
        questions: ['What is the baseline?', 'How is uplift captured?', 'Which KPI owners are accountable?'],
      },
    },
  ],
};

export const ExpansionTemplate: SDUIPageDefinition = {
  type: 'page',
  version: 1,
  sections: [
    {
      type: 'component',
      component: 'ExpansionBlock',
      props: {
        gaps: ['Feature Gap A'],
        roi: { revenue: 10000, cost: 2000 },
      },
    },
  ],
};

export const IntegrityTemplate: SDUIPageDefinition = {
  type: 'page',
  version: 2,
  sections: [
    {
      type: 'component',
      component: 'InfoBanner',
      props: {
        title: 'Integrity Check',
        description: 'Manifesto Compliance',
        tone: 'success',
      },
    },
  ],
};

export const SDUITemplates = {
  opportunity: OpportunityTemplate,
  target: TargetTemplate,
  realization: RealizationTemplate,
  expansion: ExpansionTemplate,
  integrity: IntegrityTemplate,
};
