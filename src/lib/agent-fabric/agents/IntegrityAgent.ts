/**
 * Integrity Agent
 *
 * VOS Cross-Cutting Concern: MANIFESTO COMPLIANCE
 *
 * Validates all agent outputs against VOS manifesto principles.
 *
 * Manifesto Rules:
 * 1. All value must reduce to revenue, cost, or risk
 * 2. All assumptions must be conservative and sourced
 * 3. All KPIs must exist in Value Fabric ontology
 * 4. All logic must be explainable with reasoning traces
 * 5. All financial claims must have calculation provenance
 *
 * Responsibilities:
 * - Validate value reduction to financial outcomes
 * - Check assumption quality and sourcing
 * - Verify KPI existence in ontology
 * - Audit calculation logic and formulas
 * - Generate compliance reports
 * - Block non-compliant outputs
 */

import { BaseAgent } from './BaseAgent';
import { ValueFabricService } from '../../../services/ValueFabricService';
import { ROIFormulaInterpreter } from '../../../services/ROIFormulaInterpreter';
import type {
  ManifestoValidationResult,
  ManifestoComplianceReport,
  ValueTree,
  ROIModel
} from '../../../types/vos';

export interface IntegrityCheckInput {
  artifact_type: 'value_tree' | 'roi_model' | 'value_commit' | 'realization_report' | 'expansion_model';
  artifact_id: string;
  artifact_data: any;
}

export interface IntegrityCheckOutput {
  compliance_report: ManifestoComplianceReport;
  is_compliant: boolean;
  blocking_issues: string[];
}

export class IntegrityAgent extends BaseAgent {
  private valueFabricService: ValueFabricService;
  private roiInterpreter: ROIFormulaInterpreter;

  constructor(
    agentId: string,
    llmGateway: any,
    memorySystem: any,
    auditLogger: any,
    supabase: any
  ) {
    super(agentId, llmGateway, memorySystem, auditLogger, supabase);
    this.valueFabricService = new ValueFabricService(supabase);
    this.roiInterpreter = new ROIFormulaInterpreter(supabase);
  }

  async execute(
    sessionId: string,
    input: IntegrityCheckInput
  ): Promise<IntegrityCheckOutput> {
    const startTime = Date.now();

    const results: ManifestoValidationResult[] = [];

    results.push(await this.validateValueReduction(input));

    results.push(await this.validateAssumptionQuality(input));

    results.push(await this.validateKPIExistence(input));

    results.push(await this.validateExplainability(input));

    if (input.artifact_type === 'roi_model') {
      results.push(await this.validateFormulaProvenance(input));
    }

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    const overallCompliance = results.every(r => r.passed);

    const blockingIssues = results
      .filter(r => !r.passed)
      .map(r => `${r.rule_name}: ${r.message}`);

    const complianceReport: ManifestoComplianceReport = {
      validated_at: new Date().toISOString(),
      overall_compliance: overallCompliance,
      total_rules: totalCount,
      passed_rules: passedCount,
      failed_rules: totalCount - passedCount,
      results
    };

    const durationMs = Date.now() - startTime;

    await this.logMetric(sessionId, 'latency_ms', durationMs, 'ms');
    await this.logMetric(sessionId, 'rules_passed', passedCount, 'count');
    await this.logMetric(sessionId, 'rules_failed', totalCount - passedCount, 'count');
    await this.logMetric(sessionId, 'compliance_score', (passedCount / totalCount) * 100, 'percent');
    await this.logPerformanceMetric(sessionId, 'integrity_execute', durationMs, {
      rules_checked: totalCount,
      failures: totalCount - passedCount,
    });

    await this.logExecution(
      sessionId,
      'manifesto_compliance_check',
      input,
      {
        artifact_type: input.artifact_type,
        overall_compliance: overallCompliance,
        compliance_score: (passedCount / totalCount) * 100
      },
      `Validated ${totalCount} manifesto rules`,
      overallCompliance ? 'high' : 'low',
      [{
        type: 'compliance_validation',
        passed: passedCount,
        failed: totalCount - passedCount
      }]
    );

    await this.logProvenanceAudit({
      session_id: sessionId,
      agent_id: this.agent.id,
      artifact_type: input.artifact_type,
      artifact_id: input.artifact_id,
      action: 'manifesto_compliance_check',
      reasoning_trace: JSON.stringify(results),
      artifact_data: input.artifact_data,
      output_snapshot: { compliance_report: complianceReport },
      metadata: {
        blocking_issues: blockingIssues,
        is_compliant: overallCompliance
      }
    });

    if (!overallCompliance) {
      await this.memorySystem.storeSemanticMemory(
        sessionId,
        this.agentId,
        `COMPLIANCE FAILURE: ${input.artifact_type} ${input.artifact_id}`,
        { blocking_issues: blockingIssues }
      );
    }

    if (overallCompliance || true) {
      await this.stampArtifactWithCompliance(
        input.artifact_type,
        input.artifact_id,
        complianceReport
      );
    }

    return {
      compliance_report: complianceReport,
      is_compliant: overallCompliance,
      blocking_issues: blockingIssues
    };
  }

