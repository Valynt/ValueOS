# ValueOS Ground Truth Library - Final Implementation Plan
## Operationalizing the Complete System

## Overview
This plan covers the final 4 tasks to operationalize the ground truth library:
1. Generate 1,575 minimum viable traces for priority cells
2. Deploy ground truth library as MCP server
3. Integrate with ValueOS agents for real-time validation
4. Set up monitoring for coverage and quality metrics

## Task 1: Generate 1,575 Minimum Viable Traces

### 1.1 Trace Generation Pipeline Architecture

```mermaid
graph TB
    A[Coverage Tracker] --> B[Gap Detection Engine]
    B --> C[Priority Queue]
    C --> D[Prompt Generator]
    D --> E[LLM Generation]
    E --> F[Validation Layer]
    F --> G[Quality Scorer]
    G --> H{Pass?}
    H -->|Yes| I[Store in Trace DB]
    H -->|No| J[Repair Prompt]
    J --> E
    I --> K[Update Coverage Matrix]
    K --> B
```

### 1.2 Implementation Steps

#### Step 1: Initialize Generation Environment
```python
# File: src/ground_truth/generation/orchestrator.py

class TraceGenerationOrchestrator:
    def __init__(self, coverage_tracker, metric_registry, llm_client):
        self.tracker = coverage_tracker
        self.registry = metric_registry
        self.llm = llm_client
        self.generation_stats = {
            'total_requested': 0,
            'successful': 0,
            'failed': 0,
            'avg_quality': 0,
            'avg_diversity': 0
        }
    
    def generate_priority_traces(self, target_count=1575):
        """Generate traces for all priority cells"""
        gaps = self.tracker.get_coverage_gaps()
        
        for gap in gaps:
            if self.generation_stats['successful'] >= target_count:
                break
            
            deficit = gap['deficit']
            cell = gap['cell'].split('|')
            
            for _ in range(deficit):
                success = self._generate_single_trace(cell)
                if success:
                    self.generation_stats['successful'] += 1
                else:
                    self.generation_stats['failed'] += 1
                
                self.generation_stats['total_requested'] += 1
                
                # Log progress every 100 traces
                if self.generation_stats['total_requested'] % 100 == 0:
                    self._log_progress()
        
        return self.generation_stats
    
    def _generate_single_trace(self, cell):
        """Generate and validate a single trace"""
        industry, persona, value_type, stage = cell
        
        # Get ground truth metrics for this cell
        ground_truth = self.registry.get_metrics_for_cell(cell)
        
        # Generate prompt
        prompt = self._build_generation_prompt(cell, ground_truth)
        
        # Call LLM
        try:
            response = self.llm.generate(prompt)
            trace = self._parse_response(response)
            
            # Validate
            validation = self._validate_trace(trace, ground_truth)
            if not validation['valid']:
                # Attempt repair
                trace = self._attempt_repair(trace, validation['errors'])
                validation = self._validate_trace(trace, ground_truth)
            
            if validation['valid']:
                # Score quality
                quality_score = self._score_quality(trace)
                
                # Store
                self._store_trace(trace, quality_score)
                
                # Update coverage
                self.tracker.add_trace(trace)
                
                return True
            
        except Exception as e:
            print(f"Generation failed for {cell}: {e}")
        
        return False
    
    def _build_generation_prompt(self, cell, ground_truth):
        """Build enhanced generation prompt"""
        industry, persona, value_type, stage = cell
        
        # Get company size distribution
        company_size = self._get_company_size_distribution()
        
        # Get deal size distribution
        deal_size = self._get_deal_size_distribution()
        
        # Get complexity distribution
        complexity = self._get_complexity_distribution()
        
        # Get few-shot examples
        examples = self._get_few_shot_examples(cell)
        
        prompt = f"""You are a senior value engineer and financial modeler with 15+ years of experience.

## Task
Generate a Value Modeling Reasoning Trace following the exact JSON schema.

## Scenario
- Industry: {industry}
- Persona: {persona}
- Value Type: {value_type}
- Lifecycle Stage: {stage}
- Company Size: {company_size}
- Deal Size: {deal_size}
- Complexity: {complexity}

## Ground Truth Metrics
{ground_truth}

## Few-Shot Examples
{examples}

## Requirements
1. Follow the schema exactly
2. Ground all numbers in provided metrics or conservative assumptions
3. Build explicit causal chains
4. Show all calculations
5. Use conservative assumptions
6. Include 8-15 reasoning steps
7. Self-verify before output

## Output
Return ONLY valid JSON. No commentary.
"""
        
        return prompt
    
    def _validate_trace(self, trace, ground_truth):
        """Validate trace against schema and ground truth"""
        validator = TraceValidator(self.registry)
        return validator.validate(trace, ground_truth)
    
    def _attempt_repair(self, trace, errors):
        """Attempt to repair validation errors"""
        repair_prompt = f"""The following trace has validation errors. Please fix them:

Trace: {trace}
Errors: {errors}

Return the corrected trace as valid JSON.
"""
        
        response = self.llm.generate(repair_prompt)
        return self._parse_response(response)
    
    def _score_quality(self, trace):
        """Calculate quality score"""
        scorer = QualityScorer()
        return scorer.score_trace(trace)
    
    def _store_trace(self, trace, quality_score):
        """Store trace in database"""
        # Implementation depends on your database choice
        # Could be PostgreSQL, MongoDB, or even file-based for initial version
        pass
    
    def _log_progress(self):
        """Log generation progress"""
        avg_quality = self.generation_stats['successful'] > 0 and \
                     self.generation_stats['avg_quality'] / self.generation_stats['successful'] or 0
        
        print(f"""
        Generation Progress:
        - Total Requested: {self.generation_stats['total_requested']}
        - Successful: {self.generation_stats['successful']}
        - Failed: {self.generation_stats['failed']}
        - Success Rate: {(self.generation_stats['successful'] / max(1, self.generation_stats['total_requested'])) * 100:.1f}%
        - Avg Quality: {avg_quality:.1f}
        """)
```

