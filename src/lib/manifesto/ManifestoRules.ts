export interface ManifestoRule {
  id: string;
  principle: string;
  description: string;
  validations: ValidationRule[];
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ValidationRule {
  name: string;
  check: (artifact: any) => boolean;
  errorMessage: string;
}

export const MANIFESTO_RULES: ManifestoRule[] = [
  {
    id: 'RULE_001',
    principle: 'Value is defined by customer outcomes',
    description: 'Every artifact must answer: What business outcome does this enable?',
    severity: 'critical',
    validations: [
      {
        name: 'has_business_outcome',
        check: (artifact) => {
          return artifact.business_outcome && artifact.business_outcome.length > 0;
        },
        errorMessage: 'Artifact must define a clear business outcome'
      },
      {
        name: 'no_feature_language',
        check: (artifact) => {
          const featureKeywords = ['feature', 'functionality', 'capability', 'tool'];
          const text = JSON.stringify(artifact).toLowerCase();
          return !featureKeywords.some(keyword => text.includes(`the ${keyword}`));
        },
        errorMessage: 'Avoid feature-centric language; focus on outcomes'
      }
    ]
  },
  {
    id: 'RULE_002',
    principle: 'Value must be unified across the enterprise',
    description: 'Single value language, definitions, and calculations across all teams',
    severity: 'critical',
    validations: [
      {
        name: 'uses_standard_kpis',
        check: (artifact) => {
          return artifact.kpis && Array.isArray(artifact.kpis);
        },
        errorMessage: 'KPIs must be from standardized Value Fabric definitions'
      },
      {
        name: 'consistent_roi_calculation',
        check: (artifact) => {
          if (!artifact.roi_model) return true;
          return artifact.roi_model.methodology === 'standard';
        },
        errorMessage: 'ROI calculations must use standardized methodology'
      }
    ]
  },
  {
    id: 'RULE_003',
    principle: 'Standardize structure, personalize application',
    description: 'Core architecture is consistent; personalization at the edge only',
    severity: 'high',
    validations: [
      {
        name: 'follows_value_tree_structure',
        check: (artifact) => {
          if (!artifact.value_tree) return true;
          return artifact.value_tree.capabilities &&
                 artifact.value_tree.outcomes &&
                 artifact.value_tree.kpis;
        },
        errorMessage: 'Value Tree must follow standard structure: Capabilities → Outcomes → KPIs'
      }
    ]
  },
  {
    id: 'RULE_004',
    principle: 'Quantify value conservatively and credibly',
    description: 'Credibility beats hype; assumptions must be evidence-based and conservative',
    severity: 'critical',
    validations: [
      {
        name: 'has_evidence_for_assumptions',
        check: (artifact) => {
          if (!artifact.assumptions) return true;
          return artifact.assumptions.every((a: any) => a.source && a.source !== 'estimate');
        },
        errorMessage: 'All assumptions must have documented evidence sources'
      },
      {
        name: 'conservative_estimates',
        check: (artifact) => {
          if (!artifact.roi_model) return true;
          return artifact.roi_model.confidence_level === 'conservative' ||
                 artifact.roi_model.confidence_level === 'moderate';
        },
        errorMessage: 'ROI estimates must be conservative or moderate, never aggressive'
      },
      {
        name: 'no_hyperbolic_language',
        check: (artifact) => {
          const hypeWords = ['revolutionary', 'groundbreaking', 'unprecedented', 'guarantee', 'maximize'];
          const text = JSON.stringify(artifact).toLowerCase();
          return !hypeWords.some(word => text.includes(word));
        },
        errorMessage: 'Avoid hyperbolic language that undermines credibility'
      }
    ]
  },
  {
    id: 'RULE_005',
    principle: 'Value spans full customer lifecycle',
    description: 'Opportunity → Target → Realization → Expansion must all be covered',
    severity: 'high',
    validations: [
      {
        name: 'has_lifecycle_stage',
        check: (artifact) => {
          const validStages = ['opportunity', 'target', 'realization', 'expansion'];
          return artifact.lifecycle_stage && validStages.includes(artifact.lifecycle_stage);
        },
        errorMessage: 'Artifact must be associated with a valid lifecycle stage'
      }
    ]
  },
  {
    id: 'RULE_006',
    principle: 'Value must be continuously proven',
    description: 'Realization is a discipline; value must be visible and measurable',
    severity: 'high',
    validations: [
      {
        name: 'has_measurement_plan',
        check: (artifact) => {
          if (artifact.lifecycle_stage !== 'target' && artifact.lifecycle_stage !== 'realization') return true;
          return artifact.measurement_plan && artifact.measurement_plan.metrics;
        },
        errorMessage: 'Target and Realization artifacts must include measurement plans'
      },
      {
        name: 'defines_success_criteria',
        check: (artifact) => {
          if (artifact.lifecycle_stage !== 'target') return true;
          return artifact.success_criteria && artifact.success_criteria.length > 0;
        },
        errorMessage: 'Target artifacts must define clear success criteria'
      }
    ]
  },
  {
    id: 'RULE_007',
    principle: 'Value reduces to revenue, cost, and risk',
    description: 'All business value must map to revenue uplift, cost savings, or risk reduction',
    severity: 'critical',
    validations: [
      {
        name: 'has_value_category',
        check: (artifact) => {
          if (!artifact.financial_impact) return true;
          const validCategories = ['revenue', 'cost', 'risk'];
          return artifact.financial_impact.categories &&
                 artifact.financial_impact.categories.every((c: string) => validCategories.includes(c));
        },
        errorMessage: 'Financial impact must categorize as revenue, cost, or risk'
      },
      {
        name: 'quantifies_financial_impact',
        check: (artifact) => {
          if (artifact.lifecycle_stage !== 'target' && artifact.lifecycle_stage !== 'realization') return true;
          return artifact.financial_impact &&
                 (artifact.financial_impact.revenue_uplift !== undefined ||
                  artifact.financial_impact.cost_savings !== undefined ||
                  artifact.financial_impact.risk_reduction !== undefined);
        },
        errorMessage: 'Target and Realization must quantify financial impact'
      }
    ]
  },
  {
    id: 'RULE_008',
    principle: 'Value is a team sport',
    description: 'Cross-functional participation with seamless handoffs',
    severity: 'medium',
    validations: [
      {
        name: 'has_ownership',
        check: (artifact) => {
          return artifact.owner || artifact.created_by;
        },
        errorMessage: 'Artifact must have clear ownership'
      },
      {
        name: 'has_stakeholders',
        check: (artifact) => {
          return artifact.stakeholders && artifact.stakeholders.length > 0;
        },
        errorMessage: 'Artifact should identify relevant stakeholders'
      }
    ]
  },
  {
    id: 'RULE_009',
    principle: 'Value must be governed',
    description: 'Traceability, auditability, and versioning are mandatory',
    severity: 'high',
    validations: [
      {
        name: 'has_version',
        check: (artifact) => {
          return artifact.version !== undefined;
        },
        errorMessage: 'All value artifacts must be versioned'
      },
      {
        name: 'has_audit_trail',
        check: (artifact) => {
          return artifact.created_at && artifact.updated_at;
        },
        errorMessage: 'Artifacts must maintain audit timestamps'
      },
      {
        name: 'traceable_assumptions',
        check: (artifact) => {
          if (!artifact.assumptions) return true;
          return artifact.assumptions.every((a: any) => a.source && a.rationale);
        },
        errorMessage: 'All assumptions must be traceable with source and rationale'
      }
    ]
  },
  {
    id: 'RULE_010',
    principle: 'Value creates multiplicative impact',
    description: 'Target 2× improvements across pipeline, revenue, and LTV',
    severity: 'medium',
    validations: [
      {
        name: 'targets_significant_impact',
        check: (artifact) => {
          if (!artifact.financial_impact || artifact.lifecycle_stage !== 'target') return true;
          const totalImpact = (artifact.financial_impact.revenue_uplift || 0) +
                             (artifact.financial_impact.cost_savings || 0);
          return totalImpact >= artifact.baseline_spend * 0.5;
        },
        errorMessage: 'Value targets should aim for significant impact (>50% improvement)'
      }
    ]
  }
];

export class ManifestoValidator {
  validateArtifact(artifact: any): {
    isValid: boolean;
    violations: Array<{
      rule: ManifestoRule;
      validation: ValidationRule;
      severity: string;
    }>;
    warnings: Array<{
      rule: ManifestoRule;
      validation: ValidationRule;
      severity: string;
    }>;
  } {
    const violations: Array<{ rule: ManifestoRule; validation: ValidationRule; severity: string }> = [];
    const warnings: Array<{ rule: ManifestoRule; validation: ValidationRule; severity: string }> = [];

    for (const rule of MANIFESTO_RULES) {
      for (const validation of rule.validations) {
        try {
          const passed = validation.check(artifact);
          if (!passed) {
            const violation = {
              rule,
              validation,
              severity: rule.severity
            };

            if (rule.severity === 'critical' || rule.severity === 'high') {
              violations.push(violation);
            } else {
              warnings.push(violation);
            }
          }
        } catch (error) {
          console.error(`Validation error for rule ${rule.id}:`, error);
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      warnings
    };
  }

  getRuleById(ruleId: string): ManifestoRule | undefined {
    return MANIFESTO_RULES.find(rule => rule.id === ruleId);
  }

  getRulesByPrinciple(principle: string): ManifestoRule[] {
    return MANIFESTO_RULES.filter(rule =>
      rule.principle.toLowerCase().includes(principle.toLowerCase())
    );
  }

  getRulesBySeverity(severity: 'critical' | 'high' | 'medium' | 'low'): ManifestoRule[] {
    return MANIFESTO_RULES.filter(rule => rule.severity === severity);
  }
}

export const manifestoValidator = new ManifestoValidator();
