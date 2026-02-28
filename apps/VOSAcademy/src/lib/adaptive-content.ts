/**
 * Adaptive Content Rules Engine
 * Determines what content, recommendations, and experiences to show based on user context
 */

import { CurriculumModule, getCurriculumForRole, getRecommendedModules } from '../data/curriculum';
import { canAccessPillar, getModuleStatus, getProgressStats } from './progress-logic';

export interface UserContext {
  role: string;
  maturityLevel: number;
  completedModules: string[];
  inProgressModules: string[];
  recentQuizScores: Array<{ pillarId: number; score: number; date: Date }>;
  lastLoginDate?: Date;
  preferredContentTypes?: string[];
}

export interface ContentRecommendation {
  type: 'module' | 'pillar' | 'assessment' | 'resource' | 'simulation';
  id: string;
  title: string;
  description: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTime?: string;
  prerequisites?: string[];
}

export interface AdaptiveContentResponse {
  nextSteps: ContentRecommendation[];
  blockedContent: Array<{
    id: string;
    title: string;
    reason: string;
  }>;
  personalizedMessages: string[];
  progressInsights: string[];
}

/**
 * Main adaptive content engine
 * Analyzes user context and returns personalized content recommendations
 */
export function getAdaptiveContent(userContext: UserContext): AdaptiveContentResponse {
  const recommendations: ContentRecommendation[] = [];
  const blockedContent: Array<{ id: string; title: string; reason: string }> = [];
  const personalizedMessages: string[] = [];
  const progressInsights: string[] = [];

  const curriculum = getCurriculumForRole(userContext.role);
  if (!curriculum) {
    return {
      nextSteps: [],
      blockedContent: [],
      personalizedMessages: ['Unable to load curriculum for your role.'],
      progressInsights: []
    };
  }

  // Analyze progress
  const progressStats = getProgressStats(
    userContext.role,
    userContext.maturityLevel,
    userContext.completedModules,
    userContext.inProgressModules
  );

  // Generate progress insights
  progressInsights.push(...generateProgressInsights(progressStats, userContext));

  // Recommend next modules
  const recommendedModules = getRecommendedModules(
    userContext.role,
    userContext.maturityLevel,
    userContext.completedModules,
    userContext.inProgressModules,
    3
  );

  for (const module of recommendedModules) {
    recommendations.push({
      type: 'module',
      id: module.id,
      title: module.title,
      description: module.description,
      reason: generateModuleReason(module, userContext),
      priority: 'high',
      estimatedTime: module.estimatedDuration,
      prerequisites: module.prerequisites
    });
  }

  // Recommend assessments if user has completed modules but hasn't taken quizzes
  recommendations.push(...generateAssessmentRecommendations(userContext));

  // Recommend pillars that are now accessible
  recommendations.push(...generatePillarRecommendations(userContext));

  // Recommend resources based on current learning
  recommendations.push(...generateResourceRecommendations(userContext));

  // Identify blocked content
  blockedContent.push(...identifyBlockedContent(userContext));

  // Generate personalized messages
  personalizedMessages.push(...generatePersonalizedMessages(userContext, progressStats));

  return {
    nextSteps: recommendations,
    blockedContent,
    personalizedMessages,
    progressInsights
  };
}

/**
 * Generates insights about user's progress
 */
