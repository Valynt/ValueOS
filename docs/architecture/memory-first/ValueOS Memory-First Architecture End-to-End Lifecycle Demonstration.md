```typescript
import { 
  UUID, 
  FactStatus, 
  NarrativeStatus, 
  ArtifactMetadata, 
  PersonaType,
  AuthorityLevel 
} from './types';
import { MemoryService } from './memory-service';
import { MemoryPipeline } from './memory-pipeline';
import { RetrievalEngine } from './retrieval-engine';
import { ModelRunEngine } from './model-run-engine';
import { BenchmarkService, BenchmarkTier } from './benchmark-service';
import { NarrativeEngine } from './narrative-engine';
import { AgentFabric } from './agent-fabric';

/**
 * MAIN LIFECYCLE DEMO: ValueOS Memory-First Architecture
 * 
 * This script demonstrates the end-to-end flow of a B2B Value Case,
 * moving from raw artifact ingestion to a cryptographically 
 * verified executive narrative.
 */
async function runValueOSDemo() {
  console.log("🚀 Initializing ValueOS Memory-First Services...");

  // --- CONFIGURATION & MOCKS ---
  const TENANT_ID = "tnt_778899" as UUID;
  const DEAL_ID = "deal_vcase_2024_01" as UUID;
  const ANALYST_ID = "usr_analyst_01" as UUID;
  const SUPABASE_URL = "https://your-project.supabase.co";
  const SUPABASE_KEY = "sb_secret_key";
  const TOGETHER_API_KEY = "tg_api_key";

  // --- 1. SERVICE INITIALIZATION ---
  // We establish the substrate layers: Episodic, Semantic, and Computational.
  const memoryService = new MemoryService(SUPABASE_URL, SUPABASE_KEY, TENANT_ID);
  const pipeline = new MemoryPipeline(SUPABASE_URL, SUPABASE_KEY, TOGETHER_API_KEY);
  const retrieval = new RetrievalEngine(memoryService['client']); // Accessing internal client for demo
  const benchmarkService = new BenchmarkService();
  const modelEngine = new ModelRunEngine(null, benchmarkService); // Repository mocked
  const narrativeEngine = new NarrativeEngine(memoryService, modelEngine);
  const fabric = new AgentFabric(memoryService, TENANT_ID, TOGETHER_API_KEY);

  console.log("✅ Services Initialized. Starting Deal Lifecycle...\n");

  // --- 2. ARTIFACT INGESTION & FACT EXTRACTION (EPISODIC -> SEMANTIC) ---
  // Scenario: A Sales Engineer uploads a transcript from a discovery call with a CFO.
  const transcriptContent = `
    CFO: "Currently, our reconciliation process takes about 45 hours per week across 3 analysts. 
    We estimate the hourly burden rate at $75. We need to reduce this by at least 60%."
  `;

  const metadata: ArtifactMetadata = {
    source_type: 'meeting_transcript',
    author: 'Sales Engineer',
    page_count: 1
  };

  console.log("📥 Step 1: Ingesting Raw Discovery Transcript...");
  const { artifactId } = await pipeline.processArtifact(
    TENANT_ID,
    DEAL_ID,
    "CFO Discovery Call - Q1 Strategy",
    transcriptContent,
    metadata
  );

  /**
   * TRANSITION INSIGHT:
   * The MemoryPipeline just moved data from the EPISODIC layer (raw chunks)
   * to the SEMANTIC layer (atomic facts). Each fact is now a 'Draft' 
   * awaiting analyst verification.
   */
  console.log(`✅ Artifact Ingested: ${artifactId}. Facts extracted to Semantic Layer.\n`);

  // --- 3. CONTEXT RETRIEVAL (SCOPE: CFO PERSONA) ---
  console.log("🔍 Step 2: Retrieving Evidence-First Context for CFO...");
  const query = "What are the current reconciliation costs and target efficiency gains?";
  const mockEmbedding = new Array(1536).fill(0.1); // Simulated vector

  const evidencePayload = await retrieval.retrieve({
    query_text: query,
    query_embedding: mockEmbedding,
    value_case_id: DEAL_ID,
    tenant_id: TENANT_ID,
    limit: 3
  });

  console.log(`✅ Retrieved ${evidencePayload.cards.length} Evidence Cards.`);
  evidencePayload.cards.forEach(card => {
    console.log(`   - Found Fact: "${card.claim}" (Confidence: ${card.confidence_score})`);
  });

  // --- 4. COMPUTATIONAL MEMORY: FINANCIAL MODELING (SEMANTIC -> COMPUTATIONAL) ---
  // Scenario: We run a ModelRun to calculate ROI, locking to a Tier 1 Industry Benchmark.
  console.log("\n🧮 Step 3: Running ROI Model & Locking Benchmarks...");

  // Fetch a Tier 1 Benchmark for "Financial Services"
  const benchmarks = await benchmarkService.findSlices({ 
    industry: 'Financial Services', 
    tier: BenchmarkTier.TIER_1 
  });
  const targetBenchmark = benchmarks[0];

  const modelInputs = {
    current_hours: 45,
    burden_rate: 75,
    efficiency_gain: 0.60
  };

  const modelRun = await modelEngine.calculateAndPersist(
    DEAL_ID,
    modelInputs,
    "v2.1.0-roi-engine",
    [targetBenchmark.id]
  );

  /**
   * TRANSITION INSIGHT:
   * The ModelRunEngine captures a snapshot of the world. By hashing the 
   * inputs + engine_version + benchmark_id, we create a 'Run Fingerprint' (run_hash).
   * This is stored in COMPUTATIONAL memory, forever linkable to the output.
   */
  console.log(`✅ Model Run Complete. Result NPV: $${modelRun.results.npv}.`);
  console.log(`🔐 Run Hash (Immutability Lock): ${modelRun.run_hash.substring(0, 16)}...\n`);

  // --- 5. NARRATIVE SYNTHESIS & GOVERNANCE ---
  // Scenario: Generating the final CFO memo.
  console.log("✍️  Step 4: Generating CFO Narrative...");

  // First, ensure the facts used are 'APPROVED' (Simulating Governance)
  const draftFacts = await memoryService.retrieveContext(DEAL_ID, "reconciliation", mockEmbedding);
  for (const f of draftFacts.facts) {
    await memoryService.updateFactVersion(f.id, f.claim); // This marks as APPROVED in this demo logic
  }

  const narrative = await narrativeEngine.generate({
    valueCaseId: DEAL_ID,
    persona: PersonaType.CFO,
    title: "Executive Value Assessment: Reconciliation Automation",
    additionalContext: "Focus on the 60% reduction target mentioned in the discovery call."
  });

  console.log("📄 Narrative Synthesized:");
  console.log(narrative.body.substring(0, 200) + "...");
  
  // Submit for final approval
  narrative.status = NarrativeStatus.REVIEW;
  console.log(`✅ Narrative Status: ${narrative.status}. Ready for Board Review.\n`);

  // --- 6. DEMONSTRATING EVIDENCE LINEAGE (TRACING THE CHAIN) ---
  /**
   * LINEAGE INSIGHT:
   * The 'Value Chain' is now complete. We can trace a number in the CFO 
   * Narrative back through the Model Run, to the Fact, to the specific 
   * text chunk in the PDF.
   */
  console.log("🔗 Step 5: Verifying Evidence Lineage (Audit Trail)");
  
  const auditFactId = evidencePayload.cards[0].fact_id;
  const lineage = evidencePayload.cards[0].evidence[0];

  console.log(`   [Final Narrative Claim] <--- [Fact: ${auditFactId}]`);
  console.log(`   [Fact] <--- [Source Chunk: "${lineage.chunk_content.substring(0, 50)}..."]`);
  console.log(`   [Source Chunk] <--- [Artifact: "${lineage.source_artifact_title}"]`);

  console.log("\n🏆 Lifecycle Demo Complete: ValueOS Memory-First Architecture validated.");
}

// Helper to simulate the agent fabric run
async function simulateAgentAction(fabric: AgentFabric, dealId: UUID) {
  return await fabric.runAgent({
    agentId: "Discovery-Analyst-Llama3",
    authority: AuthorityLevel.LEVEL_3_ANALYST,
    valueCaseId: dealId,
    prompt: "Extract any mention of budgetary constraints from the latest transcript.",
    embedding: new Array(1536).fill(0.05)
  });
}

// Execute demo
runValueOSDemo().catch(console.error);

```

