/**
 * Module Completion and Progress Logic
 * Defines how modules are completed, locked, and unlocked based on curriculum rules
 */

import { CurriculumModule, getCurriculumForRole, MATURITY_LEVELS } from '@/data/curriculum';

export type ModuleStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface ModuleProgress {
  moduleId: string;
  status: ModuleStatus;
  completionPercentage: number;
  lastAccessed?: Date;
  completedAt?: Date;
  quizAttempts?: number;
  quizScore?: number;
}

export interface PillarProgress {
  pillarId: number;
  completedModules: number;
  totalModules: number;
  completionPercentage: number;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
}

/**
 * Determines the status of a module for a given user
 */
export function getModuleStatus(
  module: CurriculumModule,
  userMaturityLevel: number,
  completedModuleIds: string[],
  inProgressModuleIds: string[] = []
): ModuleStatus {
  // Check if module is already completed
  if (completedModuleIds.includes(module.id)) {
    return 'completed';
  }

  // Check if module is in progress
  if (inProgressModuleIds.includes(module.id)) {
    return 'in_progress';
  }

  // Check maturity level requirement
  if (userMaturityLevel < module.requiredMaturityLevel) {
    return 'locked';
  }

  // Check prerequisites
  if (module.prerequisites) {
    const hasAllPrerequisites = module.prerequisites.every(prereq =>
      completedModuleIds.includes(prereq)
    );
    if (!hasAllPrerequisites) {
      return 'locked';
    }
  }

  return 'available';
}

/**
 * Determines the overall status of a pillar for a user
 */
export function getPillarStatus(
  pillarId: number,
  userRole: string,
  userMaturityLevel: number,
  completedModuleIds: string[],
  inProgressModuleIds: string[] = []
): PillarProgress {
  const curriculum = getCurriculumForRole(userRole);
  if (!curriculum) {
    return {
      pillarId,
      completedModules: 0,
      totalModules: 0,
      completionPercentage: 0,
      status: 'locked'
    };
  }

  const pillar = curriculum.pillars.find(p => p.pillarId === pillarId);
  if (!pillar) {
    return {
      pillarId,
      completedModules: 0,
      totalModules: 0,
      completionPercentage: 0,
      status: 'locked'
    };
  }

  const modules = pillar.modules;
  const totalModules = modules.length;
  const completedModules = modules.filter(module =>
    completedModuleIds.includes(module.id)
  ).length;

  const completionPercentage = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

  // Check if pillar is accessible (at least one module should be available)
  const accessibleModules = modules.filter(module =>
    getModuleStatus(module, userMaturityLevel, completedModuleIds, inProgressModuleIds) !== 'locked'
  );

  let status: 'locked' | 'available' | 'in_progress' | 'completed';

  if (completedModules === totalModules) {
    status = 'completed';
  } else if (accessibleModules.length > 0) {
    status = 'in_progress';
  } else if (userMaturityLevel >= pillar.targetMaturityLevel) {
    status = 'available';
  } else {
    status = 'locked';
  }

  return {
    pillarId,
    completedModules,
    totalModules,
    completionPercentage,
    status
  };
}

/**
 * Calculates user's overall maturity level based on completed modules and pillars
 */
export function calculateMaturityLevel(
  userRole: string,
  completedModuleIds: string[]
): number {
  const curriculum = getCurriculumForRole(userRole);
  if (!curriculum) return 0;

  const allModules = curriculum.pillars.flatMap(pillar => pillar.modules);
  const totalModules = allModules.length;
  const completedModules = allModules.filter(module =>
    completedModuleIds.includes(module.id)
  );

  if (totalModules === 0) return 0;

  const completionRate = completedModules.length / totalModules;

  // Map completion rate to maturity levels
  if (completionRate >= 0.9) return 5; // 90%+ completion
  if (completionRate >= 0.75) return 4; // 75%+ completion
  if (completionRate >= 0.6) return 3;  // 60%+ completion
  if (completionRate >= 0.4) return 2;  // 40%+ completion
  if (completionRate >= 0.2) return 1;  // 20%+ completion

  return 0;
}

/**
 * Determines if a user can access a pillar based on role and progress
 */
export function canAccessPillar(
  pillarId: number,
  userRole: string,
  userMaturityLevel: number,
  completedModuleIds: string[] = []
): boolean {
  const pillarProgress = getPillarStatus(
    pillarId,
    userRole,
    userMaturityLevel,
    completedModuleIds
  );

  return pillarProgress.status !== 'locked';
}