function generateProgressInsights(
  progressStats: any,
  userContext: UserContext
): string[] {
  const insights: string[] = [];

  if (progressStats.completionPercentage === 0) {
    insights.push("Welcome to VOS Academy! Start with the foundational modules to build your value engineering skills.");
  } else if (progressStats.completionPercentage < 25) {
    insights.push(`You're ${progressStats.completionPercentage}% through your learning journey. Focus on completing the core fundamentals.`);
  } else if (progressStats.completionPercentage < 50) {
    insights.push(`Great progress! You're ${progressStats.completionPercentage}% complete. You're building a solid foundation in value engineering.`);
  } else if (progressStats.completionPercentage < 75) {
    insights.push(`Excellent work! ${progressStats.completionPercentage}% complete. You're developing advanced value engineering capabilities.`);
  } else {
    insights.push(`Outstanding progress! You're ${progressStats.completionPercentage}% complete. You're becoming a value engineering expert.`);
  }

  if (progressStats.nextMilestone) {
    insights.push(`Next milestone: Reach ${progressStats.nextMilestone.label} by completing ${progressStats.nextMilestone.remainingModules} more modules.`);
  }

  // Check for recent low quiz scores
  const recentLowScores = userContext.recentQuizScores
    .filter(score => score.score < 70)
    .slice(-2); // Last 2 low scores

  if (recentLowScores.length > 0) {
    insights.push("Consider reviewing modules where you've scored below 70% to strengthen your understanding.");
  }

  return insights;
}

/**
 * Generates reason why a specific module is recommended
 */
function generateModuleReason(module: CurriculumModule, userContext: UserContext): string {
  const reasons = [];

  // Check if it's a prerequisite for other modules
  const curriculum = getCurriculumForRole(userContext.role);
  if (curriculum) {
    const dependentModules = curriculum.pillars
      .flatMap(pillar => pillar.modules)
      .filter(m => m.prerequisites?.includes(module.id));

    if (dependentModules.length > 0) {
      reasons.push(`Unlocks ${dependentModules.length} advanced module${dependentModules.length > 1 ? 's' : ''}`);
    }
  }

  // Check maturity level alignment
  if (module.requiredMaturityLevel > userContext.maturityLevel) {
    reasons.push(`Advances you to ${module.requiredMaturityLevel === 1 ? 'L1' : `L${module.requiredMaturityLevel}`}`);
  }

  // Check if user struggled with related content
  const relatedQuizScores = userContext.recentQuizScores
    .filter(score => score.pillarId === module.pillarId && score.score < 80);

  if (relatedQuizScores.length > 0) {
    reasons.push("Reinforces concepts from recent quiz performance");
  }

  // Default reasons based on module content
  if (reasons.length === 0) {
    switch (module.pillarId) {
      case 1:
        reasons.push("Builds foundational value language skills");
        break;
      case 2:
        reasons.push("Develops data modeling capabilities");
        break;
      case 3:
        reasons.push("Enhances discovery and problem-solving skills");
        break;
      case 4:
        reasons.push("Strengthens business case development");
        break;
      default:
        reasons.push("Advances your value engineering expertise");
    }
  }

  return reasons[0];
}

/**
 * Generates assessment recommendations
 */
function generateAssessmentRecommendations(userContext: UserContext): ContentRecommendation[] {
  const recommendations: ContentRecommendation[] = [];
  const curriculum = getCurriculumForRole(userContext.role);

  if (!curriculum) return recommendations;

  // Check for pillars with completed modules but no recent quiz attempts
  const pillarsWithCompletedModules = new Set(
    curriculum.pillars
      .filter(pillar => {
        const pillarModules = pillar.modules;
        const completedInPillar = pillarModules.filter(module =>
          userContext.completedModules.includes(module.id)
        );
        return completedInPillar.length > 0;
      })
      .map(pillar => pillar.pillarId)
  );

  for (const pillarId of pillarsWithCompletedModules) {
    const recentQuizAttempt = userContext.recentQuizScores
      .find(score => score.pillarId === pillarId);

    if (!recentQuizAttempt) {
      const pillar = curriculum.pillars.find(p => p.pillarId === pillarId);
      if (pillar) {
        recommendations.push({
          type: 'assessment',
          id: `quiz-${pillarId}`,
          title: `${pillar.title} Assessment`,
          description: `Test your knowledge of ${pillar.title.toLowerCase()}`,
          reason: "Validate your learning and earn certification",
          priority: 'medium',
          estimatedTime: '30 minutes'
        });
      }
    }
  }

  return recommendations;
}

/**
 * Generates pillar access recommendations
 */
