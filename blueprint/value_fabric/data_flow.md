# Data Flow Mapping Across Storage Layers

This document describes how data moves through and is represented in the Value Fabric's three storage layers: **JSON Schema (API contracts)**, **Neo4j Graph**, and **PostgreSQL relational database**.

## Overview

1. **API Ingestion** – All agents interact via API endpoints that accept and return JSON adhering to the JSON Schema definitions located in `schema.json`. This schema defines canonical fields and constraints for each entity (e.g., KPIs, ValueTrees, ValueCommits). Validation occurs at the API layer prior to persistence.

2. **Relational Storage (PostgreSQL)** – Upon ingestion, records are persisted to the relational database. Tables mirror the JSON Schema definitions, with normalized forms and foreign keys. Join tables manage many-to-many relationships (e.g., `use_case_capabilities`, `use_case_kpis`). Time-series data such as telemetry events is stored with indexes for efficient range queries.

3. **Graph Storage (Neo4j)** – Key relationships are replicated in the graph database. Entities become nodes labeled according to their type (BusinessObjective, UseCase, KPI, etc.), and relationships (e.g., :CAPABLE_OF, :IMPACTS) model the connections defined in the Value Tree and ROI models. Graph traversal enables agents to query complex dependency structures rapidly.

## Mapping Patterns

| JSON Entity          | PostgreSQL Table(s)                              | Neo4j Node Label / Relationship              |
|--------------------- |------------------------------------------------- |--------------------------------------------- |
| BusinessObjective    | business_objectives                             | (bo:BusinessObjective)                       |
| Capability           | capabilities                                     | (cap:Capability)                             |
| UseCase              | use_cases, use_case_capabilities, use_case_kpis | (uc:UseCase)-[:CAPABLE_OF]->(cap:Capability) |
| KPI                  | kpis                                             | (kpi:KPI)-[:IMPACTS]<-(uc:UseCase)           |
| FinancialMetric      | financial_metrics, kpi_financial_metrics         | (fm:FinancialMetric)<-[:DRIVES]-(kpi:KPI)    |
| ValueTree            | value_trees, value_tree_nodes, value_tree_links | (vt:ValueTree)-[:CONTAINS]->(node:ValueNode) |
| ROIModel             | roi_models, roi_model_calculations               | (roi:ROIModel)-[:MODELS]->(vt:ValueTree)     |
| Benchmark            | benchmarks                                       | (bench:Benchmark)-[:BENCHMARKS]->(kpi:KPI)   |
| ValueCommit          | value_commits, kpi_targets                       | (vc:ValueCommit)-[:COMMITS_TO]->(vt:ValueTree) |
| TelemetryEvent       | telemetry_events                                 | (tm:TelemetryEvent)-[:MEASURES]->(kpi:KPI)   |
| RealizationReport    | realization_reports, realization_results         | (rr:RealizationReport)-[:REPORTS_ON]->(vc:ValueCommit) |
| ExpansionModel       | expansion_models, expansion_improvements         | (ex:ExpansionModel)-[:PROPOSES_IMPROVEMENT_FOR]->(vt:ValueTree) |

## Synchronization

When an entity is created or updated via an API:

1. **Validation** – The JSON payload is validated against `schema.json`.
2. **Relational Insert/Update** – The data is stored in PostgreSQL with the proper foreign key associations.
3. **Graph Upsert** – A corresponding node and relationships are created or updated in Neo4j using the `ontology.cypher` schema as a reference. Idempotent upserts ensure that duplicates are avoided.
4. **Event Emission** – An event (e.g., `value.opportunity.created`) is published to the event bus to notify subscribing agents.

## Notes

- All IDs are UUIDs to avoid collisions across distributed systems.
- JSON payloads use snake_case field names, which map to lowercase table column names and property keys in Neo4j.
- Relational constraints (foreign keys, unique constraints) ensure referential integrity; the graph relies on unique node ids enforced by Neo4j constraints.