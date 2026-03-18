# Tasks

## 1. Domain Model

- [ ] 1.1 Add `DealContext` Zod schema to `packages/shared/src/domain/`
- [ ] 1.2 Add `Stakeholder` Zod schema to `packages/shared/src/domain/`
- [ ] 1.3 Add `UseCase` Zod schema to `packages/shared/src/domain/`
- [ ] 1.4 Add source classification enum: customer-confirmed, CRM-derived, call-derived, note-derived, benchmark-derived, externally-researched, inferred, manually-overridden

## 2. Database

- [ ] 2.1 Create `deal_contexts` table with tenant_id, opportunity_id, assembled_at, status, context_json
- [ ] 2.2 Create `deal_context_sources` table tracking each ingested source (type, url, ingested_at, fragment_hash)
- [ ] 2.3 Create `stakeholders` table with tenant_id, deal_context_id, name, role, priority, source_type
- [ ] 2.4 Create `use_cases` table with tenant_id, deal_context_id, name, description, pain_signals, source_type
- [ ] 2.5 Add RLS policies using `security.user_has_tenant_access()` on all new tables
- [ ] 2.6 Add indexes on (tenant_id, opportunity_id) for deal_contexts
- [ ] 2.7 Write rollback SQL

## 3. Ingestion Services

- [ ] 3.1 Implement `CRMConnector` — pull opportunity metadata, account profile, contacts from HubSpot
- [ ] 3.2 Implement `TranscriptParser` — extract structured signals (pains, priorities, stakeholder mentions, baseline clues) from call transcripts
- [ ] 3.3 Tag each extracted signal with source type `call-derived`
- [ ] 3.4 Implement `NotesExtractor` — extract signals from seller notes and summaries
- [ ] 3.5 Tag each extracted signal with source type `note-derived`
- [ ] 3.6 Implement `PublicEnrichmentService` — retrieve firmographics, public filings, market data for the account
- [ ] 3.7 Tag enrichment data with source type `externally-researched`
- [ ] 3.8 Add 30-second timeout and circuit breaker to all external calls

## 4. Context Extraction Agent

- [ ] 4.1 Create `ContextExtractionAgent` extending `BaseAgent`
- [ ] 4.2 Define Zod output schema for extracted context (stakeholders, use_cases, pains, baseline_clues, value_driver_candidates, objection_signals, missing_data)
- [ ] 4.3 Implement extraction prompt using Handlebars template
- [ ] 4.4 Use `secureInvoke` with hallucination_check
- [ ] 4.5 Rank value driver candidates by signal strength and evidence availability
- [ ] 4.6 Flag missing critical data points (baseline metrics, customer-confirmed numbers)

## 5. Deal Assembly Agent

- [ ] 5.1 Create `DealAssemblyAgent` extending `BaseAgent`
- [ ] 5.2 Orchestrate: CRM → Transcript → Notes → Public → ContextExtraction → Assemble
- [ ] 5.3 Merge fragments into DealContext with conflict resolution (customer-confirmed > CRM-derived > call-derived > inferred)
- [ ] 5.4 Persist DealContext to Supabase with tenant_id
- [ ] 5.5 Ensure auto-assembled draft is non-empty (no blank starts — V1 design principle §4.2)
- [ ] 5.6 Include at least: inferred context, candidate value drivers, and benchmark references

## 6. Precedent Retrieval

- [ ] 6.1 Implement precedent case lookup — find prior completed value cases in same tenant matching industry/use-case/deal characteristics
- [ ] 6.2 Return top-3 similar cases as reference context
- [ ] 6.3 Ensure precedent data is tenant-scoped (no cross-tenant leakage)

## 7. Workflow Integration

- [ ] 7.1 Add deal assembly DAG to `WorkflowDAGDefinitions.ts`
- [ ] 7.2 Wire DealAssemblyAgent into the discovery lifecycle stage
- [ ] 7.3 Emit `saga.state.transitioned` event on assembly completion
- [ ] 7.4 Add compensation handler (revert DealContext to previous version)

## 8. API Endpoints

- [ ] 8.1 Add `POST /api/cases/:caseId/assemble` — trigger deal assembly for an opportunity
- [ ] 8.2 Add `GET /api/cases/:caseId/context` — retrieve assembled DealContext
- [ ] 8.3 Add `PATCH /api/cases/:caseId/context/gaps` — submit user-provided gap fills
- [ ] 8.4 Validate tenant_id on all endpoints

## 9. Tests

- [ ] 9.1 Unit test CRMConnector with mock HubSpot responses
- [ ] 9.2 Unit test TranscriptParser with sample transcript
- [ ] 9.3 Unit test ContextExtractionAgent with mocked LLMGateway
- [ ] 9.4 Unit test DealAssemblyAgent orchestration flow
- [ ] 9.5 Unit test precedent retrieval with tenant isolation
- [ ] 9.6 Integration test: full assembly pipeline from CRM opportunity to DealContext
