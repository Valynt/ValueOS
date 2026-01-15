/**
 * Knowledge Gain Analytics
 * Measures learning improvement through pre/post assessments
 */
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
    userId: number;
    pillarId: number;
    preAssessmentScore?: number;
    postAssessmentScore: number;
    knowledgeGain: number;
    normalizedGain: number;
    learningEfficiency: number;
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
    highPerformers: number;
    lowPerformers: number;
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
export declare function calculateKnowledgeGain(preScore: number | undefined, postScore: number, timeSpent?: number): {
    knowledgeGain: number;
    normalizedGain: number;
    learningEfficiency: number;
};
/**
 * Analyze knowledge gain patterns from quiz results
 */
export declare function analyzeKnowledgeGain(quizResults: QuizResult[], userRoles: Map<number, string>, pillarNames: Map<number, string>): KnowledgeGainReport;
/**
 * Generate insights from knowledge gain data
 */
export declare function generateKnowledgeGainInsights(report: KnowledgeGainReport): string[];
export {};