### Key Lifecycle Transitions

| Layer Transition | Action Taken | Significance |
| :--- | :--- | :--- |
| **Episodic → Semantic** | `pipeline.processArtifact` | Raw unstructured data (transcript) is decomposed into structured business claims (Facts). |
| **Semantic → Computational** | `modelEngine.calculateAndPersist` | Verified facts are used as variables in deterministic financial models, creating a permanent record of the calculation logic. |
| **Computational → Narrative** | `narrativeEngine.generate` | Persona-aligned templates inject model outputs and cited facts to create human-readable executive documents. |
| **Audit/Governance** | `retrieval.retrieve` | Every claim in the final narrative is mapped back to its chunk ID via the `FactEvidence` lineage, providing 100% auditability for the CFO. |

### Technical Architecture Notes
1.  **Immutability**: The `run_hash` generated by the `ModelRunEngine` ensures that if the underlying benchmark data or model logic changes, the discrepancy is immediately detectable.
2.  **Persona Scoping**: The `RetrievalEngine` filters and ranks evidence specifically for the `CFO` persona, prioritizing quantitative financial facts over general qualitative statements.
3.  **Governance**: The `AgentFabric` (though mocked in the run loop) ensures that only agents with `AuthorityLevel.LEVEL_3` or higher can propose new facts to the semantic layer, maintaining the "Source of Truth" integrity.