#### Step 2: Batch Generation Strategy

```python
# File: src/ground_truth/generation/batch_generator.py

class BatchTraceGenerator:
    def __init__(self, orchestrator):
        self.orchestrator = orchestrator
    
    def generate_in_batches(self, batch_size=50, max_batches=None):
        """Generate traces in manageable batches"""
        batch_count = 0
        
        while True:
            if max_batches and batch_count >= max_batches:
                break
            
            # Get current gaps
            gaps = self.orchestrator.tracker.get_coverage_gaps(limit=10)
            
            if not gaps:
                print("All priority cells covered!")
                break
            
            print(f"\n=== Batch {batch_count + 1} ===")
            print(f"Targeting {len(gaps)} gaps")
            
            # Generate batch
            stats = self.orchestrator.generate_priority_traces(batch_size)
            
            # Check progress
            coverage_report = self.orchestrator.tracker.get_coverage_report()
            
            print(f"Batch Complete:")
            print(f"- Coverage: {coverage_report['summary']['coverage_percentage']}%")
            print(f"- Priority 1: {coverage_report['summary']['priority_1_coverage']}%")
            
            batch_count += 1
            
            # Save intermediate results
            self._save_checkpoint(batch_count, coverage_report)
    
    def _save_checkpoint(self, batch_num, report):
        """Save generation checkpoint"""
        checkpoint = {
            'batch_number': batch_num,
            'timestamp': datetime.utcnow().isoformat(),
            'report': report,
            'stats': self.orchestrator.generation_stats
        }
        
        with open(f'checkpoints/batch_{batch_num}.json', 'w') as f:
            json.dump(checkpoint, f, indent=2)
```

#### Step 3: Parallel Generation (Optional)

```python
# File: src/ground_truth/generation/parallel_generator.py

import asyncio
from concurrent.futures import ThreadPoolExecutor

class ParallelTraceGenerator:
    def __init__(self, orchestrator, max_workers=5):
        self.orchestrator = orchestrator
        self.max_workers = max_workers
    
    async def generate_parallel(self, target_count=1575):
        """Generate traces in parallel"""
        gaps = self.orchestrator.tracker.get_coverage_gaps()
        
        # Flatten gaps into individual trace tasks
        tasks = []
        for gap in gaps:
            cell = gap['cell']
            deficit = gap['deficit']
            for _ in range(deficit):
                tasks.append(cell)
        
        # Limit to target count
        tasks = tasks[:target_count]
        
        # Process in parallel
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            loop = asyncio.get_event_loop()
            results = await asyncio.gather(
                *[loop.run_in_executor(executor, self._generate_task, cell) 
                  for cell in tasks]
            )
        
        return results
    
    def _generate_task(self, cell):
        """Single generation task"""
        return self.orchestrator._generate_single_trace(cell)
```