/**
 * Gets recommended next modules for a user based on their current progress
 */
export function getRecommendedModules(
  userRole: string,
  userMaturityLevel: number,
  completedModuleIds: string[],
  inProgressModuleIds: string[] = [],
  limit: number = 3
): CurriculumModule[] {
  const curriculum = getCurriculumForRole(userRole);
  if (!curriculum) return [];

  // Get all available modules (not completed, not locked)
  const availableModules = curriculum.pillars
    .flatMap(pillar => pillar.modules)
    .filter(module => {
      const status = getModuleStatus(module, userMaturityLevel, completedModuleIds, inProgressModuleIds);
      return status === 'available';
    })
    .filter(module => !completedModuleIds.includes(module.id))
    .filter(module => !inProgressModuleIds.includes(module.id));

  // Sort by pillar order, then module order
  availableModules.sort((a, b) => {
    if (a.pillarId !== b.pillarId) {
      return a.pillarId - b.pillarId;
    }
    return a.order - b.order;
  });

  return availableModules.slice(0, limit);
}

/**
 * Validates module completion requirements
 */
export function canCompleteModule(
  moduleId: string,
  userRole: string,
  userMaturityLevel: number,
  completedModuleIds: string[],
  quizScore?: number
): { canComplete: boolean; reason?: string } {
  const curriculum = getCurriculumForRole(userRole);
  if (!curriculum) {
    return { canComplete: false, reason: 'Invalid role' };
  }

  const module = curriculum.pillars
    .flatMap(pillar => pillar.modules)
    .find(m => m.id === moduleId);

  if (!module) {
    return { canComplete: false, reason: 'Module not found' };
  }

  // Check maturity level
  if (userMaturityLevel < module.requiredMaturityLevel) {
    return { canComplete: false, reason: `Requires maturity level ${module.requiredMaturityLevel}` };
  }

  // Check prerequisites
  if (module.prerequisites) {
    const missingPrereqs = module.prerequisites.filter(prereq =>
      !completedModuleIds.includes(prereq)
    );
    if (missingPrereqs.length > 0) {
      return { canComplete: false, reason: `Missing prerequisites: ${missingPrereqs.join(', ')}` };
    }
  }

  // For modules with quizzes, check score
  if (quizScore !== undefined && quizScore < 80) {
    return { canComplete: false, reason: 'Quiz score must be 80% or higher' };
  }

  return { canComplete: true };
}

/**
 * Gets progress statistics for dashboard display
 */
export function getProgressStats(
  userRole: string,
  userMaturityLevel: number,
  completedModuleIds: string[],
  inProgressModuleIds: string[] = []
) {
  const curriculum = getCurriculumForRole(userRole);
  if (!curriculum) {
    return {
      totalModules: 0,
      completedModules: 0,
      inProgressModules: 0,
      completionPercentage: 0,
      currentMaturityLevel: userMaturityLevel,
      nextMilestone: null
    };
  }

  const allModules = curriculum.pillars.flatMap(pillar => pillar.modules);
  const totalModules = allModules.length;
  const completedModules = allModules.filter(module =>
    completedModuleIds.includes(module.id)
  ).length;
  const inProgressModules = allModules.filter(module =>
    inProgressModuleIds.includes(module.id)
  ).length;

  const completionPercentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  // Calculate what maturity level they should be at based on completion
  const calculatedMaturityLevel = calculateMaturityLevel(userRole, completedModuleIds);

  // Find next milestone
  let nextMilestone = null;
  if (calculatedMaturityLevel < 5) {
    const nextLevel = calculatedMaturityLevel + 1;
    const requiredCompletion = getCompletionThresholdForLevel(nextLevel);
    nextMilestone = {
      level: nextLevel,
      label: MATURITY_LEVELS[nextLevel].label,
      requiredCompletion: requiredCompletion,
      remainingModules: Math.ceil((requiredCompletion / 100) * totalModules) - completedModules
    };
  }

  return {
    totalModules,
    completedModules,
    inProgressModules,
    completionPercentage,
    currentMaturityLevel: calculatedMaturityLevel,
    nextMilestone
  };
}

/**
 * Helper function to get completion threshold for maturity levels
 */
function getCompletionThresholdForLevel(level: number): number {
  switch (level) {
    case 1: return 20;
    case 2: return 40;
    case 3: return 60;
    case 4: return 75;
    case 5: return 90;
    default: return 0;
  }
}
