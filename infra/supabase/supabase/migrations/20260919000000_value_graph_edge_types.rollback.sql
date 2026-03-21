-- Rollback: Sprint 49 — revert value_graph_edges CHECK constraints to Sprint 48 state

BEGIN;

ALTER TABLE public.value_graph_edges
  DROP CONSTRAINT IF EXISTS value_graph_edges_edge_type_check;

ALTER TABLE public.value_graph_edges
  ADD CONSTRAINT value_graph_edges_edge_type_check
  CHECK (edge_type IN (
    'company_has_persona',
    'persona_executes_use_case',
    'use_case_enabled_by_capability',
    'capability_impacts_metric',
    'metric_maps_to_value_driver',
    'evidence_supports_metric',
    'hypothesis_claims_value_driver'
  ));

ALTER TABLE public.value_graph_edges
  DROP CONSTRAINT IF EXISTS value_graph_edges_from_entity_type_check;

ALTER TABLE public.value_graph_edges
  ADD CONSTRAINT value_graph_edges_from_entity_type_check
  CHECK (from_entity_type IN (
    'account', 'stakeholder', 'use_case',
    'vg_capability', 'vg_metric', 'vg_value_driver',
    'evidence', 'value_hypothesis'
  ));

ALTER TABLE public.value_graph_edges
  DROP CONSTRAINT IF EXISTS value_graph_edges_to_entity_type_check;

ALTER TABLE public.value_graph_edges
  ADD CONSTRAINT value_graph_edges_to_entity_type_check
  CHECK (to_entity_type IN (
    'account', 'stakeholder', 'use_case',
    'vg_capability', 'vg_metric', 'vg_value_driver',
    'evidence', 'value_hypothesis'
  ));

COMMIT;
