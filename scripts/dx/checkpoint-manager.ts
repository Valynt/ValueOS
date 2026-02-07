/**
 * Checkpoint Manager for atomic DX operations
 * Provides rollback capability if operations fail mid-flight
 */

import fs from "fs";
import path from "path";

export interface Checkpoint {
  id: string;
  timestamp: number;
  step: string;
  state: Record<string, unknown>;
}

export class CheckpointManager {
  private checkpointPath: string;
  private checkpoints: Checkpoint[] = [];

  constructor(projectRoot: string) {
    this.checkpointPath = path.join(projectRoot, ".dx-checkpoints.json");
    this.load();
  }

  /**
   * Save a checkpoint before a risky operation
   */
  save(step: string, state: Record<string, unknown> = {}): string {
    const id = `checkpoint_${Date.now()}`;
    const checkpoint: Checkpoint = {
      id,
      timestamp: Date.now(),
      step,
      state,
    };

    this.checkpoints.push(checkpoint);
    this.persist();
    return id;
  }

  /**
   * Verify operation succeeded and commit checkpoint
   */
  commit(id: string): void {
    const index = this.checkpoints.findIndex((cp) => cp.id === id);
    if (index !== -1) {
      // Mark as committed by removing it
      this.checkpoints.splice(index, 1);
      this.persist();
    }
  }

  /**
   * Rollback to last checkpoint
   */
  rollback(): Checkpoint | null {
    if (this.checkpoints.length === 0) {
      return null;
    }

    const lastCheckpoint = this.checkpoints.at(-1);
    if (!lastCheckpoint) {
      return null;
    }
    this.checkpoints = [];
    this.persist();
    return lastCheckpoint;
  }

  /**
   * Clear all checkpoints
   */
  clear(): void {
    this.checkpoints = [];
    this.persist();
  }

  /**
   * Get last checkpoint
   */
  getLast(): Checkpoint | null {
    return this.checkpoints.at(-1) ?? null;
  }

  private load(): void {
    try {
      if (fs.existsSync(this.checkpointPath)) {
        const data = fs.readFileSync(this.checkpointPath, "utf8");
        this.checkpoints = JSON.parse(data);
      }
    } catch {
      this.checkpoints = [];
    }
  }

  private persist(): void {
    try {
      fs.writeFileSync(this.checkpointPath, JSON.stringify(this.checkpoints, null, 2));
    } catch (error) {
      console.error("Failed to persist checkpoints:", error);
    }
  }
}
