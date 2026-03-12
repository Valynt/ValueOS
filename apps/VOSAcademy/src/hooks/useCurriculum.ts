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

type UserProgressRow = {
  pillarId: number;
  status: string;
  completionPercentage: number | null;
};

type QuizResultRow = {
  pillarId: number;
  score: number;
  passed: number | null;
};

function deriveModuleProgress(
  modules: CurriculumModule[],
  progressData: UserProgressRow[] | undefined,
  quizResults: QuizResultRow[] | undefined
): { completed: string[]; inProgress: string[] } {
  if (!modules.length) {
    return { completed: [], inProgress: [] };
  }

  const modulesByPillar = new Map<number, CurriculumModule[]>();
  modules.forEach((module) => {
    const existing = modulesByPillar.get(module.pillarId) ?? [];
    existing.push(module);
    modulesByPillar.set(module.pillarId, existing);
  });

  for (const groupedModules of modulesByPillar.values()) {
    groupedModules.sort((a, b) => a.order - b.order);
  }

  const completed = new Set<string>();
  const inProgress = new Set<string>();

  const progressByPillar = new Map<number, UserProgressRow>();
  progressData?.forEach((progress) => {
    progressByPillar.set(progress.pillarId, progress);
  });

  const passedPillars = new Set<number>();
  quizResults?.forEach((result) => {
    if (result.passed === 1 || result.score >= 80) {
      passedPillars.add(result.pillarId);
    }
  });

  modulesByPillar.forEach((pillarModules, pillarId) => {
    if (passedPillars.has(pillarId)) {
      pillarModules.forEach((module) => completed.add(module.id));
      return;
    }

    const progress = progressByPillar.get(pillarId);
    if (!progress) {
      return;
    }

    if (progress.status === 'completed' || (progress.completionPercentage ?? 0) >= 100) {
      pillarModules.forEach((module) => completed.add(module.id));
      return;
    }

    const completionPercentage = Math.max(0, Math.min(progress.completionPercentage ?? 0, 100));
    const completedCount = Math.floor((completionPercentage / 100) * pillarModules.length);

    pillarModules.slice(0, completedCount).forEach((module) => completed.add(module.id));

    if (progress.status === 'in_progress' && completedCount < pillarModules.length) {
      inProgress.add(pillarModules[completedCount].id);
    }
  });

  return {
    completed: [...completed],
    inProgress: [...inProgress].filter((id) => !completed.has(id)),
  };
}

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
  const modules = useMemo(
    () => curriculum?.pillars.flatMap((pillar) => pillar.modules) ?? [],
    [curriculum]
  );

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

  const derivedProgress = useMemo(
    () => deriveModuleProgress(modules, progressData, quizResults),
    [modules, progressData, quizResults]
  );

  const completedModules = derivedProgress.completed;
  const inProgressModules = derivedProgress.inProgress;

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
  const { completedModules, inProgressModules, isLoading: progressLoading } = useProgress();

  const status = useMemo(() => {
    if (!curriculum || !user) return 'locked';

    const module = curriculum.pillars
      .flatMap(pillar => pillar.modules)
      .find(m => m.id === moduleId);

    if (!module) return 'locked';

    return getModuleStatus(
      module,
      user.maturityLevel || 0,
      completedModules,
      inProgressModules
    );
  }, [completedModules, curriculum, inProgressModules, user, moduleId]);

  const canAccess = status !== 'locked';

  return {
    status,
    canAccess,
    isLoading: loading || progressLoading
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
  const { completedModules, inProgressModules, isLoading: progressLoading } = useProgress();

  const pillarStatus = useMemo(() => {
    if (!user?.vosRole) return { canAccess: false, status: 'locked' as const };

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
  }, [completedModules, inProgressModules, user, pillarId]);

  return {
    ...pillarStatus,
    isLoading: loading || progressLoading
  };
}