### 1.3 Execution Plan

```bash
# Terminal commands to run generation

# 1. Initialize the generation environment
python -m ground_truth.generation.initialize

# 2. Start batch generation (run in screen/tmux)
python -m ground_truth.generation.batch_generator \
  --batch-size 50 \
  --max-batches 32 \
  --checkpoint-dir ./checkpoints

# 3. Monitor progress
python -m ground_truth.generation.monitor \
  --watch \
  --interval 60

# 4. Resume from checkpoint (if interrupted)
python -m ground_truth.generation.batch_generator \
  --resume-from ./checkpoints/batch_15.json
```

### 1.4 Expected Timeline & Milestones

**Milestone 1**: First 100 traces (Quality validation)
- Validate generation pipeline
- Confirm quality scores >80
- Verify diversity >70

**Milestone 2**: First 500 traces (Coverage validation)
- Achieve 30% priority cell coverage
- Identify and fix generation issues
- Optimize prompt templates

**Milestone 3**: 1,575 traces (Complete coverage)
- 100% Priority 1 coverage (525 cells × 3 traces)
- 80% Priority 2 coverage
- Average quality score >85
- Diversity score >75

## Task 2: Deploy Ground Truth Library as MCP Server

### 2.1 MCP Server Architecture

```mermaid
graph TB
    A[MCP Client<br/>ValueOS Agent] --> B[MCP Server<br/>Ground Truth Library]
    B --> C[Module: EDGAR]
    B --> D[Module: XBRL]
    B --> E[Module: Market Data]
    B --> F[Module: Private Company]
    B --> G[Module: Industry Benchmarks]
    B --> H[Module: Trace Registry]
    C --> I[SEC EDGAR API]
    D --> J[XBRL Parser]
    E --> K[Alpha Vantage]
    F --> L[Crunchbase]
    G --> M[Census/BLS]
    H --> N[PostgreSQL]
```

### 2.2 MCP Server Implementation

```python
# File: src/mcp_server/ground_truth_server.py

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, ImageContent, EmbeddedResource
import json

class GroundTruthMCPServer:
    def __init__(self, metric_registry, trace_registry, coverage_tracker):
        self.server = Server("ground-truth-library")
        self.metric_registry = metric_registry
        self.trace_registry = trace_registry
        self.coverage_tracker = coverage_tracker
        
        self._register_tools()
    
    def _register_tools(self):
        """Register MCP tools"""
        
        # Tool 1: Get metric value
        @self.server.tool()
        async def get_metric_value(metric_id: str, context: dict = None):
            """Get contextualized metric value with confidence bounds"""
            if context is None:
                context = {}
            
            value = self.metric_registry.get_metric_value(metric_id, context)
            return {
                "type": "metric",
                "metric_id": metric_id,
                "value": value,
                "context": context
            }
        
        # Tool 2: Validate financial claim
        @self.server.tool()
        async def validate_claim(claim: dict):
            """Validate a financial claim against ground truth"""
            validator = TraceValidator(self.metric_registry)
            result = validator.validate_claim(claim)
            return {
                "type": "validation",
                "result": result
            }
        
        # Tool 3: Get value chain
        @self.server.tool()
        async def get_value_chain(start_metric: str, end_outcome: str):
            """Get reasoning chain from metric to outcome"""
            chain = self.metric_registry.get_value_chain(start_metric, end_outcome)
            return {
                "type": "value_chain",
                "chain": chain
            }
        
        # Tool 4: Get similar traces
        @self.server.tool()
        async def get_similar_traces(industry: str, persona: str, value_type: str):
            """Retrieve similar reasoning traces"""
            traces = self.trace_registry.search(
                industry=industry,
                persona=persona,
                value_type=value_type,
                limit=10
            )
            return {
                "type": "traces",
                "traces": traces
            }
        
        # Tool 5: Get coverage report
        @self.server.tool()
        async def get_coverage_report():
            """Get current coverage status"""
            report = self.coverage_tracker.generate_coverage_report()
            return {
                "type": "coverage_report",
                "report": report
            }
        
        # Tool 6: Generate gap-filling prompts
        @self.server.tool()
        async def get_gap_filling_prompts():
            """Get prompts to fill coverage gaps"""
            prompts = self.coverage_tracker.generate_gap_filling_prompts()
            return {
                "type": "prompts",
                "prompts": prompts
            }
    
    async def run(self):
        """Run the MCP server"""
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options()
            )

# Entry point
if __name__ == "__main__":
    # Initialize components
    metric_registry = MetricRegistry()
    trace_registry = TraceRegistry()
    coverage_tracker = CoverageTracker()
    
    # Load data
    metric_registry.load_from_file("data/metrics/enhanced_metrics.json")
    trace_registry.load_from_database()
    coverage_tracker.load_from_database()
    
    # Start server
    server = GroundTruthMCPServer(metric_registry, trace_registry, coverage_tracker)
    asyncio.run(server.run())
```

