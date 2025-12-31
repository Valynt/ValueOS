/**
 * SDUI Template Registry
 * 
 * Central export point for all SOF-enhanced lifecycle templates.
 */

export { generateSOFOpportunityPage } from './sof-opportunity-template';
export { generateSOFTargetPage } from './sof-target-template';
export { generateSOFRealizationPage } from './sof-realization-template';
export { generateSOFExpansionPage } from './sof-expansion-template';
export { generateSOFIntegrityPage } from './sof-integrity-template';

/**
 * Template registry for dynamic lookup
 */
export const SOF_TEMPLATES = {
  opportunity: 'sof-opportunity-template',
  target: 'sof-target-template',
  realization: 'sof-realization-template',
  expansion: 'sof-expansion-template',
  integrity: 'sof-integrity-template',
} as const;

export type SOFTemplateType = keyof typeof SOF_TEMPLATES;
