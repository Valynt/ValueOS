/**
 * React hook for the Problem Monitor
 *
 * Provides access to problem monitoring in React components
 */

import { useEffect, useState, useCallback } from "react";
import {
  problemMonitor,
  type Problem,
  type ProblemStats,
} from "../services/ProblemMonitor";

export interface UseProblemMonitorResult {
  problems: Problem[];
  stats: ProblemStats | null;
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  updateProblems: (problems: Problem[]) => void;
  getSummary: () => string;
  hasCriticalErrors: () => boolean;
}

/**
 * Hook to use the problem monitor in React components
 */
export function useProblemMonitor(autoStart = false): UseProblemMonitorResult {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [stats, setStats] = useState<ProblemStats | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    // Subscribe to problem updates
    const unsubscribe = problemMonitor.subscribe((newStats) => {
      setStats(newStats);
      setProblems(problemMonitor.getProblems());
    });

    // Auto-start if requested
    if (autoStart) {
      problemMonitor.start();
      setIsRunning(true);
    }

    // Cleanup
    return () => {
      unsubscribe();
      if (autoStart) {
        problemMonitor.stop();
        setIsRunning(false);
      }
    };
  }, [autoStart]);

  const start = useCallback(() => {
    problemMonitor.start();
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    problemMonitor.stop();
    setIsRunning(false);
  }, []);

  const updateProblems = useCallback((newProblems: Problem[]) => {
    problemMonitor.updateProblems(newProblems);
    setProblems(newProblems);
  }, []);

  const getSummary = useCallback(() => {
    return problemMonitor.getSummary();
  }, []);

  const hasCriticalErrors = useCallback(() => {
    return problemMonitor.hasCriticalErrors();
  }, []);

  return {
    problems,
    stats,
    isRunning,
    start,
    stop,
    updateProblems,
    getSummary,
    hasCriticalErrors,
  };
}