### 2.3 MCP Server Configuration

```json
{
  "mcpServers": {
    "ground-truth-library": {
      "command": "python",
      "args": ["-m", "mcp_server.ground_truth_server"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/ground_truth",
        "REDIS_URL": "redis://localhost:6379",
        "LOG_LEVEL": "INFO"
      },
      "description": "ValueOS Ground Truth Library - Deterministic financial reasoning data"
    }
  }
}
```

### 2.4 Docker Deployment

```dockerfile
# File: Dockerfile.mcp-server

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy application
COPY src/mcp_server/ ./mcp_server/
COPY data/ ./data/

# Environment variables
ENV PYTHONPATH=/app
ENV DATABASE_URL=postgresql://user:pass@db:5432/ground_truth
ENV REDIS_URL=redis://redis:6379

# Expose MCP server
CMD ["python", "-m", "mcp_server.ground_truth_server"]
```

```yaml
# File: docker-compose.mcp.yml

version: '3.8'

services:
  mcp-server:
    build:
      context: .
      dockerfile: Dockerfile.mcp-server
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/ground_truth
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    ports:
      - "8080:8080"
  
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: ground_truth
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - pgdata:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

## Task 3: Integrate with ValueOS Agents

### 3.1 Agent Integration Architecture

```mermaid
graph TB
    A[ValueOS Agent<br/>CoordinatorAgent] --> B[MCP Client]
    B --> C[Ground Truth MCP Server]
    
    C --> D[Get Contextual Metrics]
    C --> E[Validate Claims]
    C --> F[Retrieve Similar Cases]
    C --> G[Check Coverage Gaps]
    
    A --> H[Enhanced Reasoning]
    H --> I[Better Value Cases]
    I --> J[Higher Win Rates]
```

### 3.2 Agent Integration Code

```python
# File: src/lib/agent-fabric/integrations/ground_truth_integration.py

from mcp import ClientSession
from mcp.client.stdio import stdio_client
import asyncio

class GroundTruthIntegration:
    """
    Integration layer for ValueOS agents to access ground truth library
    """
    
    def __init__(self, agent_type: str):
        self.agent_type = agent_type
        self.session = None
        self.connected = False
    
    async def connect(self):
        """Connect to MCP server"""
        command = ["python", "-m", "mcp_server.ground_truth_server"]
        
        async with stdio_client(command) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                self.session = session
                self.connected = True
                return session
    
    async def get_contextual_metrics(self, metric_id: str, context: dict = None):
        """Get metrics with context"""
        if not self.connected:
            await self.connect()
        
        result = await self.session.call_tool(
            "get_metric_value",
            {"metric_id": metric_id, "context": context or {}}
        )
        return result
    
    async def validate_financial_claim(self, claim: dict):
        """Validate a financial claim"""
        if not self.connected:
            await self.connect()
        
        result = await self.session.call_tool(
            "validate_claim",
            {"claim": claim}
        )
        return result
    
    async def get_value_chain(self, start_metric: str, end_outcome: str):
        """Get reasoning chain"""
        if not self.connected:
            await self.connect()
        
        result = await self.session.call_tool(
            "get_value_chain",
            {"start_metric": start_metric, "end_outcome": end_outcome}
        )
        return result
    
    async def get_similar_traces(self, industry: str, persona: str, value_type: str):
        """Get similar reasoning traces"""
        if not self.connected:
            await self.connect()
        
        result = await self.session.call_tool(
            "get_similar_traces",
            {"industry": industry, "persona": persona, "value_type": value_type}
        )
        return result

