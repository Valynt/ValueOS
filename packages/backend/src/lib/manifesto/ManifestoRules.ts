/**
 * Manifesto Rules Engine
 */

export interface ManifestoRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (data: any) => boolean;
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
