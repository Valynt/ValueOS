# ApprovalService Architecture and Implementation

This documentation outlines the `ApprovalService` implementation, designed to manage the lifecycle of versioned objects as they transition from **Draft** to **Approved** status. This service ensures data integrity, maintains an audit trail in the `approvals` table, and manages version inheritance through superseding logic.

## Core Logic & Principles

1.  **State Immutability**: Once a version is approved, its content should remain unchanged. The service strictly controls status transitions to prevent unauthorized modifications.
2.  **Auditability**: Every decision (Approve/Reject) is recorded with the `approver_id` and `notes`.
3.  **Superseding Mechanism**: To prevent "Version Drift," the service can automatically deprecate older versions when a newer version is finalized.
4.  **Export Guard**: The `isExportable` check acts as a final gatekeeper for downstream systems (e.g., publishing or manufacturing exports).

## Technical Implementation

```typescript
import { 
  ApprovalDecision, 
  ApprovalRecord, 
  VersionStatus, 
  VersionableObject, 
  ApprovalContext 
} from './types'; // Assumed types from previous definitions

/**
 * Custom Error for Approval workflow violations
 */
export class ApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApprovalError';
  }
}

/**
 * ApprovalService
 * Handles the promotion of Draft objects to Approved status and manages version history.
 */
export class ApprovalService {
  // Assume repository pattern for database interactions
  constructor(private db: any) {}

  /**
   * Promotes a version to 'Approved' status.
   * Records the decision and optionally supersedes previous versions.
   */
  async approveVersion(
    objectId: string,
    version: number,
    context: ApprovalContext,
    options: { supersedePriorVersions: boolean } = { supersedePriorVersions: true }
  ): Promise<ApprovalRecord> {
    const target = await this.db.objects.findUnique(objectId, version);

    if (!target) {
      throw new ApprovalError(`Object ${objectId} v${version} not found.`);
    }

    if (target.status !== VersionStatus.DRAFT && target.status !== VersionStatus.PENDING) {
      throw new ApprovalError(`Only Draft or Pending objects can be approved. Current status: ${target.status}`);
    }

    return await this.db.transaction(async (tx: any) => {
      // 1. Create the Approval Audit Record
      const approvalRecord: ApprovalRecord = await tx.approvals.create({
        object_id: objectId,
        version: version,
        approver_id: context.approverId,
        decision: ApprovalDecision.APPROVED,
        notes: context.notes,
        timestamp: new Date()
      });

      // 2. Update the Target Object Status
      await tx.objects.update(objectId, version, {
        status: VersionStatus.APPROVED,
        approved_at: new Date(),
        approved_by: context.approverId
      });

      // 3. Handle Superseding Logic
      if (options.supersedePriorVersions) {
        await tx.objects.updateMany(
          { 
            id: objectId, 
            version: { lt: version }, 
            status: VersionStatus.APPROVED 
          },
          { status: VersionStatus.SUPERSEDED }
        );
      }

      return approvalRecord;
    });
  }

  /**
   * Rejects a version, returning it to Draft or a specific Rejected state.
   */
  async rejectVersion(
    objectId: string,
    version: number,
    context: ApprovalContext
  ): Promise<ApprovalRecord> {
    return await this.db.approvals.create({
      object_id: objectId,
      version: version,
      approver_id: context.approverId,
      decision: ApprovalDecision.REJECTED,
      notes: context.notes,
      timestamp: new Date()
    });
    
    // Additional logic to update object status to 'Rejected' would follow
  }

  /**
   * Strictly enforces the 'approved' status requirement for exports.
   * This is a read-only check used by external distribution modules.
   */
  async isExportable(objectId: string, version: number): Promise<boolean> {
    const record = await this.db.objects.findUnique(objectId, version);
    
    if (!record) return false;

    // Strict Check: Only 'Approved' items are exportable.
    // Superseded or Draft items are blocked.
    return record.status === VersionStatus.APPROVED;
  }
}
```

## Workflow & State Transitions

The table below illustrates how the `ApprovalService` transitions an object through its lifecycle.

| Current Status | Action | Resulting Status | Superseding Effect |
| :--- | :--- | :--- | :--- |
| `Draft` | `approveVersion` | **Approved** | Prior `Approved` versions become `Superseded` |
| `Pending` | `approveVersion` | **Approved** | Prior `Approved` versions become `Superseded` |
| `Approved` | `isExportable` | **True** | None |
| `Superseded` | `isExportable` | **False** | None |
| `Draft` | `isExportable` | **False** | None |

## Strategic Considerations

### 1. Atomic Transactions
The implementation uses a database transaction (`tx`). This is critical to ensure that we never have a scenario where an approval record is created but the object status update fails, or where multiple versions are marked as "Approved" simultaneously when superseding is required.

### 2. The `isExportable` Guard
The `isExportable` method is decoupled from the approval logic to allow for high-frequency checks by API gateways or export workers without the overhead of full workflow validation. It returns a `boolean` to ensure calling services can make binary decisions quickly.

### 3. Superseding Logic
By default, the service assumes that approving a newer version (`v2`) renders the older version (`v1`) obsolete. 
*   **Target Selection**: `version: { lt: version }` ensures we only supersede older versions.
*   **Status Filtering**: We only supersede versions that were currently `Approved`. `Draft` or `Rejected` versions remain in their respective states to preserve work-in-progress history.

### 4. Audit Trail Requirements
The `approvals` table serves as the "System of Record" for compliance. 
- **`approver_id`**: Foreign key to the User/Auth system.
- **`notes`**: Essential for capturing the rationale behind approvals, particularly in regulated environments.