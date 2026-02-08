/**
 * Knowledge Gain Analytics
 * Measures learning improvement through pre/post assessments
 */

// Local interface for quiz result (to avoid import issues)
interface QuizResult {
  id: number;
  userId: number;
  pillarId: number;
  score: number;
  timeSpent?: number;
  completedAt: Date | string;
  passed: boolean;
}

export interface KnowledgeGainMetrics {
  userId: string;
  pillarId: number;
  preAssessmentScore?: number;
  postAssessmentScore: number;
  knowledgeGain: number; // post - pre
  normalizedGain: number; // gain relative to maximum possible improvement
  learningEfficiency: number; // gain per unit time spent
  timeSpent: number;
  assessmentDate: Date;
}

export interface PillarKnowledgeGain {
  pillarId: number;
  pillarName: string;
  averagePreScore: number;
  averagePostScore: number;
  averageGain: number;
  normalizedGain: number;
  totalAssessments: number;
  highPerformers: number; // users with gain > 20 points
  lowPerformers: number; // users with gain < 5 points
}

export interface RoleKnowledgeGain {
  role: string;
  averageGain: number;
  normalizedGain: number;
  totalUsers: number;
  averageTimeSpent: number;
  learningEfficiency: number;
}

export interface KnowledgeGainReport {
  overall: {
    totalAssessments: number;
    averageGain: number;
    normalizedGain: number;
    highPerformers: number;
    lowPerformers: number;
  };
  byPillar: PillarKnowledgeGain[];
  byRole: RoleKnowledgeGain[];
  trends: {
    monthly: Array<{
      month: string;
      averageGain: number;
      totalAssessments: number;
    }>;
  };
}

/**
 * Calculate knowledge gain metrics from quiz results
 */
export function calculateKnowledgeGain(
  preScore: number | undefined,
  postScore: number,
  timeSpent: number = 0
): {
  knowledgeGain: number;
  normalizedGain: number;
  learningEfficiency: number;
} {
  const knowledgeGain = postScore - (preScore || 0);
  const maxPossibleGain = preScore ? 100 - preScore : 100;
  const normalizedGain = maxPossibleGain > 0 ? (knowledgeGain / maxPossibleGain) * 100 : 0;
  const learningEfficiency = timeSpent > 0 ? knowledgeGain / (timeSpent / 60) : 0; // gain per hour

  return {
    knowledgeGain,
    normalizedGain,
    learningEfficiency,
  };
}

/**
 * Analyze knowledge gain patterns from quiz results
 */
