/*
 * Neo4j Ontology for the Value Fabric
 * Defines node labels, properties, and relationships.
 */

// Business Objectives
CREATE CONSTRAINT IF NOT EXISTS ON (bo:BusinessObjective) ASSERT bo.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS ON (cap:Capability) ASSERT cap.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS ON (uc:UseCase) ASSERT uc.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS ON (kpi:KPI) ASSERT kpi.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS ON (fm:FinancialMetric) ASSERT fm.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS ON (vt:ValueTree) ASSERT vt.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS ON (roi:ROIModel) ASSERT roi.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS ON (vc:ValueCommit) ASSERT vc.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS ON (bench:Benchmark) ASSERT bench.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS ON (tm:TelemetryEvent) ASSERT tm.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS ON (rr:RealizationReport) ASSERT rr.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS ON (ex:ExpansionModel) ASSERT ex.id IS UNIQUE;

// Relationships
// CAPABILITY -> USECASE
// :CAPABLE_OF indicates that a capability enables a use case
CREATE INDEX IF NOT EXISTS FOR (cap:Capability)-[:CAPABLE_OF]->(uc:UseCase) ON (cap.id);

// USECASE -> KPI
// :IMPACTS indicates that a use case influences a KPI
CREATE INDEX IF NOT EXISTS FOR (uc:UseCase)-[:IMPACTS]->(kpi:KPI) ON (uc.id);

// KPI -> FINANCIALMETRIC
// :DRIVES financial metric (revenue, cost, risk)
CREATE INDEX IF NOT EXISTS FOR (kpi:KPI)-[:DRIVES]->(fm:FinancialMetric) ON (kpi.id);

// VALUE TREE nodes relationships
// Each node is modelled as generic Node label with type property; relationships link nodes to children
// Example relationship: (parent:ValueNode)-[:DEPENDS_ON]->(child:ValueNode)

// ROI MODEL -> VALUE TREE
// :MODELS relationship attaches ROIModel to the ValueTree it quantifies
CREATE INDEX IF NOT EXISTS FOR (roi:ROIModel)-[:MODELS]->(vt:ValueTree) ON (roi.id);

// VALUE COMMIT -> VALUE TREE
CREATE INDEX IF NOT EXISTS FOR (vc:ValueCommit)-[:COMMITS_TO]->(vt:ValueTree) ON (vc.id);

// REALIZATION REPORT -> VALUE COMMIT
CREATE INDEX IF NOT EXISTS FOR (rr:RealizationReport)-[:REPORTS_ON]->(vc:ValueCommit) ON (rr.id);

// EXPANSION MODEL -> VALUE TREE
CREATE INDEX IF NOT EXISTS FOR (ex:ExpansionModel)-[:PROPOSES_IMPROVEMENT_FOR]->(vt:ValueTree) ON (ex.id);

// TELEMETRY EVENT -> KPI
CREATE INDEX IF NOT EXISTS FOR (tm:TelemetryEvent)-[:MEASURES]->(kpi:KPI) ON (tm.id);

// BENCHMARK -> KPI
CREATE INDEX IF NOT EXISTS FOR (bench:Benchmark)-[:BENCHMARKS]->(kpi:KPI) ON (bench.id);

/*
Node property templates:
  BusinessObjective: {id, name, description, priority, owner}
  Capability: {id, name, description, tags}
  UseCase: {id, name, description}
  KPI: {id, name, description, measurement, targetDirection}
  FinancialMetric: {id, name, type, currency, unit}
  ValueTree: {id, useCaseId}
  ROIModel: {id, assumptions, version}
  ValueCommit: {id, committedBy, dateCommitted}
  TelemetryEvent: {id, timestamp, value}
  RealizationReport: {id, generatedAt}
  ExpansionModel: {id, executiveSummary}
*/