  private async stampArtifactWithCompliance(
    artifactType: string,
    artifactId: string,
    complianceReport: ManifestoComplianceReport
  ): Promise<void> {
    const tableMap: Record<string, string> = {
      'value_tree': 'value_trees',
      'roi_model': 'roi_models',
      'value_commit': 'value_commits',
      'realization_report': 'realization_reports',
      'expansion_model': 'expansion_models'
    };

    const tableName = tableMap[artifactType];
    if (!tableName) {
      console.warn(`Unknown artifact type for compliance stamping: ${artifactType}`);
      return;
    }

    try {
      const { error } = await this.supabase
        .from(tableName)
        .update({ compliance_metadata: complianceReport })
        .eq('id', artifactId);

      if (error) {
        console.error(`Failed to stamp compliance metadata on ${tableName}:`, error);
      }
    } catch (err) {
      console.error(`Error stamping compliance metadata:`, err);
    }
  }

  /**
   * Rule 1: All value must reduce to revenue, cost, or risk
   */
  private async validateValueReduction(input: IntegrityCheckInput): Promise<ManifestoValidationResult> {
    const evidence: any[] = [];

    if (input.artifact_type === 'value_tree') {
      const { data: nodes } = await this.supabase
        .from('value_tree_nodes')
        .select('*')
        .eq('value_tree_id', input.artifact_id)
        .eq('type', 'financialMetric');

      const hasFinancialMetrics = nodes && nodes.length > 0;

      if (hasFinancialMetrics) {
        evidence.push(...nodes.map(n => ({ node_label: n.label, type: n.type })));
      }

      return {
        rule_id: 'value_reduction',
        rule_name: 'Value Reduction to Financial Outcomes',
        passed: hasFinancialMetrics,
        message: hasFinancialMetrics
          ? `Value tree contains ${nodes.length} financial metric nodes`
          : 'Value tree missing financial metric nodes (revenue/cost/risk)',
        evidence
      };
    }

    return {
      rule_id: 'value_reduction',
      rule_name: 'Value Reduction to Financial Outcomes',
      passed: true,
      message: 'Not applicable to this artifact type',
      evidence: []
    };
  }

  /**
   * Rule 2: All assumptions must be conservative and sourced
   */
  private async validateAssumptionQuality(input: IntegrityCheckInput): Promise<ManifestoValidationResult> {
    const evidence: any[] = [];

    if (input.artifact_type === 'roi_model') {
      const { data: roiModel } = await this.supabase
        .from('roi_models')
        .select('assumptions')
        .eq('id', input.artifact_id)
        .single();

      if (!roiModel || !roiModel.assumptions || roiModel.assumptions.length === 0) {
        return {
          rule_id: 'assumption_quality',
          rule_name: 'Assumption Quality and Sourcing',
          passed: false,
          message: 'ROI model missing assumptions',
          evidence: []
        };
      }

      const assumptionsWithSources = roiModel.assumptions.filter((a: string) =>
        a.toLowerCase().includes('source:') ||
        a.toLowerCase().includes('based on') ||
        a.toLowerCase().includes('according to')
      );

      const hasSources = assumptionsWithSources.length >= roiModel.assumptions.length * 0.5;

      evidence.push(...roiModel.assumptions.map((a: string) => ({ assumption: a })));

      return {
        rule_id: 'assumption_quality',
        rule_name: 'Assumption Quality and Sourcing',
        passed: hasSources,
        message: hasSources
          ? `${assumptionsWithSources.length}/${roiModel.assumptions.length} assumptions have sources`
          : `Only ${assumptionsWithSources.length}/${roiModel.assumptions.length} assumptions have sources (need 50%+)`,
        evidence
      };
    }

    return {
      rule_id: 'assumption_quality',
      rule_name: 'Assumption Quality and Sourcing',
      passed: true,
      message: 'Not applicable to this artifact type',
      evidence: []
    };
  }