# Enhanced CoordinatorAgent with Ground Truth Integration
class EnhancedCoordinatorAgent(CoordinatorAgent):
    def __init__(self, config):
        super().__init__(config)
        self.gt_integration = GroundTruthIntegration("coordinator")
    
    async def decompose_intent(self, user_intent: str, context: dict):
        """Enhanced decomposition with ground truth validation"""
        
        # Step 1: Extract key metrics from intent
        metrics = self._extract_metrics(user_intent)
        
        # Step 2: Validate against ground truth
        validation_results = []
        for metric in metrics:
            validation = await self.gt_integration.validate_financial_claim({
                "metric": metric,
                "context": context
            })
            validation_results.append(validation)
        
        # Step 3: Get similar cases for pattern matching
        similar_cases = await self.gt_integration.get_similar_traces(
            industry=context.get("industry"),
            persona=context.get("persona"),
            value_type=context.get("value_type")
        )
        
        # Step 4: Build enhanced DAG plan
        dag_plan = await self._build_enhanced_dag(
            user_intent, 
            validation_results,
            similar_cases
        )
        
        return dag_plan
    
    async def _build_enhanced_dag(self, intent, validations, similar_cases):
        """Build DAG using ground truth insights"""
        
        # Use similar cases as templates
        if similar_cases['traces']:
            best_case = similar_cases['traces'][0]
            # Adapt the best matching case to current context
            return self._adapt_case(best_case, intent)
        
        # Fallback to standard decomposition
        return super().decompose_intent(intent)
```

### 3.3 Enhanced CommunicatorAgent

```python
# File: src/lib/agent-fabric/integrations/communicator_enhanced.py

class EnhancedCommunicatorAgent(CommunicatorAgent):
    def __init__(self, config):
        super().__init__(config)
        self.gt_integration = GroundTruthIntegration("communicator")
    
    async def generate_executive_summary(self, value_case_id: str, value_tree: dict, roi_model: dict):
        """Enhanced narrative generation with ground truth validation"""
        
        # Step 1: Validate all financial claims in ROI model
        validated_claims = []
        for claim in roi_model.get("financial_impacts", []):
            validation = await self.gt_integration.validate_financial_claim(claim)
            validated_claims.append({
                "claim": claim,
                "validation": validation
            })
        
        # Step 2: Get contextual metrics for persona
        persona_metrics = await self._get_persona_metrics(
            value_tree.get("persona"),
            value_tree.get("industry")
        )
        
        # Step 3: Generate narrative with ground truth backing
        narrative = await super().generate_executive_summary(
            value_case_id, value_tree, roi_model
        )
        
        # Step 4: Enhance with ground truth citations
        enhanced_narrative = await self._add_ground_truth_citations(
            narrative, validated_claims, persona_metrics
        )
        
        return enhanced_narrative
    
    async def _get_persona_metrics(self, persona: str, industry: str):
        """Get relevant metrics for persona"""
        # Get KPIs from ESO
        kpis = self.gt_integration.metric_registry.get_kpis_for_persona(persona)
        
        # Filter by industry relevance
        industry_kpis = [
            kpi for kpi in kpis 
            if kpi.get("domain") == industry or kpi.get("domain") == "all"
        ]
        
        return industry_kpis
    
    async def _add_ground_truth_citations(self, narrative, validated_claims, metrics):
        """Add ground truth citations to narrative"""
        
        # Add confidence scores to key metrics
        for key_metric in narrative.get("keyMetrics", []):
            metric_id = self._map_metric_name_to_id(key_metric["label"])
            if metric_id:
                context = {"industry": narrative.get("industry")}
                metric_data = await self.gt_integration.get_contextual_metrics(metric_id, context)
                key_metric["groundTruth"] = {
                    "source": metric_data.get("source"),
                    "confidence": metric_data.get("confidence"),
                    "range": metric_data.get("value_structure", {}).get("baseline_range")
                }
        
        # Add validation badges to financial claims
        for claim in validated_claims:
            if claim["validation"]["valid"]:
                narrative["risks"].append(
                    f"✓ Financial claim validated: {claim['validation']['expected_range']}"
                )
            else:
                narrative["risks"].append(
                    f"⚠ Financial claim outside range: {claim['validation']['correction']}"
                )
        
        return narrative
