/**
 * Orchestration Layer: useCanvasState
 * 
 * Manages Artifact Persistence:
 * - Tracks "Dirty" states in the ROI model
 * - Handles version diffing
 * - Manages local optimistic updates before committing to database
 * - Implements snapshot-based undo/redo (Clean Context strategy)
 */

import { useCallback, useRef, useState } from "react";
import { logger } from "../lib/logger";

export interface CanvasSnapshot {
  snapshotId: string;
  parentId: string | null;
  timestamp: string;
  agentContext: {
    currentStep: string;
    activeWorkers: string[];
  };
  canvasData: {
    assumptions: Record<string, number>;
    metrics: Record<string, number>;
  };
  uiMetadata: {
    activePanel: string;
    focusNode: string | null;
  };
}

export interface ValueAssumptions {
  efficiencyGain: number;
  headcount: number;
  hourlyRate: number;
  implementationCost: number;
  timeToValue: number;
}

export interface ValueMetrics {
  totalSavings: number;
  roi: number;
  paybackMonths: number;
  annualValue: number;
}

interface UseCanvasStateOptions {
  maxSnapshots?: number;
  autoSaveInterval?: number;
  onSnapshotCreate?: (snapshot: CanvasSnapshot) => void;
}

interface UseCanvasStateReturn {
  assumptions: ValueAssumptions;
  metrics: ValueMetrics;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  currentSnapshotId: string | null;
  updateAssumption: <K extends keyof ValueAssumptions>(key: K, value: ValueAssumptions[K]) => void;
  calculateMetrics: () => void;
  commit: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

const defaultAssumptions: ValueAssumptions = {
  efficiencyGain: 0.18,
  headcount: 450,
  hourlyRate: 75,
  implementationCost: 150000,
  timeToValue: 6,
};

const defaultMetrics: ValueMetrics = {
  totalSavings: 0,
  roi: 0,
  paybackMonths: 0,
  annualValue: 0,
};

function generateSnapshotId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function useCanvasState(
  options: UseCanvasStateOptions = {}
): UseCanvasStateReturn {
  const { maxSnapshots = 50, onSnapshotCreate } = options;

  const [assumptions, setAssumptions] = useState<ValueAssumptions>(defaultAssumptions);
  const [metrics, setMetrics] = useState<ValueMetrics>(defaultMetrics);
  const [isDirty, setIsDirty] = useState(false);
  
  // Snapshot history for undo/redo
  const snapshotsRef = useRef<CanvasSnapshot[]>([]);
  const currentIndexRef = useRef<number>(-1);
  const [currentSnapshotId, setCurrentSnapshotId] = useState<string | null>(null);

  const canUndo = currentIndexRef.current > 0;
  const canRedo = currentIndexRef.current < snapshotsRef.current.length - 1;

  const createSnapshot = useCallback((): CanvasSnapshot => {
    const parentId = currentSnapshotId;
    const snapshot: CanvasSnapshot = {
      snapshotId: generateSnapshotId(),
      parentId,
      timestamp: new Date().toISOString(),
      agentContext: {
        currentStep: "",
        activeWorkers: [],
      },
      canvasData: {
        assumptions: { ...assumptions } as unknown as Record<string, number>,
        metrics: { ...metrics } as unknown as Record<string, number>,
      },
      uiMetadata: {
        activePanel: "canvas",
        focusNode: null,
      },
    };

    // Trim future snapshots if we're not at the end
    if (currentIndexRef.current < snapshotsRef.current.length - 1) {
      snapshotsRef.current = snapshotsRef.current.slice(0, currentIndexRef.current + 1);
    }

    // Add new snapshot
    snapshotsRef.current.push(snapshot);
    currentIndexRef.current = snapshotsRef.current.length - 1;

    // Trim old snapshots if exceeding max
    if (snapshotsRef.current.length > maxSnapshots) {
      snapshotsRef.current = snapshotsRef.current.slice(-maxSnapshots);
      currentIndexRef.current = snapshotsRef.current.length - 1;
    }

    setCurrentSnapshotId(snapshot.snapshotId);
    onSnapshotCreate?.(snapshot);

    return snapshot;
  }, [assumptions, metrics, currentSnapshotId, maxSnapshots, onSnapshotCreate]);

  const restoreSnapshot = useCallback((snapshot: CanvasSnapshot) => {
    const { assumptions: snapAssumptions, metrics: snapMetrics } = snapshot.canvasData;
    
    setAssumptions({
      efficiencyGain: snapAssumptions.efficiencyGain ?? defaultAssumptions.efficiencyGain,
      headcount: snapAssumptions.headcount ?? defaultAssumptions.headcount,
      hourlyRate: snapAssumptions.hourlyRate ?? defaultAssumptions.hourlyRate,
      implementationCost: snapAssumptions.implementationCost ?? defaultAssumptions.implementationCost,
      timeToValue: snapAssumptions.timeToValue ?? defaultAssumptions.timeToValue,
    });
    
    setMetrics({
      totalSavings: snapMetrics.totalSavings ?? defaultMetrics.totalSavings,
      roi: snapMetrics.roi ?? defaultMetrics.roi,
      paybackMonths: snapMetrics.paybackMonths ?? defaultMetrics.paybackMonths,
      annualValue: snapMetrics.annualValue ?? defaultMetrics.annualValue,
    });
    
    setCurrentSnapshotId(snapshot.snapshotId);
    setIsDirty(false);
  }, []);

  const updateAssumption = useCallback(<K extends keyof ValueAssumptions>(
    key: K,
    value: ValueAssumptions[K]
  ) => {
    setAssumptions((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const calculateMetrics = useCallback(() => {
    const annualHours = assumptions.headcount * 2080; // 40 hrs/week * 52 weeks
    const savedHours = annualHours * assumptions.efficiencyGain;
    const annualSavings = savedHours * assumptions.hourlyRate;
    const totalSavings = annualSavings * 3; // 3-year projection
    const roi = ((totalSavings - assumptions.implementationCost) / assumptions.implementationCost) * 100;
    const paybackMonths = (assumptions.implementationCost / (annualSavings / 12));

    setMetrics({
      totalSavings: Math.round(totalSavings),
      roi: Math.round(roi),
      paybackMonths: Math.round(paybackMonths * 10) / 10,
      annualValue: Math.round(annualSavings),
    });
  }, [assumptions]);

  const commit = useCallback(async () => {
    if (!isDirty) return;

    // Create snapshot before committing
    const snapshot = createSnapshot();
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    setIsDirty(false);
    logger.info("Committed snapshot:", snapshot.snapshotId);
  }, [isDirty, createSnapshot]);

  const undo = useCallback(() => {
    if (!canUndo) return;

    currentIndexRef.current -= 1;
    const snapshot = snapshotsRef.current[currentIndexRef.current];
    if (snapshot) {
      restoreSnapshot(snapshot);
    }
  }, [canUndo, restoreSnapshot]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    currentIndexRef.current += 1;
    const snapshot = snapshotsRef.current[currentIndexRef.current];
    if (snapshot) {
      restoreSnapshot(snapshot);
    }
  }, [canRedo, restoreSnapshot]);

  const reset = useCallback(() => {
    setAssumptions(defaultAssumptions);
    setMetrics(defaultMetrics);
    setIsDirty(false);
    snapshotsRef.current = [];
    currentIndexRef.current = -1;
    setCurrentSnapshotId(null);
  }, []);

  return {
    assumptions,
    metrics,
    isDirty,
    canUndo,
    canRedo,
    currentSnapshotId,
    updateAssumption,
    calculateMetrics,
    commit,
    undo,
    redo,
    reset,
  };
}

export default useCanvasState;
