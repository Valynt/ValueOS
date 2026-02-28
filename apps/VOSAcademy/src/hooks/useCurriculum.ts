/**
 * React hooks for curriculum and progress management
 */

import { useMemo } from "react";

import {
  CurriculumModule,
  getCurriculumForRole,
  getModulesForRole,
  getRecommendedModules,
  RoleCurriculum
} from '../data/curriculum';
import {
  getModuleStatus,
  getPillarStatus,
  getProgressStats,
  ModuleStatus
} from '../lib/progress-logic';
import { trpc } from '../lib/trpc';

import { useAuth } from '@/hooks/useAuth';

/**
 * Hook to get user's curriculum based on their role
 */
export function useCurriculum(): {
  curriculum: RoleCurriculum | undefined;
  modules: CurriculumModule[];
  isLoading: boolean;
} {
  const { user, loading } = useAuth();

  const curriculum = useMemo(() => {
    if (!user?.vosRole) return undefined;
    return getCurriculumForRole(user.vosRole);
  }, [user?.vosRole]);

  const modules = useMemo(() => {
    if (!curriculum) return [];
    return curriculum.pillars.flatMap(pillar => pillar.modules);
  }, [curriculum]);

  return {
    curriculum,
    modules,
    isLoading: loading
  };
}

/**
 * Hook to get user's progress and recommended next steps
 */
export function useProgress(): {
  progressStats: ReturnType<typeof getProgressStats>;
  recommendedModules: CurriculumModule[];
  completedModules: string[];
  inProgressModules: string[];
  isLoading: boolean;
} {
  const { user, loading: authLoading } = useAuth();
  const { curriculum } = useCurriculum();

  // Get real progress data from database
  const { data: progressData, isLoading: progressLoading } = trpc.progress.getUserProgress.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Get quiz results to determine completed modules
  const { data: quizResults, isLoading: quizLoading } = trpc.quiz.getResults.useQuery(
    undefined,
    { enabled: !!user }
  );

  const completedModules = useMemo(() => {
    if (!progressData || !quizResults) return [];

    const completedFromProgress = progressData
      .filter(p => p.status === 'completed')
      .map(p => `pillar-${p.pillarId}-module-${p.completionPercentage}`); // This needs better mapping

    // For now, assume modules are completed when quizzes are passed
    const completedFromQuizzes = quizResults
      .filter(result => result.score >= 80) // 80% pass threshold
      .map(result => `pillar-${result.pillarId}`); // This is simplified

    return [...new Set([...completedFromProgress, ...completedFromQuizzes])];
  }, [progressData, quizResults]);

  const inProgressModules = useMemo(() => {
    if (!progressData) return [];

    return progressData
      .filter(p => p.status === 'in_progress')
      .map(p => `pillar-${p.pillarId}`); // Simplified mapping
  }, [progressData]);

  const progressStats = useMemo(() => {
    if (!curriculum || !user) return null;
    return getProgressStats(
      user.vosRole || '',
      user.maturityLevel || 0,
      completedModules,
      inProgressModules
    );
  }, [curriculum, user, completedModules, inProgressModules]);

  const recommendedModules = useMemo(() => {
    if (!curriculum || !user) return [];
    return getRecommendedModules(
      user.vosRole || '',
      user.maturityLevel || 0,
      completedModules,
      inProgressModules,
      5
    );
  }, [curriculum, user, completedModules, inProgressModules]);

  return {
    progressStats,
    recommendedModules,
    completedModules,
    inProgressModules,
    isLoading: authLoading || progressLoading || quizLoading
  };
}

/**
 * Hook to get module status for a specific module
 */
export function useModuleStatus(moduleId: string): {
  status: ModuleStatus;
  canAccess: boolean;
  isLoading: boolean;
} {
  const { user, loading } = useAuth();
  const { curriculum } = useCurriculum();

  const status = useMemo(() => {
    if (!curriculum || !user) return 'locked';

    const module = curriculum.pillars
      .flatMap(pillar => pillar.modules)
      .find(m => m.id === moduleId);

    if (!module) return 'locked';

    // TODO: Get actual progress data
    const completedModules: string[] = [];
    const inProgressModules: string[] = [];

    return getModuleStatus(
      module,
      user.maturityLevel || 0,
      completedModules,
      inProgressModules
    );
  }, [curriculum, user, moduleId]);

  const canAccess = status !== 'locked';

  return {
    status,
    canAccess,
    isLoading: loading
  };
}

/**
 * Hook to get pillar availability based on curriculum
 */
export function usePillarAccess(pillarId: number): {
  canAccess: boolean;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  isLoading: boolean;
} {
  const { user, loading } = useAuth();

  const pillarStatus = useMemo(() => {
    if (!user?.vosRole) return { canAccess: false, status: 'locked' as const };

    // TODO: Get actual progress data
    const completedModules: string[] = [];
    const inProgressModules: string[] = [];

    const status = getPillarStatus(
      pillarId,
      user.vosRole,
      user.maturityLevel || 0,
      completedModules,
      inProgressModules
    );

    return {
      canAccess: status.status !== 'locked',
      status: status.status
    };
  }, [user, pillarId]);

  return {
    ...pillarStatus,
    isLoading: loading
  };
}