```

### 3.4 Integration Testing

```python
# File: tests/integration/ground_truth_integration.test.py

import pytest
import asyncio

class TestGroundTruthIntegration:
    @pytest.mark.asyncio
    async def test_coordinator_with_ground_truth(self):
        """Test coordinator agent with ground truth integration"""
        
        # Setup
        config = {"supabase": mock_supabase, "llm": mock_llm}
        agent = EnhancedCoordinatorAgent(config)
        
        # Test intent decomposition
        intent = "How can we reduce AP processing costs for our manufacturing company?"
        context = {
            "industry": "manufacturing",
            "company_size": "mid_market",
            "persona": "cfo"
        }
        
        dag_plan = await agent.decompose_intent(intent, context)
        
        # Assertions
        assert dag_plan is not None
        assert len(dag_plan["steps"]) > 0
        
        # Verify ground truth was used
        assert "validation_results" in dag_plan
        assert len(dag_plan["validation_results"]) > 0
    
    @pytest.mark.asyncio
    async def test_communicator_with_citations(self):
        """Test communicator agent adds ground truth citations"""
        
        config = {"supabase": mock_supabase, "llm": mock_llm}
        agent = EnhancedCommunicatorAgent(config)
        
        value_tree = {
            "industry": "saas",
            "persona": "cfo",
            "value_type": "cost_savings"
        }
        
        roi_model = {
            "financial_impacts": [
                {
                    "type": "cost_savings",
                    "amount": 500000,
                    "currency": "USD",
                    "assumptions": {"ap_cost_per_invoice": 8.50}
                }
            ]
        }
        
        narrative = await agent.generate_executive_summary(
            "test-case", value_tree, roi_model
        )
        
        # Verify ground truth citations
        assert "groundTruth" in narrative["keyMetrics"][0]
        assert "confidence" in narrative["keyMetrics"][0]["groundTruth"]
```

## Task 4: Set Up Monitoring & Observability

### 4.1 Monitoring Architecture

```mermaid
graph TB
    A[Ground Truth Library] --> B[Metrics Exporter]
    B --> C[Prometheus]
    B --> D[Structured Logs]
    D --> E[Loki]
    
    C --> F[Grafana Dashboard]
    E --> F
    
    A --> G[Coverage Events]
    G --> H[Event Stream]
    H --> I[Alert Manager]
    
    I --> J[Slack/Email Alerts]
    
    F --> K[Performance Metrics]
    F --> L[Quality Metrics]
    F --> M[Coverage Metrics]
```

### 4.2 Key Metrics to Monitor

```python
# File: src/observability/metrics_collector.py

from prometheus_client import Counter, Histogram, Gauge
import time

class GroundTruthMetrics:
    """Prometheus metrics for ground truth library"""
    
    # Generation metrics
    traces_generated = Counter(
        'ground_truth_traces_generated_total',
        'Total traces generated',
        ['industry', 'persona', 'value_type', 'status']
    )
    
    generation_duration = Histogram(
        'ground_truth_generation_duration_seconds',
        'Time to generate a trace',
        buckets=[1, 5, 10, 30, 60, 120, 300]
    )
    
    # Quality metrics
    trace_quality_score = Gauge(
        'ground_truth_trace_quality_score',
        'Quality score of generated traces',
        ['industry', 'persona']
    )
    
    validation_failures = Counter(
        'ground_truth_validation_failures_total',
        'Validation failures by type',
        ['error_type']
    )
    
    # Coverage metrics
    coverage_percentage = Gauge(
        'ground_truth_coverage_percentage',
        'Current coverage percentage',
        ['priority', 'dimension']
    )
    
    coverage_gaps = Gauge(
        'ground_truth_coverage_gaps',
        'Number of gaps remaining',
        ['priority']
    )
    
    # Performance metrics
    mcp_request_duration = Histogram(
        'ground_truth_mcp_request_duration_seconds',
        'MCP server request duration',
        ['tool_name']
    )
    
    mcp_errors = Counter(
        'ground_truth_mcp_errors_total',
        'MCP server errors',
        ['tool_name', 'error_type']
    )