function generatePillarRecommendations(userContext: UserContext): ContentRecommendation[] {
  const recommendations: ContentRecommendation[] = [];
  const curriculum = getCurriculumForRole(userContext.role);

  if (!curriculum) return recommendations;

  for (const pillar of curriculum.pillars) {
    if (!canAccessPillar(pillar.pillarId, userContext.role, userContext.maturityLevel, userContext.completedModules)) {
      continue;
    }

    // Check if pillar has accessible modules
    const accessibleModules = pillar.modules.filter(module =>
      getModuleStatus(module, userContext.maturityLevel, userContext.completedModules, userContext.inProgressModules) === 'available'
    );

    if (accessibleModules.length > 0) {
      recommendations.push({
        type: 'pillar',
        id: `pillar-${pillar.pillarId}`,
        title: pillar.title,
        description: pillar.description,
        reason: `${accessibleModules.length} module${accessibleModules.length > 1 ? 's' : ''} now available`,
        priority: accessibleModules.length > 1 ? 'high' : 'medium'
      });
    }
  }

  return recommendations;
}

/**
 * Generates resource recommendations
 */
function generateResourceRecommendations(userContext: UserContext): ContentRecommendation[] {
  const recommendations: ContentRecommendation[] = [];

  // Recommend resources based on current modules
  if (userContext.inProgressModules.length > 0) {
    recommendations.push({
      type: 'resource',
      id: 'pillar-resources',
      title: 'Downloadable Resources',
      description: 'Templates, guides, and tools for your current modules',
      reason: 'Practical tools to apply what you\'re learning',
      priority: 'low'
    });
  }

  // Recommend AI resources if user is advanced
  if (userContext.maturityLevel >= 4) {
    recommendations.push({
      type: 'resource',
      id: 'ai-prompt-library',
      title: 'AI Prompt Library',
      description: 'Curated prompts for value engineering tasks',
      reason: 'Accelerate your work with AI assistance',
      priority: 'medium'
    });
  }

  return recommendations;
}

/**
 * Identifies content that's blocked for the user
 */
function identifyBlockedContent(userContext: UserContext): Array<{ id: string; title: string; reason: string }> {
  const blocked: Array<{ id: string; title: string; reason: string }> = [];
  const curriculum = getCurriculumForRole(userContext.role);

  if (!curriculum) return blocked;

  for (const pillar of curriculum.pillars) {
    if (!canAccessPillar(pillar.pillarId, userContext.role, userContext.maturityLevel, userContext.completedModules)) {
      blocked.push({
        id: `pillar-${pillar.pillarId}`,
        title: pillar.title,
        reason: `Requires maturity level ${pillar.targetMaturityLevel}`
      });
    }
  }

  return blocked.slice(0, 3); // Limit to top 3
}

/**
 * Generates personalized messages based on user context
 */
function generatePersonalizedMessages(userContext: UserContext, progressStats: any): string[] {
  const messages: string[] = [];

  // Welcome message for new users
  if (userContext.completedModules.length === 0 && userContext.inProgressModules.length === 0) {
    messages.push(`Welcome to VOS Academy! As a ${getCurriculumForRole(userContext.role)?.displayName || userContext.role}, you'll develop specialized skills in value engineering.`);
  }

  // Encouragement based on progress
  if (progressStats.completionPercentage > 0) {
    if (progressStats.completionPercentage < 50) {
      messages.push("You're building a strong foundation. Each module completed brings you closer to value engineering mastery.");
    } else {
      messages.push("You're making excellent progress! Your growing expertise will be valuable to your organization.");
    }
  }

  // Role-specific messages
  switch (userContext.role) {
    case 'sales':
      messages.push("Focus on ROI modeling and discovery skills - these will help you win more deals.");
      break;
    case 'customer_success':
      messages.push("Emphasize value realization tracking and expansion opportunities to maximize customer lifetime value.");
      break;
    case 'value_engineer':
      messages.push("As a value engineering expert, you'll master the full spectrum of capabilities across all pillars.");
      break;
  }

  return messages.slice(0, 2); // Limit to 2 messages
}
