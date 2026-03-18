import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import type { EvidenceTier } from "../../lib/validation/SourceClassification.js";

/**
 * Provenance Service
 *
 * Tracks audit trail for all calculated figures in value cases.
 * Append-only writes, lineage chain traversal, full derivation history.
 */

export interface ProvenanceRecord {
  id: string;
  tenantId: string;
  caseId: string;
  claimId: string;
  dataSource: string;
  formula?: Record<string, unknown>;
  agentId: string;
  agentVersion: string;
  evidenceTier?: EvidenceTier;
  confidenceScore?: number;
  parentRecordId?: string;
  createdAt: Date;
}

export interface LineageChain {
  claimId: string;
  records: ProvenanceRecord[];
  depth: number;
  root: ProvenanceRecord;
}

export interface CreateProvenanceInput {
  tenantId: string;
  caseId: string;
  claimId: string;
  dataSource: string;
  formula?: Record<string, unknown>;
  agentId: string;
  agentVersion: string;
  evidenceTier?: EvidenceTier;
  confidenceScore?: number;
  parentRecordId?: string;
}

// Validation schema for CreateProvenanceInput
const CreateProvenanceInputSchema = z.object({
  tenantId: z.string().min(1, "tenantId is required"),
  caseId: z.string().min(1, "caseId is required"),
  claimId: z.string().min(1, "claimId is required"),
  dataSource: z.string().min(1, "dataSource is required"),
  formula: z.record(z.unknown()).optional(),
  agentId: z.string().min(1, "agentId is required"),
  agentVersion: z.string().min(1, "agentVersion is required"),
  evidenceTier: z.string().optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  parentRecordId: z.string().optional(),
});
const storage = new Map<string, ProvenanceRecord[]>();

/**
 * Create a new provenance record (append-only)
 */
export function createProvenanceRecord(
  input: CreateProvenanceInput
): ProvenanceRecord {
  // Validate input
  const validation = CreateProvenanceInputSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(
      `Invalid CreateProvenanceInput: ${validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
    );
  }

  const record: ProvenanceRecord = {
    id: generateId(),
    tenantId: input.tenantId,
    caseId: input.caseId,
    claimId: input.claimId,
    dataSource: input.dataSource,
    formula: input.formula,
    agentId: input.agentId,
    agentVersion: input.agentVersion,
    evidenceTier: input.evidenceTier,
    confidenceScore: input.confidenceScore,
    parentRecordId: input.parentRecordId,
    createdAt: new Date(),
  };

  // Store in tenant-scoped storage
  const key = `${input.tenantId}:${input.caseId}`;
  const existing = storage.get(key) || [];
  existing.push(record);
  storage.set(key, existing);

  return record;
}

/**
 * Get lineage chain for a claim
 */
export function getLineageChain(
  claimId: string,
  tenantId: string
): LineageChain {
  const records: ProvenanceRecord[] = [];

  // Find all records for this claim in this tenant
  for (const [key, caseRecords] of storage.entries()) {
    if (key.startsWith(`${tenantId}:`)) {
      const claimRecords = caseRecords.filter((r) => r.claimId === claimId);
      records.push(...claimRecords);
    }
  }

  // Sort by creation time descending
  records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Build lineage chain by following parent pointers
  const chain: ProvenanceRecord[] = [];
  const visited = new Set<string>();

  let current: ProvenanceRecord | undefined = records[0];
  while (current && !visited.has(current.id)) {
    chain.push(current);
    visited.add(current.id);

    if (current.parentRecordId) {
      // Find parent record
      current = findRecordById(current.parentRecordId, tenantId);
    } else {
      break;
    }
  }

  return {
    claimId,
    records: chain,
    depth: chain.length,
    root: chain[chain.length - 1] || chain[0],
  };
}

/**
 * Get all provenance records for a case
 */
export function getProvenanceByCase(
  caseId: string,
  tenantId: string
): ProvenanceRecord[] {
  const key = `${tenantId}:${caseId}`;
  return storage.get(key) || [];
}

/**
 * Find a record by ID (tenant-scoped)
 */
function findRecordById(
  id: string,
  tenantId: string
): ProvenanceRecord | undefined {
  for (const [key, records] of storage.entries()) {
    if (key.startsWith(`${tenantId}:`)) {
      const found = records.find((r) => r.id === id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Generate a unique ID using UUID v4
 */
function generateId(): string {
  return uuidv4();
}

/**
 * Clear all storage (for testing)
 */
export function clearProvenanceStorage(): void {
  storage.clear();
}

/**
 * ProvenanceService class
 */
export class ProvenanceService {
  async create(input: CreateProvenanceInput): Promise<ProvenanceRecord> {
    return createProvenanceRecord(input);
  }

  async getLineage(claimId: string, tenantId: string): Promise<LineageChain> {
    return getLineageChain(claimId, tenantId);
  }

  async getByCase(caseId: string, tenantId: string): Promise<ProvenanceRecord[]> {
    return getProvenanceByCase(caseId, tenantId);
  }
}

// Singleton instance
export const provenanceService = new ProvenanceService();