class MetricsCollector:
    def __init__(self):
        self.metrics = GroundTruthMetrics()
    
    def record_generation(self, cell, duration, quality_score, success):
        """Record generation attempt"""
        industry, persona, value_type, stage = cell
        
        self.metrics.traces_generated.labels(
            industry=industry,
            persona=persona,
            value_type=value_type,
            status='success' if success else 'failure'
        ).inc()
        
        self.metrics.generation_duration.observe(duration)
        
        if success:
            self.metrics.trace_quality_score.labels(
                industry=industry,
                persona=persona
            ).set(quality_score)
    
    def record_coverage_update(self, tracker):
        """Record coverage metrics"""
        report = tracker.generate_coverage_report()
        
        self.metrics.coverage_percentage.labels(
            priority='priority_1',
            dimension='overall'
        ).set(report['summary']['priority_1_coverage'])
        
        self.metrics.coverage_percentage.labels(
            priority='priority_2',
            dimension='overall'
        ).set(report['summary']['priority_2_coverage'])
        
        # Count gaps
        gaps = tracker.get_coverage_gaps()
        priority_1_gaps = sum(1 for g in gaps if g['priority_score'] >= 35)
        priority_2_gaps = sum(1 for g in gaps if 25 <= g['priority_score'] < 35)
        
        self.metrics.coverage_gaps.labels(priority='priority_1').set(priority_1_gaps)
        self.metrics.coverage_gaps.labels(priority='priority_2').set(priority_2_gaps)
    
    def record_mcp_request(self, tool_name, duration, error=None):
        """Record MCP server performance"""
        self.metrics.mcp_request_duration.labels(tool_name=tool_name).observe(duration)
        
        if error:
            self.metrics.mcp_errors.labels(
                tool_name=tool_name,
                error_type=type(error).__name__
            ).inc()
```

### 4.3 Grafana Dashboard Configuration

```yaml
# File: observability/grafana/dashboards/ground_truth.json
{
  "dashboard": {
    "title": "ValueOS Ground Truth Library",
    "panels": [
      {
        "title": "Coverage Progress",
        "type": "stat",
        "targets": [
          {
            "expr": "ground_truth_coverage_percentage{priority='priority_1'}",
            "legendFormat": "Priority 1 Coverage"
          }
        ]
      },
      {
        "title": "Generation Quality Trend",
        "type": "graph",
        "targets": [
          {
            "expr": "ground_truth_trace_quality_score",
            "legendFormat": "{{industry}} - {{persona}}"
          }
        ]
      },
      {
        "title": "Coverage Gaps by Priority",
        "type": "bar gauge",
        "targets": [
          {
            "expr": "ground_truth_coverage_gaps",
            "legendFormat": "{{priority}}"
          }
        ]
      },
      {
        "title": "MCP Server Performance",
        "type": "heatmap",
        "targets": [
          {
            "expr": "rate(ground_truth_mcp_request_duration_seconds_bucket[5m])",
            "legendFormat": "{{tool_name}}"
          }
        ]
      }
    ]
  }
}
```

### 4.4 Alerting Rules

```yaml
# File: observability/prometheus/alerts.yml

