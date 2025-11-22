/**
 * Compliance Validator Service
 * 
 * Validates reports and documents against VOS Manifesto principles.
 * Generates compliance stamps with evidence and confidence scores.
 */

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { ComplianceRule, ComplianceMetadata } from '../components/Compliance/ComplianceStamp';

export interface ValidationContext {
  reportId: string;
  reportType: 'value_commit' | 'roi_model' | 'qbr' | 'value_case';
  content: any;
  userId: string;
  organizationId: string;
}

export interface ManifestoRule {
  id: string;
  name: string;
  category: string;
  description: string;
  validator: (context: ValidationContext) => Promise<{
    passed: boolean;
    evidence: string[];
    confidence: 'high' | 'medium' | 'low';
    details?: string;
  }>;
}

// ============================================================================
// Manifesto Rules
// ============================================================================

const MANIFESTO_RULES: ManifestoRule[] = [
  {
    id: 'value-first-principle',
    name: 'Value-First Principle',
    category: 'Core Principles',
    description: 'Value is defined by customer outcomes, not seller features',
    validator: async (context) => {
      const evidence: string[] = [];
      let passed = true;
      let confidence: 'high' | 'medium' | 'low' = 'high';

      // Check for outcome-focused language
      const content = JSON.stringify(context.content).toLowerCase();
      
      if (content.includes('outcome') || content.includes('result') || content.includes('impact')) {
        evidence.push('Document contains outcome-focused language');
      } else {
        passed = false;
        evidence.push('Missing outcome-focused language');
        confidence = 'low';
      }

      // Check for customer perspective
      if (content.includes('customer') || content.includes('client')) {
        evidence.push('Customer perspective is present');
      } else {
        passed = false;
        evidence.push('Lacks customer perspective');
      }

      // Check for feature-centric language (negative indicator)
      if (content.includes('feature') && !content.includes('outcome')) {
        evidence.push('Warning: Feature-centric language detected without outcomes');
        confidence = 'medium';
      }

      return { passed, evidence, confidence };
    },
  },
  {
    id: 'unified-language',
    name: 'Unified Value Language',
    category: 'Core Principles',
    description: 'Consistent terminology and definitions across all artifacts',
    validator: async (context) => {
      const evidence: string[] = [];
      let passed = true;
      let confidence: 'high' | 'medium' | 'low' = 'high';

      // Check for standard value terminology
      const content = JSON.stringify(context.content).toLowerCase();
      const standardTerms = ['roi', 'kpi', 'baseline', 'target', 'realization'];
      const foundTerms = standardTerms.filter(term => content.includes(term));

      if (foundTerms.length >= 3) {
        evidence.push(`Uses standard value terminology: ${foundTerms.join(', ')}`);
      } else {
        passed = false;
        evidence.push('Insufficient use of standard value terminology');
        confidence = 'medium';
      }

      // Check for consistent metric definitions
      if (context.content.metrics || context.content.kpis) {
        evidence.push('Metrics are explicitly defined');
      }

      return { passed, evidence, confidence };
    },
  },
  {
    id: 'provenance-tracking',
    name: 'Provenance Tracking',
    category: 'Integrity',
    description: 'All claims have documented sources and assumptions',
    validator: async (context) => {
      const evidence: string[] = [];
      let passed = true;
      let confidence: 'high' | 'medium' | 'low' = 'high';

      // Check for assumptions documentation
      if (context.content.assumptions && Array.isArray(context.content.assumptions)) {
        evidence.push(`${context.content.assumptions.length} assumptions documented`);
        
        // Check if assumptions have sources
        const withSources = context.content.assumptions.filter((a: any) => a.source);
        if (withSources.length > 0) {
          evidence.push(`${withSources.length} assumptions have documented sources`);
        } else {
          passed = false;
          evidence.push('Assumptions lack source documentation');
          confidence = 'low';
        }
      } else {
        passed = false;
        evidence.push('No assumptions documented');
        confidence = 'low';
      }

      // Check for data sources
      if (context.content.dataSources || context.content.sources) {
        evidence.push('Data sources are documented');
      }

      return { passed, evidence, confidence };
    },
  },
  {
    id: 'quantified-value',
    name: 'Quantified Value',
    category: 'Measurement',
    description: 'Value is expressed in measurable, quantifiable terms',
    validator: async (context) => {
      const evidence: string[] = [];
      let passed = true;
      let confidence: 'high' | 'medium' | 'low' = 'high';

      // Check for numeric values
      const content = JSON.stringify(context.content);
      const hasNumbers = /\d+/.test(content);

      if (hasNumbers) {
        evidence.push('Contains quantifiable metrics');
      } else {
        passed = false;
        evidence.push('Lacks quantifiable metrics');
        confidence = 'low';
      }

      // Check for financial metrics
      if (context.content.roi || context.content.npv || context.content.payback) {
        evidence.push('Financial metrics are present');
      }

      // Check for KPIs
      if (context.content.kpis && Array.isArray(context.content.kpis)) {
        evidence.push(`${context.content.kpis.length} KPIs defined`);
      } else {
        passed = false;
        evidence.push('No KPIs defined');
        confidence = 'medium';
      }

      return { passed, evidence, confidence };
    },
  },
  {
    id: 'baseline-target',
    name: 'Baseline & Target Definition',
    category: 'Measurement',
    description: 'Clear baseline and target values for all metrics',
    validator: async (context) => {
      const evidence: string[] = [];
      let passed = true;
      let confidence: 'high' | 'medium' | 'low' = 'high';

      // Check for baseline values
      const content = JSON.stringify(context.content).toLowerCase();
      if (content.includes('baseline') || content.includes('current state')) {
        evidence.push('Baseline values are documented');
      } else {
        passed = false;
        evidence.push('Missing baseline values');
        confidence = 'low';
      }

      // Check for target values
      if (content.includes('target') || content.includes('goal')) {
        evidence.push('Target values are documented');
      } else {
        passed = false;
        evidence.push('Missing target values');
        confidence = 'low';
      }

      // Check for measurement period
      if (content.includes('timeline') || content.includes('period') || content.includes('quarter')) {
        evidence.push('Measurement period is defined');
      }

      return { passed, evidence, confidence };
    },
  },
  {
    id: 'stakeholder-alignment',
    name: 'Stakeholder Alignment',
    category: 'Governance',
    description: 'Value proposition aligns with stakeholder personas',
    validator: async (context) => {
      const evidence: string[] = [];
      let passed = true;
      let confidence: 'high' | 'medium' | 'low' = 'high';

      // Check for stakeholder identification
      const content = JSON.stringify(context.content).toLowerCase();
      const personas = ['economic buyer', 'technical buyer', 'end user', 'champion'];
      const foundPersonas = personas.filter(p => content.includes(p));

      if (foundPersonas.length > 0) {
        evidence.push(`Addresses ${foundPersonas.length} stakeholder personas`);
      } else {
        passed = false;
        evidence.push('No stakeholder personas identified');
        confidence = 'medium';
      }

      // Check for approval workflow
      if (context.content.approvals || context.content.stakeholders) {
        evidence.push('Stakeholder approval process documented');
      }

      return { passed, evidence, confidence };
    },
  },
  {
    id: 'risk-mitigation',
    name: 'Risk Mitigation',
    category: 'Governance',
    description: 'Risks are identified and mitigation strategies defined',
    validator: async (context) => {
      const evidence: string[] = [];
      let passed = true;
      let confidence: 'high' | 'medium' | 'low' = 'high';

      // Check for risk documentation
      if (context.content.risks && Array.isArray(context.content.risks)) {
        evidence.push(`${context.content.risks.length} risks identified`);
        
        // Check for mitigation strategies
        const withMitigation = context.content.risks.filter((r: any) => r.mitigation);
        if (withMitigation.length > 0) {
          evidence.push(`${withMitigation.length} risks have mitigation strategies`);
        } else {
          passed = false;
          evidence.push('Risks lack mitigation strategies');
          confidence = 'medium';
        }
      } else {
        passed = false;
        evidence.push('No risks documented');
        confidence = 'low';
      }

      return { passed, evidence, confidence };
    },
  },
  {
    id: 'continuous-tracking',
    name: 'Continuous Tracking',
    category: 'Realization',
    description: 'Mechanisms for ongoing value tracking and reporting',
    validator: async (context) => {
      const evidence: string[] = [];
      let passed = true;
      let confidence: 'high' | 'medium' | 'low' = 'high';

      // Check for tracking mechanisms
      const content = JSON.stringify(context.content).toLowerCase();
      if (content.includes('dashboard') || content.includes('tracking') || content.includes('monitoring')) {
        evidence.push('Tracking mechanisms are defined');
      } else {
        passed = false;
        evidence.push('No tracking mechanisms defined');
        confidence = 'medium';
      }

      // Check for reporting cadence
      if (content.includes('weekly') || content.includes('monthly') || content.includes('quarterly')) {
        evidence.push('Reporting cadence is defined');
      }

      // Check for variance analysis
      if (content.includes('variance') || content.includes('actual vs target')) {
        evidence.push('Variance analysis is included');
      }

      return { passed, evidence, confidence };
    },
  },
];