  /**
   * Rule 3: All KPIs must exist in Value Fabric ontology
   */
  private async validateKPIExistence(input: IntegrityCheckInput): Promise<ManifestoValidationResult> {
    const evidence: any[] = [];

    if (input.artifact_type === 'value_tree') {
      const { data: kpiNodes } = await this.supabase
        .from('value_tree_nodes')
        .select('label, reference_id')
        .eq('value_tree_id', input.artifact_id)
        .eq('type', 'kpi');

      if (!kpiNodes || kpiNodes.length === 0) {
        return {
          rule_id: 'kpi_existence',
          rule_name: 'KPI Ontology Existence',
          passed: false,
          message: 'Value tree contains no KPI nodes',
          evidence: []
        };
      }

      let validKpis = 0;

      for (const node of kpiNodes) {
        if (node.reference_id) {
          const { data: kpi } = await this.supabase
            .from('kpi_hypotheses')
            .select('id, kpi_name')
            .eq('id', node.reference_id)
            .maybeSingle();

          if (kpi) {
            validKpis++;
            evidence.push({ kpi_name: kpi.kpi_name, exists: true });
          } else {
            evidence.push({ kpi_name: node.label, exists: false });
          }
        }
      }

      const allValid = validKpis === kpiNodes.length;

      return {
        rule_id: 'kpi_existence',
        rule_name: 'KPI Ontology Existence',
        passed: allValid,
        message: allValid
          ? `All ${kpiNodes.length} KPIs exist in ontology`
          : `Only ${validKpis}/${kpiNodes.length} KPIs exist in ontology`,
        evidence
      };
    }

    return {
      rule_id: 'kpi_existence',
      rule_name: 'KPI Ontology Existence',
      passed: true,
      message: 'Not applicable to this artifact type',
      evidence: []
    };
  }

  /**
   * Rule 4: All logic must be explainable with reasoning traces
   */
  private async validateExplainability(input: IntegrityCheckInput): Promise<ManifestoValidationResult> {
    const hasReasoningField = input.artifact_data.reasoning !== undefined;

    const hasExplanation = hasReasoningField &&
      typeof input.artifact_data.reasoning === 'string' &&
      input.artifact_data.reasoning.length > 50;

    return {
      rule_id: 'explainability',
      rule_name: 'Logic Explainability',
      passed: hasExplanation,
      message: hasExplanation
        ? 'Artifact contains detailed reasoning trace'
        : 'Artifact missing reasoning explanation (required: 50+ characters)',
      evidence: hasReasoningField ? [{ reasoning: input.artifact_data.reasoning }] : []
    };
  }

  /**
   * Rule 5: All financial claims must have calculation provenance
   */
  private async validateFormulaProvenance(input: IntegrityCheckInput): Promise<ManifestoValidationResult> {
    const { data: calculations } = await this.supabase
      .from('roi_model_calculations')
      .select('*')
      .eq('roi_model_id', input.artifact_id);

    if (!calculations || calculations.length === 0) {
      return {
        rule_id: 'formula_provenance',
        rule_name: 'Formula Calculation Provenance',
        passed: false,
        message: 'ROI model missing calculation formulas',
        evidence: []
      };
    }

    const evidence: any[] = [];
    let validFormulas = 0;

    for (const calc of calculations) {
      const validation = this.roiInterpreter.validateFormula(calc.formula);

      if (validation.valid) {
        validFormulas++;
        evidence.push({ name: calc.name, formula: calc.formula, valid: true });
      } else {
        evidence.push({ name: calc.name, formula: calc.formula, valid: false, errors: validation.errors });
      }
    }

    const allValid = validFormulas === calculations.length;

    return {
      rule_id: 'formula_provenance',
      rule_name: 'Formula Calculation Provenance',
      passed: allValid,
      message: allValid
        ? `All ${calculations.length} formulas are valid`
        : `Only ${validFormulas}/${calculations.length} formulas are valid`,
      evidence
    };
  }
}