groups:
- name: ground_truth_alerts
  rules:
  
  # Low coverage alert
  - alert: LowPriorityCoverage
    expr: ground_truth_coverage_percentage{priority='priority_1'} < 80
    for: 15m
    labels:
      severity: warning
    annotations:
      summary: "Priority 1 coverage below 80%"
      description: "Current coverage: {{ $value }}%"
  
  # Quality degradation
  - alert: QualityDegradation
    expr: ground_truth_trace_quality_score < 80
    for: 10m
    labels:
      severity: critical
    annotations:
      summary: "Trace quality score below 80"
      description: "Average quality: {{ $value }}"
  
  # Generation failure rate
  - alert: HighFailureRate
    expr: rate(ground_truth_traces_generated_total{status='failure'}[5m]) > 0.2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Generation failure rate above 20%"
  
  # MCP server errors
  - alert: MCPServerErrors
    expr: rate(ground_truth_mcp_errors_total[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "MCP server error rate above 10%"
```

### 4.5 Logging Configuration

```python
# File: src/observability/logger.py

import logging
import json
from datetime import datetime

class StructuredLogger:
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)
        
        # JSON formatter
        formatter = logging.Formatter('%(message)s')
        
        # Console handler
        console = logging.StreamHandler()
        console.setFormatter(formatter)
        self.logger.addHandler(console)
        
        # File handler
        file_handler = logging.FileHandler('ground_truth.log')
        file_handler.setFormatter(formatter)
        self.logger.addHandler(file_handler)
    
    def log_generation(self, cell, trace_id, quality, duration, success):
        """Log generation event"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": "trace_generation",
            "cell": cell,
            "trace_id": trace_id,
            "quality_score": quality,
            "duration_seconds": duration,
            "success": success
        }
        self.logger.info(json.dumps(log_entry))
    
    def log_validation(self, trace_id, validation_result):
        """Log validation event"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": "validation",
            "trace_id": trace_id,
            "valid": validation_result['valid'],
            "errors": validation_result.get('errors', [])
        }
        self.logger.info(json.dumps(log_entry))
    
    def log_coverage_update(self, cell, current, target):
        """Log coverage update"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": "coverage_update",
            "cell": cell,
            "current": current,
            "target": target,
            "completion": current / target if target > 0 else 0
        }
        self.logger.info(json.dumps(log_entry))
```

## Implementation Checklist

### Phase 1: Trace Generation (Week 1)
- [ ] Set up generation environment
- [ ] Implement batch generator
- [ ] Run first 100 traces (quality validation)
- [ ] Run first 500 traces (coverage validation)
- [ ] Complete 1,575 traces

### Phase 2: MCP Server Deployment (Week 2)
- [ ] Implement MCP server
- [ ] Set up PostgreSQL + Redis
- [ ] Dockerize server
- [ ] Test all tools
- [ ] Deploy to staging

### Phase 3: Agent Integration (Week 3)
- [ ] Implement GroundTruthIntegration class
- [ ] Enhance CoordinatorAgent
- [ ] Enhance CommunicatorAgent
- [ ] Write integration tests
- [ ] A/B test performance

### Phase 4: Monitoring & Observability (Week 4)
- [ ] Set up Prometheus + Grafana
- [ ] Configure metrics collection
- [ ] Create dashboards
- [ ] Set up alerting
- [ ] Implement structured logging

### Phase 5: Production Deployment (Week 5)
- [ ] Load test MCP server
- [ ] Monitor generation quality
- [ ] Track coverage progress
- [ ] Optimize based on metrics
- [ ] Document operational procedures

## Success Criteria

### Coverage Metrics
- **Priority 1**: 100% coverage (525 cells × 5 traces = 2,625 traces)
- **Priority 2**: 80% coverage
- **Priority 3**: 50% coverage
- **Overall**: >85% of priority cells

### Quality Metrics
- **Average Quality Score**: >85/100
- **Diversity Score**: >75/100
- **Validation Pass Rate**: >95%
- **Reasoning Depth**: Average 8-12 steps

### Performance Metrics
- **MCP Response Time**: <100ms (p95)
- **Generation Speed**: 100 traces/hour
- **System Uptime**: 99.9%
- **Error Rate**: <1%

### Business Metrics
- **Agent Accuracy**: +20% improvement
- **Case Acceptance**: +15% improvement
- **Time to Value**: -30% reduction
- **User Satisfaction**: >90%

This implementation plan provides a complete roadmap to operationalize the ground truth library, from trace generation through production deployment with full observability.