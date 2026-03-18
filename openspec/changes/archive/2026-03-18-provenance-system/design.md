# Design: Provenance System

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Provenance System                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Database:                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ provenance_records                                  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ id (uuid)                                           │   │
│  │ tenant_id (uuid)                                  │   │
│  │ case_id (uuid)                                      │   │
│  │ claim_id (uuid)                                     │   │
│  │ data_source (text)                                  │   │
│  │ formula (jsonb)                                     │   │
│  │ agent_id (text)                                     │   │
│  │ agent_version (text)                                │   │
│  │ evidence_tier (enum)                                │   │
│  │ confidence_score (float)                            │   │
│  │ parent_record_id (uuid)                             │   │
│  │ created_at (timestamp)                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Service:                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ProvenanceService                                   │   │
│  │ - append-only writes                                │   │
│  │ - lineage traversal                                 │   │
│  │ - chain reconstruction                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

```sql
CREATE TYPE evidence_tier AS ENUM ('tier_1_sec', 'tier_2_benchmark', 'tier_3_web', 'tier_4_llm');

CREATE TABLE provenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  case_id UUID NOT NULL REFERENCES value_cases(id),
  claim_id UUID NOT NULL,
  data_source TEXT NOT NULL,
  formula JSONB,
  agent_id TEXT NOT NULL,
  agent_version TEXT NOT NULL,
  evidence_tier evidence_tier,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  parent_record_id UUID REFERENCES provenance_records(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_parent_record FOREIGN KEY (parent_record_id) 
    REFERENCES provenance_records(id) ON DELETE RESTRICT
);

-- RLS Policies
ALTER TABLE provenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON provenance_records
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Indexes
CREATE INDEX idx_provenance_tenant_case ON provenance_records(tenant_id, case_id);
CREATE INDEX idx_provenance_claim ON provenance_records(claim_id);
CREATE INDEX idx_provenance_parent ON provenance_records(parent_record_id);
```

## ProvenanceService Interface

```typescript
interface ProvenanceRecord {
  id: string;
  tenantId: string;
  caseId: string;
  claimId: string;
  dataSource: string;
  formula?: Record<string, unknown>;
  agentId: string;
  agentVersion: string;
  evidenceTier?: 'tier_1_sec' | 'tier_2_benchmark' | 'tier_3_web' | 'tier_4_llm';
  confidenceScore?: number;
  parentRecordId?: string;
  createdAt: Date;
}

interface LineageChain {
  claimId: string;
  records: ProvenanceRecord[];
  depth: number;
  root: ProvenanceRecord;
}

class ProvenanceService {
  async create(record: Omit<ProvenanceRecord, 'id' | 'createdAt'>): Promise<ProvenanceRecord>;
  async getLineage(claimId: string, tenantId: string): Promise<LineageChain>;
  async getByCase(caseId: string, tenantId: string): Promise<ProvenanceRecord[]>;
}
```

## Lineage Traversal

```typescript
async function getLineageChain(claimId: string, tenantId: string): Promise<LineageChain> {
  const records: ProvenanceRecord[] = [];
  let current = await db.query(
    'SELECT * FROM provenance_records WHERE claim_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1',
    [claimId, tenantId]
  );
  
  while (current) {
    records.push(current);
    if (!current.parentRecordId) break;
    
    current = await db.query(
      'SELECT * FROM provenance_records WHERE id = $1 AND tenant_id = $2',
      [current.parentRecordId, tenantId]
    );
  }
  
  return {
    claimId,
    records,
    depth: records.length,
    root: records[records.length - 1]
  };
}
```

## API Endpoint

```typescript
// GET /api/cases/:caseId/provenance/:claimId
async function getProvenance(req: Request, res: Response) {
  const { caseId, claimId } = req.params;
  const tenantId = req.tenantId;
  
  const lineage = await provenanceService.getLineage(claimId, tenantId);
  
  res.json({
    claimId,
    caseId,
    lineage,
    generatedAt: new Date().toISOString()
  });
}
```

## Agent Integration

### FinancialModelingAgent

```typescript
class FinancialModelingAgent {
  async run(context: AgentContext): Promise<AgentOutput> {
    const result = await this.calculate(context);
    
    // Create provenance record for each calculated figure
    for (const figure of result.figures) {
      await provenanceService.create({
        tenantId: context.tenantId,
        caseId: context.caseId,
        claimId: figure.claimId,
        dataSource: figure.source,
        formula: figure.formula,
        agentId: this.id,
        agentVersion: this.version,
        evidenceTier: figure.evidenceTier,
        confidenceScore: figure.confidence,
        parentRecordId: figure.parentId
      });
    }
    
    return result;
  }
}
```

### IntegrityAgent

```typescript
class IntegrityAgent {
  async run(context: AgentContext): Promise<AgentOutput> {
    const validation = await this.validate(context);
    
    // Create provenance for validation results
    await provenanceService.create({
      tenantId: context.tenantId,
      caseId: context.caseId,
      claimId: validation.claimId,
      dataSource: 'integrity_validation',
      formula: { validationScore: validation.score },
      agentId: this.id,
      agentVersion: this.version,
      evidenceTier: 'tier_4_llm',
      confidenceScore: validation.confidence
    });
    
    return validation;
  }
}
```

## Testing Strategy

- Unit tests for lineage chain traversal
- Integration tests for agent integration
- RLS policy tests for tenant isolation