// ============================================================================
// Compliance Validator Class
// ============================================================================

export class ComplianceValidator {
  /**
   * Validate a report against all Manifesto rules
   */
  async validateReport(context: ValidationContext): Promise<ComplianceMetadata> {
    const rules: ComplianceRule[] = [];
    let totalConfidence = 0;
    let evidenceCount = 0;

    // Run all validators
    for (const rule of MANIFESTO_RULES) {
      const result = await rule.validator(context);
      
      rules.push({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        status: result.passed ? 'passed' : 'failed',
        description: rule.description,
        evidence: result.evidence,
        confidence: result.confidence,
        details: result.details,
      });

      // Calculate confidence score
      const confidenceValue = result.confidence === 'high' ? 1 : result.confidence === 'medium' ? 0.6 : 0.3;
      totalConfidence += confidenceValue;
      evidenceCount += result.evidence.length;
    }

    // Determine overall status
    const passedCount = rules.filter(r => r.status === 'passed').length;
    const failedCount = rules.filter(r => r.status === 'failed').length;
    
    let overallStatus: 'compliant' | 'non-compliant' | 'partial';
    if (failedCount === 0) {
      overallStatus = 'compliant';
    } else if (passedCount === 0) {
      overallStatus = 'non-compliant';
    } else {
      overallStatus = 'partial';
    }

    const metadata: ComplianceMetadata = {
      reportId: context.reportId,
      reportType: context.reportType,
      generatedAt: new Date().toISOString(),
      generatedBy: context.userId,
      manifestoVersion: '1.0.0',
      overallStatus,
      rules,
      evidenceCount,
      confidenceScore: totalConfidence / MANIFESTO_RULES.length,
    };

    // Store compliance result
    await this.storeComplianceResult(metadata, context);

    return metadata;
  }

