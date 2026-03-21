-- Migration: Sprint 49 — extend value_graph_edges CHECK constraints
--
-- Adds 5 new edge types for the remaining agents (NarrativeAgent, TargetAgent,
-- RealizationAgent, ExpansionAgent, ComplianceAuditorAgent) and the `narrative`
-- entity type required by NarrativeAgent.
--
-- Strategy: drop the existing CHECK constraints and recreate them with the
-- expanded value sets. Supabase/Postgres does not support ALTER CONSTRAINT,
-- so we use DROP + ADD.

BEGIN;

-- -------------------------------------------------------------------------
-- edge_type CHECK constraint
-- -------------------------------------------------------------------------

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
    'hypothesis_claims_value_driver',
    -- Sprint 49
    'narrative_explains_hypothesis',
    'target_quantifies_driver',
    'realization_tracks_target',
    'expansion_extends_node',
    'audit_verifies_node'
  ));

-- -------------------------------------------------------------------------
-- from_entity_type CHECK constraint — add 'narrative'
-- -------------------------------------------------------------------------

ALTER TABLE public.value_graph_edges
  DROP CONSTRAINT IF EXISTS value_graph_edges_from_entity_type_check;

ALTER TABLE public.value_graph_edges
  ADD CONSTRAINT value_graph_edges_from_entity_type_check
  CHECK (from_entity_type IN (
    'account', 'stakeholder', 'use_case',
    'vg_capability', 'vg_metric', 'vg_value_driver',
    'evidence', 'value_hypothesis',
    -- Sprint 49
    'narrative'
  ));

-- -------------------------------------------------------------------------
-- to_entity_type CHECK constraint — add 'narrative' for completeness
-- -------------------------------------------------------------------------

ALTER TABLE public.value_graph_edges
  DROP CONSTRAINT IF EXISTS value_graph_edges_to_entity_type_check;

ALTER TABLE public.value_graph_edges
  ADD CONSTRAINT value_graph_edges_to_entity_type_check
  CHECK (to_entity_type IN (
    'account', 'stakeholder', 'use_case',
    'vg_capability', 'vg_metric', 'vg_value_driver',
    'evidence', 'value_hypothesis',
    -- Sprint 49
    'narrative'
  ));

COMMIT;
