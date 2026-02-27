import { InsertCertification, InsertMaturityAssessment, InsertPillar, InsertProgress, InsertQuizQuestion, InsertQuizResult, InsertResource, InsertSimulationAttempt, InsertSimulationScenario, InsertUser, SimulationAttempt, SimulationScenario } from "../drizzle/schema";
export declare function getDb(): Promise<import("drizzle-orm/mysql2").MySql2Database<Record<string, unknown>> | null>;
export declare function upsertUser(user: InsertUser): Promise<void>;
export declare function getUserByOpenId(openId: string): Promise<{
    name: string | null;
    role: string | null;
    vosRole: string | null;
    id: number;
    createdAt: Date;
    openId: string;
    email: string | null;
    loginMethod: string | null;
    maturityLevel: number | null;
    lastSignedIn: Date | null;
} | undefined>;
export declare function getUserById(userId: number): Promise<{
    name: string | null;
    role: string | null;
    vosRole: string | null;
    id: number;
    createdAt: Date;
    openId: string;
    email: string | null;
    loginMethod: string | null;
    maturityLevel: number | null;
    lastSignedIn: Date | null;
} | undefined>;
export declare function updateUserVosRole(userId: number, vosRole: string): Promise<void>;
export declare function updateUserMaturityLevel(userId: number, level: number): Promise<void>;
export declare function getAllPillars(): Promise<{
    description: string;
    content: {
        overview: string;
        learningObjectives: string[];
        keyTakeaways: string[];
        resources: any[];
    } | null;
    id: number;
    pillarNumber: number;
    title: string;
    targetMaturityLevel: number | null;
    duration: string | null;
    createdAt: Date;
}[]>;
export declare function getPillarById(pillarId: number): Promise<{
    description: string;
    content: {
        overview: string;
        learningObjectives: string[];
        keyTakeaways: string[];
        resources: any[];
    } | null;
    id: number;
    pillarNumber: number;
    title: string;
    targetMaturityLevel: number | null;
    duration: string | null;
    createdAt: Date;
} | undefined>;
export declare function getPillarByNumber(pillarNumber: number): Promise<{
    description: string;
    content: {
        overview: string;
        learningObjectives: string[];
        keyTakeaways: string[];
        resources: any[];
    } | null;
    id: number;
    pillarNumber: number;
    title: string;
    targetMaturityLevel: number | null;
    duration: string | null;
    createdAt: Date;
} | undefined>;
export declare function createPillar(pillar: InsertPillar): Promise<void>;
export declare function getUserProgress(userId: number): Promise<{
    status: string;
    pillarId: number;
    id: number;
    completionPercentage: number | null;
    completedAt: Date | null;
    userId: number;
    lastAccessed: Date | null;
}[]>;
export declare function getUserPillarProgress(userId: number, pillarId: number): Promise<{
    status: string;
    pillarId: number;
    id: number;
    completionPercentage: number | null;
    completedAt: Date | null;
    userId: number;
    lastAccessed: Date | null;
} | undefined>;
export declare function upsertProgress(progressData: InsertProgress): Promise<void>;
export declare function getQuizQuestionsByPillar(pillarId: number): Promise<{
    options: {
        id: string;
        text: string;
    }[] | null;
    pillarId: number;
    id: number;
    createdAt: Date;
    questionNumber: number;
    questionType: string;
    category: string | null;
    questionText: string;
    correctAnswer: string;
    points: number | null;
    explanation: string | null;
    difficultyLevel: string | null;
}[]>;
export declare function createQuizQuestion(question: InsertQuizQuestion): Promise<void>;
export declare function createQuizQuestions(questions: InsertQuizQuestion[]): Promise<void>;
export declare function getUserQuizResults(userId: number, pillarId?: number): Promise<{
    pillarId: number;
    id: number;
    completedAt: Date;
    userId: number;
    answers: {
        questionId: number;
        selectedAnswer: string;
        isCorrect: boolean;
        pointsEarned: number;
    }[] | null;
    score: number;
    categoryScores: Record<string, number> | null;
    passed: number | null;
    feedback: string | null;
    attemptNumber: number | null;
}[]>;
export declare function getLatestQuizResult(userId: number, pillarId: number): Promise<{
    pillarId: number;
    id: number;
    completedAt: Date;
    userId: number;
    answers: {
        questionId: number;
        selectedAnswer: string;
        isCorrect: boolean;
        pointsEarned: number;
    }[] | null;
    score: number;
    categoryScores: Record<string, number> | null;
    passed: number | null;
    feedback: string | null;
    attemptNumber: number | null;
} | undefined>;
export declare function createQuizResult(result: InsertQuizResult): Promise<void>;
export declare function getUserCertifications(userId: number): Promise<{
    pillarId: number;
    vosRole: string;
    id: number;
    userId: number;
    score: number | null;
    badgeName: string;
    tier: string | null;
    awardedAt: Date;
}[]>;
export declare function createCertification(cert: InsertCertification): Promise<void>;
export declare function hasCertification(userId: number, pillarId: number, vosRole: string): Promise<boolean>;
export declare function getUserMaturityAssessments(userId: number): Promise<{
    level: number;
    id: number;
    userId: number;
    assessmentData: {
        selfAssessment: number;
        quizAverage: number;
        pillarsCompleted: number;
        behaviorIndicators: string[];
        recommendations: string[];
    } | null;
    assessedAt: Date;
}[]>;
export declare function getLatestMaturityAssessment(userId: number): Promise<{
    level: number;
    id: number;
    userId: number;
    assessmentData: {
        selfAssessment: number;
        quizAverage: number;
        pillarsCompleted: number;
        behaviorIndicators: string[];
        recommendations: string[];
    } | null;
    assessedAt: Date;
} | undefined>;
export declare function createMaturityAssessment(assessment: InsertMaturityAssessment): Promise<void>;
export declare function getAllResources(): Promise<{
    pillarId: number | null;
    vosRole: string | null;
    id: number;
    title: string;
    createdAt: Date;
    resourceType: string;
    fileUrl: string;
}[]>;
export declare function getResourcesByPillar(pillarId: number): Promise<{
    pillarId: number | null;
    vosRole: string | null;
    id: number;
    title: string;
    createdAt: Date;
    resourceType: string;
    fileUrl: string;
}[]>;
export declare function getResourcesByRole(vosRole: string): Promise<{
    pillarId: number | null;
    vosRole: string | null;
    id: number;
    title: string;
    createdAt: Date;
    resourceType: string;
    fileUrl: string;
}[]>;
export declare function createResource(resource: InsertResource): Promise<void>;
export declare function createSimulationScenario(scenario: InsertSimulationScenario): Promise<void>;
export declare function getAllSimulationScenarios(): Promise<SimulationScenario[]>;
export declare function getSimulationScenarioById(id: number): Promise<SimulationScenario | undefined>;
export declare function createSimulationAttempt(attempt: InsertSimulationAttempt): Promise<void>;
export declare function getUserSimulationAttempts(userId: number, scenarioId?: number): Promise<SimulationAttempt[]>;
export declare function getSimulationAttemptCount(userId: number, scenarioId: number): Promise<number>;
