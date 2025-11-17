import React, { useState } from 'react';
import { Shield, CheckCircle2, XCircle, AlertTriangle, FileText, Eye, Search, Fingerprint } from 'lucide-react';
import { MetricCard } from '../components/Components/MetricCard';
import { ProvenanceTraceViewer } from '../components/Integrity/ProvenanceTraceViewer';
import type {
  LifecycleArtifactLink,
  ManifestoComplianceReport,
  ManifestoValidationResult,
  ProvenanceAuditEntry
} from '../types/vos';

export const IntegrityCompliancePage: React.FC = () => {
  const [selectedArtifact, setSelectedArtifact] = useState<string>('value_tree_001');

  const lineageLinks: LifecycleArtifactLink[] = [
    {
      id: 'link-1',
      session_id: 'sess-01',
      source_stage: 'opportunity',
      source_type: 'discovery_brief',
      source_artifact_id: 'disc-01',
      target_stage: 'target',
      target_type: 'business_objective',
      target_artifact_id: 'obj-01',
      relationship_type: 'opportunity_to_target',
      reasoning_trace: 'Objectives derived from discovery notes with conservative sizing.',
      chain_depth: 0,
      metadata: { owner: 'OpportunityAgent' },
      created_at: new Date().toISOString()
    },
    {
      id: 'link-2',
      session_id: 'sess-01',
      source_stage: 'target',
      source_type: 'business_objective',
      source_artifact_id: 'obj-01',
      target_stage: 'target',
      target_type: 'value_tree',
      target_artifact_id: 'value_tree_001',
      relationship_type: 'target_model',
      reasoning_trace: 'Value tree nodes mapped to the quantified objectives.',
      chain_depth: 1,
      metadata: { owner: 'TargetAgent' },
      created_at: new Date().toISOString()
    },
    {
      id: 'link-3',
      session_id: 'sess-01',
      source_stage: 'target',
      source_type: 'value_tree',
      source_artifact_id: 'value_tree_001',
      target_stage: 'target',
      target_type: 'roi_model',
      target_artifact_id: 'roi_model_002',
      relationship_type: 'calculation_model',
      reasoning_trace: 'ROI formulas reference KPI deltas defined in the value tree.',
      chain_depth: 2,
      metadata: { owner: 'TargetAgent' },
      created_at: new Date().toISOString()
    },
    {
      id: 'link-4',
      session_id: 'sess-01',
      source_stage: 'target',
      source_type: 'roi_model',
      source_artifact_id: 'roi_model_002',
      target_stage: 'target',
      target_type: 'value_commit',
      target_artifact_id: 'value_commit_003',
      relationship_type: 'commitment',
      reasoning_trace: 'Value commitments anchored to ROI model outputs and KPI targets.',
      chain_depth: 3,
      metadata: { owner: 'TargetAgent' },
      created_at: new Date().toISOString()
    },
    {
      id: 'link-5',
      session_id: 'sess-01',
      source_stage: 'target',
      source_type: 'value_commit',
      source_artifact_id: 'value_commit_003',
      target_stage: 'realization',
      target_type: 'realization_report',
      target_artifact_id: 'realization_004',
      relationship_type: 'realization',
      reasoning_trace: 'Telemetry validation compares realized KPIs to ROI projections.',
      chain_depth: 4,
      metadata: { owner: 'RealizationAgent' },
      created_at: new Date().toISOString()
    },
    {
      id: 'link-6',
      session_id: 'sess-01',
      source_stage: 'realization',
      source_type: 'realization_report',
      source_artifact_id: 'realization_004',
      target_stage: 'expansion',
      target_type: 'expansion_model',
      target_artifact_id: 'expansion_005',
      relationship_type: 'expansion',
      reasoning_trace: 'Expansion opportunities generated from realized KPI deltas.',
      chain_depth: 5,
      metadata: { owner: 'ExpansionAgent' },
      created_at: new Date().toISOString()
    }
  ];

  const provenanceAudits: ProvenanceAuditEntry[] = [
    {
      id: 'audit-1',
      session_id: 'sess-01',
      agent_id: 'integrity-agent',
      artifact_type: 'roi_model',
      artifact_id: 'roi_model_002',
      action: 'manifesto_compliance_check',
      reasoning_trace: 'Validated calculation provenance and explainability traces.',
      artifact_data: { rule: 'formula_provenance' },
      input_variables: {
        annual_time_savings_hours: 'value_tree.kpi_nodes',
        hourly_rate: 'benchmark:finance:blended_rate'
      },
      output_snapshot: { compliance_score: 92 },
      metadata: { outcome: 'approved' },
      created_at: new Date().toISOString()
    },
    {
      id: 'audit-2',
      session_id: 'sess-01',
      agent_id: 'integrity-agent',
      artifact_type: 'realization_report',
      artifact_id: 'realization_004',
      action: 'manifesto_compliance_check',
      reasoning_trace: 'Realization telemetry confirms ROI projections within tolerance.',
      artifact_data: { rule: 'value_reduction' },
      input_variables: {
        actual_value: 'telemetry:event_stream',
        projected_value: 'roi_model.calculations.total_roi'
      },
      output_snapshot: { variance: '+3%' },
      metadata: { outcome: 'approved' },
      created_at: new Date().toISOString()
    }
  ];

  const mockComplianceReport: ManifestoComplianceReport = {
    validated_at: new Date().toISOString(),
    overall_compliance: false,
    total_rules: 5,
    passed_rules: 3,
    failed_rules: 2,
    results: [
      {
        rule_id: 'value_reduction',
        rule_name: 'Value Reduction to Financial Outcomes',
        passed: true,
        message: 'Value tree contains 3 financial metric nodes',
        evidence: [
          { node_label: 'Cost Reduction', type: 'financialMetric' },
          { node_label: 'Revenue Impact', type: 'financialMetric' }
        ]
      },
      {
        rule_id: 'assumption_quality',
        rule_name: 'Assumption Quality and Sourcing',
        passed: false,
        message: 'Only 3/8 assumptions have sources (need 50%+)',
        evidence: [
          { assumption: 'User adoption will be 85% (Source: Industry Benchmark)' },
          { assumption: 'Implementation will take 3 months' },
          { assumption: 'Efficiency gain of 15%' }
        ]
      },
      {
        rule_id: 'kpi_existence',
        rule_name: 'KPI Ontology Existence',
        passed: true,
        message: 'All 4 KPIs exist in ontology',
        evidence: [
          { kpi_name: 'Time Savings', exists: true },
          { kpi_name: 'Cost per Transaction', exists: true }
        ]
      },
      {
        rule_id: 'explainability',
        rule_name: 'Logic Explainability',
        passed: true,
        message: 'Artifact contains detailed reasoning trace',
        evidence: [
          { reasoning: 'Analysis based on customer discovery calls showing manual process bottlenecks...' }
        ]
      },
      {
        rule_id: 'formula_provenance',
        rule_name: 'Formula Calculation Provenance',
        passed: false,
        message: 'Only 5/7 formulas are valid',
        evidence: [
          { name: 'Annual Savings', formula: 'hours_saved * cost_per_hour * 12', valid: true },
          { name: 'ROI', formula: 'total_value / implementation_cost', valid: true },
          { name: 'Payback Period', formula: 'invalid_formula', valid: false }
        ]
      }
    ]
  };

  const artifacts = [
    { id: 'value_tree_001', type: 'value_tree', name: 'Process Automation Value Tree', compliance: 60, status: 'at_risk' },
    { id: 'roi_model_002', type: 'roi_model', name: 'Q4 2025 ROI Model', compliance: 100, status: 'compliant' },
    { id: 'value_commit_003', type: 'value_commit', name: 'Enterprise Value Commitment', compliance: 80, status: 'compliant' },
    { id: 'realization_004', type: 'realization_report', name: 'Q1 2026 Realization Report', compliance: 100, status: 'compliant' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'bg-green-100 text-green-700 border-green-200';
      case 'at_risk': return 'bg-red-100 text-red-700 border-red-200';
      case 'warning': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getRuleIcon = (passed: boolean) => {
    return passed
      ? <CheckCircle2 className="h-5 w-5 text-green-600" />
      : <XCircle className="h-5 w-5 text-red-600" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Integrity & Compliance</h1>
              <p className="text-gray-600 mt-2">Manifesto compliance validation and artifact integrity checks</p>
            </div>
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span>Run Compliance Scan</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Overall Compliance"
            value="75%"
            trend="up"
            change="3 of 4 artifacts"
          />
          <MetricCard
            title="Rules Passed"
            value="3/5"
            trend="neutral"
            change="60% pass rate"
          />
          <MetricCard
            title="Blocking Issues"
            value="2"
            trend="down"
            change="Critical attention"
          />
          <MetricCard
            title="Last Scan"
            value="2 mins"
            trend="neutral"
            change="Auto-scan enabled"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Manifesto Compliance Report</h2>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Validated:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(mockComplianceReport.validated_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{mockComplianceReport.total_rules}</div>
                    <div className="text-xs text-gray-600 mt-1">Total Rules</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{mockComplianceReport.passed_rules}</div>
                    <div className="text-xs text-gray-600 mt-1">Passed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{mockComplianceReport.failed_rules}</div>
                    <div className="text-xs text-gray-600 mt-1">Failed</div>
                  </div>
                </div>
              </div>

              {!mockComplianceReport.overall_compliance && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-900 mb-1">Compliance Failure - Blocking Issues</h4>
                      <ul className="text-sm text-red-700 space-y-1">
                        <li>• Assumption Quality and Sourcing: Only 3/8 assumptions have sources (need 50%+)</li>
                        <li>• Formula Calculation Provenance: Only 5/7 formulas are valid</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {mockComplianceReport.results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`p-5 rounded-lg border-2 ${
                      result.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getRuleIcon(result.passed)}
                        <div>
                          <h3 className="font-semibold text-gray-900">{result.rule_name}</h3>
                          <p className={`text-sm mt-1 ${result.passed ? 'text-green-700' : 'text-red-700'}`}>
                            {result.message}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        result.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {result.rule_id}
                      </span>
                    </div>

                    {result.evidence && result.evidence.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <Eye className="h-4 w-4 text-gray-500" />
                          <span className="text-xs font-medium text-gray-700">Evidence</span>
                        </div>
                        <div className="space-y-1">
                          {result.evidence.slice(0, 2).map((ev: any, evIdx: number) => (
                            <div key={evIdx} className="text-xs text-gray-600 pl-6">
                              • {JSON.stringify(ev).slice(0, 100)}...
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <FileText className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">VOS Manifesto Rules</h2>
              </div>
              <div className="space-y-3">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">Rule 1: Value Reduction</h4>
                  <p className="text-xs text-gray-600">
                    All value must reduce to revenue, cost, or risk. Every value tree must contain financial metric nodes.
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">Rule 2: Assumption Quality</h4>
                  <p className="text-xs text-gray-600">
                    All assumptions must be conservative and sourced. At least 50% must cite sources.
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">Rule 3: KPI Existence</h4>
                  <p className="text-xs text-gray-600">
                    All KPIs must exist in Value Fabric ontology with canonical definitions.
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">Rule 4: Explainability</h4>
                  <p className="text-xs text-gray-600">
                    All logic must be explainable with reasoning traces (minimum 50 characters).
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">Rule 5: Formula Provenance</h4>
                  <p className="text-xs text-gray-600">
                    All financial claims must have calculation provenance with valid formulas.
                  </p>
                </div>
              </div>
            </div>

            <ProvenanceTraceViewer
              links={lineageLinks}
              audits={provenanceAudits}
              title="Data Lineage & Provenance"
            />

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <Fingerprint className="h-5 w-5 text-gray-700" />
                <h3 className="text-lg font-semibold text-gray-900">ROI Calculation Provenance</h3>
              </div>
              <div className="space-y-3">
                {provenanceAudits.map((audit) => (
                  <div key={audit.id} className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs text-gray-500">{audit.artifact_type}</p>
                        <p className="text-sm font-semibold text-gray-900">{audit.action}</p>
                      </div>
                      <span className="text-[10px] text-gray-500">Session {audit.session_id}</span>
                    </div>
                    {audit.reasoning_trace && (
                      <p className="text-xs text-gray-700 mb-3">{audit.reasoning_trace}</p>
                    )}

                    {audit.input_variables && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(audit.input_variables).map(([name, source]) => (
                          <div key={`${audit.id}-${name}`} className="p-2 bg-white rounded border border-gray-200">
                            <p className="text-xs font-semibold text-gray-900">{name}</p>
                            <p className="text-[10px] text-gray-500">{String(source)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <FileText className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Artifacts</h2>
              </div>
              <div className="space-y-3">
                {artifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    onClick={() => setSelectedArtifact(artifact.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedArtifact === artifact.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 text-sm">{artifact.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(artifact.status)}`}>
                        {artifact.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{artifact.type.replace('_', ' ')}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              artifact.compliance >= 80 ? 'bg-green-500' : artifact.compliance >= 60 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${artifact.compliance}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-semibold text-gray-700">{artifact.compliance}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center space-x-2 mb-4">
                <Shield className="h-5 w-5 text-blue-700" />
                <h3 className="font-semibold text-blue-900">Compliance Actions</h3>
              </div>
              <div className="space-y-2">
                <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                  Fix Blocking Issues
                </button>
                <button className="w-full px-4 py-2 bg-white text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors font-medium text-sm">
                  Export Report
                </button>
                <button className="w-full px-4 py-2 bg-white text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors font-medium text-sm">
                  View Audit Trail
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Compliance Trends</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-gray-600">This Week</span>
                    <span className="font-semibold text-gray-900">75%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: '75%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-gray-600">Last Week</span>
                    <span className="font-semibold text-gray-900">100%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: '100%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-gray-600">2 Weeks Ago</span>
                    <span className="font-semibold text-gray-900">80%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: '80%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
