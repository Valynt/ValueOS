import { useState, useCallback } from "react";
import type { Workflow, WorkflowStep, WorkflowStatus } from "../types";

export function useWorkflow(workflowId?: string) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkflow = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      // TODO: Implement actual API call
      setWorkflow({
        id,
        name: "Untitled Workflow",
        status: "draft",
        steps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflow");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addStep = useCallback((step: Omit<WorkflowStep, "id" | "order">) => {
    setWorkflow((prev) => {
      if (!prev) return null;
      const newStep: WorkflowStep = {
        ...step,
        id: `step_${Date.now()}`,
        order: prev.steps.length,
      };
      return {
        ...prev,
        steps: [...prev.steps, newStep],
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const updateStep = useCallback((stepId: string, updates: Partial<WorkflowStep>) => {
    setWorkflow((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        steps: prev.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const removeStep = useCallback((stepId: string) => {
    setWorkflow((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        steps: prev.steps.filter((s) => s.id !== stepId),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const reorderSteps = useCallback((fromIndex: number, toIndex: number) => {
    setWorkflow((prev) => {
      if (!prev) return null;
      const steps = [...prev.steps];
      const [removed] = steps.splice(fromIndex, 1);
      if (removed) {
        steps.splice(toIndex, 0, removed);
      }
      return {
        ...prev,
        steps: steps.map((s, i) => ({ ...s, order: i })),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const executeWorkflow = useCallback(async () => {
    if (!workflow) return;
    setWorkflow((prev) => (prev ? { ...prev, status: "active" } : null));
    // TODO: Implement actual execution
  }, [workflow]);

  return {
    workflow,
    isLoading,
    error,
    loadWorkflow,
    addStep,
    updateStep,
    removeStep,
    reorderSteps,
    executeWorkflow,
  };
}
