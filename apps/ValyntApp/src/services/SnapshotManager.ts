// SnapshotManager.ts
// Handles immutable formula snapshots for ValueTree modifications

import { AuditTrailService } from './AuditTrailService';

export interface FormulaSnapshot {
  id: string;
  valueCaseId: string;
  valueTreeId: string;
  formula: any;
  timestamp: string;
  agent: string;
  reason: string;
}

export class SnapshotManager {
  private auditTrail: AuditTrailService;

  constructor(auditTrail: AuditTrailService) {
    this.auditTrail = auditTrail;
  }

  async createSnapshot({ valueCaseId, valueTreeId, formula, agent, reason }: Omit<FormulaSnapshot, 'id' | 'timestamp'>): Promise<FormulaSnapshot> {
    const snapshot: FormulaSnapshot = {
      id: this.generateId(),
      valueCaseId,
      valueTreeId,
      formula: JSON.parse(JSON.stringify(formula)),
      timestamp: new Date().toISOString(),
      agent,
      reason,
    };
    await this.auditTrail.recordFormulaSnapshot(snapshot);
    return snapshot;
  }

  async getLastSnapshot(valueCaseId: string, valueTreeId: string): Promise<FormulaSnapshot | null> {
    return this.auditTrail.getLastFormulaSnapshot(valueCaseId, valueTreeId);
  }

  private generateId(): string {
    return 'snap_' + Math.random().toString(36).substr(2, 9);
  }
}
