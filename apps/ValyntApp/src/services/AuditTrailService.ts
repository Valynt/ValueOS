// AuditTrailService.ts
// Minimal stub for formula snapshotting integration

import { FormulaSnapshot } from './SnapshotManager';

export class AuditTrailService {
  private snapshots: FormulaSnapshot[] = [];

  async recordFormulaSnapshot(snapshot: FormulaSnapshot): Promise<void> {
    this.snapshots.push(snapshot);
    // In production, persist to DB or audit log
  }

  async getLastFormulaSnapshot(valueCaseId: string, valueTreeId: string): Promise<FormulaSnapshot | null> {
    // In production, query DB for last snapshot
    const found = this.snapshots
      .filter(s => s.valueCaseId === valueCaseId && s.valueTreeId === valueTreeId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return found[0] || null;
  }
}
