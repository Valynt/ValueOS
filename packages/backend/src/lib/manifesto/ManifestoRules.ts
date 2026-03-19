/**
 * Manifesto Rules Engine
 */

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: string;
  validator?: (value: unknown) => boolean;
  message?: string;
}

export interface ManifestoRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (data: unknown) => boolean;
}

export const MANIFESTO_RULES: ManifestoRule[] = [
  {
    id: 'MAN-001',
    name: 'RequireOrganizationId',
    description: 'All operations must have organization_id',
    severity: 'error',
    check: (data) => !!data.organization_id,
  },
];