  /**
   * Store compliance result in database
   */
  private async storeComplianceResult(
    metadata: ComplianceMetadata,
    context: ValidationContext
  ): Promise<void> {
    await supabase.from('compliance_results').insert({
      report_id: context.reportId,
      report_type: context.reportType,
      user_id: context.userId,
      organization_id: context.organizationId,
      overall_status: metadata.overallStatus,
      rules_passed: metadata.rules.filter(r => r.status === 'passed').length,
      rules_failed: metadata.rules.filter(r => r.status === 'failed').length,
      confidence_score: metadata.confidenceScore,
      evidence_count: metadata.evidenceCount,
      manifesto_version: metadata.manifestoVersion,
      rules_detail: metadata.rules,
      created_at: metadata.generatedAt,
    });
  }

  /**
   * Get compliance history for a report
   */
  async getComplianceHistory(reportId: string): Promise<ComplianceMetadata[]> {
    const { data, error } = await supabase
      .from('compliance_results')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(row => ({
      reportId: row.report_id,
      reportType: row.report_type,
      generatedAt: row.created_at,
      generatedBy: row.user_id,
      manifestoVersion: row.manifesto_version,
      overallStatus: row.overall_status,
      rules: row.rules_detail,
      evidenceCount: row.evidence_count,
      confidenceScore: row.confidence_score,
    }));
  }

  /**
   * Get compliance statistics for an organization
   */
  async getComplianceStats(organizationId: string): Promise<{
    totalReports: number;
    compliantReports: number;
    partialReports: number;
    nonCompliantReports: number;
    averageConfidence: number;
    commonFailures: Array<{ rule: string; count: number }>;
  }> {
    const { data, error } = await supabase
      .from('compliance_results')
      .select('*')
      .eq('organization_id', organizationId);

    if (error || !data) {
      return {
        totalReports: 0,
        compliantReports: 0,
        partialReports: 0,
        nonCompliantReports: 0,
        averageConfidence: 0,
        commonFailures: [],
      };
    }

    const totalReports = data.length;
    const compliantReports = data.filter(r => r.overall_status === 'compliant').length;
    const partialReports = data.filter(r => r.overall_status === 'partial').length;
    const nonCompliantReports = data.filter(r => r.overall_status === 'non-compliant').length;
    const averageConfidence = data.reduce((sum, r) => sum + r.confidence_score, 0) / totalReports;

    // Calculate common failures
    const failureCount: Record<string, number> = {};
    data.forEach(result => {
      result.rules_detail.forEach((rule: ComplianceRule) => {
        if (rule.status === 'failed') {
          failureCount[rule.name] = (failureCount[rule.name] || 0) + 1;
        }
      });
    });

    const commonFailures = Object.entries(failureCount)
      .map(([rule, count]) => ({ rule, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalReports,
      compliantReports,
      partialReports,
      nonCompliantReports,
      averageConfidence,
      commonFailures,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const complianceValidator = new ComplianceValidator();