export function analyzeKnowledgeGain(
  quizResults: QuizResult[],
  userRoles: Map<string, string>,
  pillarNames: Map<number, string>
): KnowledgeGainReport {
  // Group results by user and pillar for pre/post analysis
  const userPillarResults = new Map<string, QuizResult[]>();

  quizResults.forEach(result => {
    const key = `${result.userId}-${result.pillarId}`;
    if (!userPillarResults.has(key)) {
      userPillarResults.set(key, []);
    }
    userPillarResults.get(key)?.push(result);
  });

  // Calculate knowledge gain for each user-pillar combination
  const knowledgeGains: KnowledgeGainMetrics[] = [];

  userPillarResults.forEach((results, key) => {
    const parts = key.split('-');
    const pillarId = Number(parts[parts.length - 1]);
    const userId = parts.slice(0, -1).join('-');
    const sortedResults = results.sort((a, b) =>
      new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    );

    // For now, assume first attempt is pre-assessment, last is post
    // In a real implementation, you'd have explicit pre/post flags
    if (sortedResults.length >= 2) {
      const preAssessment = sortedResults[0];
      const postAssessment = sortedResults[sortedResults.length - 1];

      const { knowledgeGain, normalizedGain, learningEfficiency } = calculateKnowledgeGain(
        preAssessment.score,
        postAssessment.score,
        postAssessment.timeSpent || 0
      );

      knowledgeGains.push({
        userId,
        pillarId,
        preAssessmentScore: preAssessment.score,
        postAssessmentScore: postAssessment.score,
        knowledgeGain,
        normalizedGain,
        learningEfficiency,
        timeSpent: postAssessment.timeSpent || 0,
        assessmentDate: new Date(postAssessment.completedAt),
      });
    } else if (sortedResults.length === 1) {
      // Single assessment - treat as post-assessment only
      const postAssessment = sortedResults[0];
      const { knowledgeGain, normalizedGain, learningEfficiency } = calculateKnowledgeGain(
        undefined,
        postAssessment.score,
        postAssessment.timeSpent || 0
      );

      knowledgeGains.push({
        userId,
        pillarId,
        postAssessmentScore: postAssessment.score,
        knowledgeGain,
        normalizedGain,
        learningEfficiency,
        timeSpent: postAssessment.timeSpent || 0,
        assessmentDate: new Date(postAssessment.completedAt),
      });
    }
  });

  // Calculate overall metrics
  const totalAssessments = knowledgeGains.length;
  const averageGain = totalAssessments > 0
    ? knowledgeGains.reduce((sum, kg) => sum + kg.knowledgeGain, 0) / totalAssessments
    : 0;
  const normalizedGain = totalAssessments > 0
    ? knowledgeGains.reduce((sum, kg) => sum + kg.normalizedGain, 0) / totalAssessments
    : 0;

  const highPerformers = knowledgeGains.filter(kg => kg.knowledgeGain > 20).length;
  const lowPerformers = knowledgeGains.filter(kg => kg.knowledgeGain < 5).length;

  // Group by pillar
  const pillarGroups = new Map<number, KnowledgeGainMetrics[]>();
  knowledgeGains.forEach(kg => {
    if (!pillarGroups.has(kg.pillarId)) {
      pillarGroups.set(kg.pillarId, []);
    }
    pillarGroups.get(kg.pillarId)?.push(kg);
  });

  const byPillar: PillarKnowledgeGain[] = Array.from(pillarGroups.entries()).map(([pillarId, gains]) => {
    const avgPreScore = gains
      .filter(g => g.preAssessmentScore !== undefined)
      .reduce((sum, g) => sum + (g.preAssessmentScore || 0), 0) / gains.filter(g => g.preAssessmentScore !== undefined).length || 0;

    const avgPostScore = gains.reduce((sum, g) => sum + g.postAssessmentScore, 0) / gains.length;
    const avgGain = gains.reduce((sum, g) => sum + g.knowledgeGain, 0) / gains.length;
    const normGain = gains.reduce((sum, g) => sum + g.normalizedGain, 0) / gains.length;

    return {
      pillarId,
      pillarName: pillarNames.get(pillarId) || `Pillar ${pillarId}`,
      averagePreScore: Math.round(avgPreScore),
      averagePostScore: Math.round(avgPostScore),
      averageGain: Math.round(avgGain),
      normalizedGain: Math.round(normGain),
      totalAssessments: gains.length,
      highPerformers: gains.filter(g => g.knowledgeGain > 20).length,
      lowPerformers: gains.filter(g => g.knowledgeGain < 5).length,
    };
  });

  // Group by role
  const roleGroups = new Map<string, KnowledgeGainMetrics[]>();
  knowledgeGains.forEach(kg => {
    const role = userRoles.get(kg.userId) || 'Unknown';
    if (!roleGroups.has(role)) {
      roleGroups.set(role, []);
    }
    roleGroups.get(role)?.push(kg);
  });

  const byRole: RoleKnowledgeGain[] = Array.from(roleGroups.entries()).map(([role, gains]) => {
    const avgGain = gains.reduce((sum, g) => sum + g.knowledgeGain, 0) / gains.length;
    const normGain = gains.reduce((sum, g) => sum + g.normalizedGain, 0) / gains.length;
    const avgTimeSpent = gains.reduce((sum, g) => sum + g.timeSpent, 0) / gains.length;
    const learningEfficiency = avgTimeSpent > 0 ? avgGain / (avgTimeSpent / 60) : 0;

    return {
      role,
      averageGain: Math.round(avgGain),
      normalizedGain: Math.round(normGain),
      totalUsers: gains.length,
      averageTimeSpent: Math.round(avgTimeSpent),
      learningEfficiency: Math.round(learningEfficiency * 100) / 100,
    };
  });

  // Calculate monthly trends
  const monthlyData = new Map<string, { totalGain: number; count: number }>();
  knowledgeGains.forEach(kg => {
    const month = kg.assessmentDate.toISOString().slice(0, 7); // YYYY-MM
    if (!monthlyData.has(month)) {
      monthlyData.set(month, { totalGain: 0, count: 0 });
    }
    const data = monthlyData.get(month)!;
    data.totalGain += kg.knowledgeGain;
    data.count += 1;
  });

  const trends = {
    monthly: Array.from(monthlyData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        averageGain: Math.round(data.totalGain / data.count),
        totalAssessments: data.count,
      })),
  };

  return {
    overall: {
      totalAssessments,
      averageGain: Math.round(averageGain),
      normalizedGain: Math.round(normalizedGain),
      highPerformers,
      lowPerformers,
    },
    byPillar,
    byRole,
    trends,
  };
}

/**
 * Generate insights from knowledge gain data
 */
export function generateKnowledgeGainInsights(report: KnowledgeGainReport): string[] {
  const insights: string[] = [];

  // Overall insights
  if (report.overall.averageGain > 15) {
    insights.push(`🎉 Excellent learning outcomes with an average knowledge gain of ${report.overall.averageGain} points`);
  } else if (report.overall.averageGain > 10) {
    insights.push(`👍 Good learning progress with an average gain of ${report.overall.averageGain} points`);
  } else {
    insights.push(`📈 Learning gains of ${report.overall.averageGain} points indicate room for improvement in content effectiveness`);
  }

  // High performers
  const highPerformerRate = report.overall.totalAssessments > 0
    ? (report.overall.highPerformers / report.overall.totalAssessments) * 100
    : 0;
  if (highPerformerRate > 30) {
    insights.push(`⭐ ${Math.round(highPerformerRate)}% of learners are high performers (gain >20 points)`);
  }

  // Pillar-specific insights
  const topPillar = report.byPillar.reduce((best, current) =>
    current.averageGain > best.averageGain ? current : best
  , report.byPillar[0]);

  if (topPillar) {
    insights.push(`🏆 ${topPillar.pillarName} shows the highest learning gains (${topPillar.averageGain} points)`);
  }

  // Role-specific insights
  const topRole = report.byRole.reduce((best, current) =>
    current.averageGain > best.averageGain ? current : best
  , report.byRole[0]);

  if (topRole) {
    insights.push(`🎯 ${topRole.role} role shows strongest learning outcomes (${topRole.averageGain} points)`);
  }

  // Time-based insights
  const recentTrend = report.trends.monthly.slice(-2);
  if (recentTrend.length === 2) {
    const [older, newer] = recentTrend;
    const change = newer.averageGain - older.averageGain;
    if (change > 5) {
      insights.push(`📊 Learning effectiveness is improving (+${change} points in recent months)`);
    } else if (change < -5) {
      insights.push(`⚠️ Learning effectiveness has declined (${change} points in recent months)`);
    }
  }

  return insights;
}
