/**
 * Checkpoint Manager for atomic DX operations
 * Provides rollback capability if operations fail mid-flight
 */

import fs from "fs";
import path from "path";

export class CheckpointManager {
  constructor(projectRoot) {
    this.checkpointPath = path.join(projectRoot, ".dx-checkpoints.json");
    this.checkpoints = [];
    this.load();
  }

  /**
   * Save a checkpoint before a risky operation
   */
  save(step, state = {}) {
    const id = `checkpoint_${Date.now()}`;
    const checkpoint = {
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
  commit(id) {
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
  rollback() {
    if (this.checkpoints.length === 0) {
      return null;
    }

    const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];
    this.checkpoints = [];
    this.persist();
    return lastCheckpoint;
  }

  /**
   * Clear all checkpoints
   */
  clear() {
    this.checkpoints = [];
    this.persist();
  }

  /**
   * Get last checkpoint
   */
  getLast() {
    return this.checkpoints.length > 0
      ? this.checkpoints[this.checkpoints.length - 1]
      : null;
  }

  load() {
    try {
      if (fs.existsSync(this.checkpointPath)) {
        const data = fs.readFileSync(this.checkpointPath, "utf8");
        this.checkpoints = JSON.parse(data);
      }
    } catch {
      this.checkpoints = [];
    }
  }

  persist() {
    try {
      fs.writeFileSync(this.checkpointPath, JSON.stringify(this.checkpoints, null, 2));
    } catch (error) {
      console.error("Failed to persist checkpoints:", error);
    }
  }
}
