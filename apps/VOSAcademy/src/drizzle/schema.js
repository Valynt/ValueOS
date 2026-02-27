import { int, json, mysqlTable, text, timestamp, tinyint, varchar } from "drizzle-orm/mysql-core";
// ============================================================================
// User Management
// ============================================================================
export var users = mysqlTable("users", {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    loginMethod: varchar("loginMethod", { length: 50 }),
    role: varchar("role", { length: 50 }),
    vosRole: varchar("vosRole", { length: 50 }),
    maturityLevel: int("maturityLevel").default(1),
    lastSignedIn: timestamp("lastSignedIn"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
// ============================================================================
// Pillars
// ============================================================================
export var pillars = mysqlTable("pillars", {
    id: int("id").autoincrement().primaryKey(),
    pillarNumber: int("pillarNumber").notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    targetMaturityLevel: int("targetMaturityLevel").default(1),
    duration: varchar("duration", { length: 50 }),
    content: json("content").$type(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
// ============================================================================
// Progress Tracking
// ============================================================================
export var progress = mysqlTable("progress", {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    pillarId: int("pillarId").notNull(),
    status: varchar("status", { length: 20 }).notNull(), // "not_started", "in_progress", "completed"
    completionPercentage: int("completionPercentage").default(0),
    lastAccessed: timestamp("lastAccessed").defaultNow(),
    completedAt: timestamp("completedAt"),
});
// ============================================================================
// Quiz Questions
// ============================================================================
export var quizQuestions = mysqlTable("quizQuestions", {
    id: int("id").autoincrement().primaryKey(),
    pillarId: int("pillarId").notNull(),
    questionNumber: int("questionNumber").notNull(),
    questionType: varchar("questionType", { length: 50 }).notNull(), // "multiple_choice", "scenario_based"
    category: varchar("category", { length: 100 }),
    questionText: text("questionText").notNull(),
    options: json("options").$type(),
    correctAnswer: varchar("correctAnswer", { length: 10 }).notNull(),
    points: int("points").default(4),
    explanation: text("explanation"),
    difficultyLevel: varchar("difficultyLevel", { length: 20 }).default("intermediate"), // "beginner", "intermediate", "advanced"
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
// ============================================================================
// Quiz Results
// ============================================================================
export var quizResults = mysqlTable("quizResults", {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    pillarId: int("pillarId").notNull(),
    score: int("score").notNull(),
    categoryScores: json("categoryScores").$type(),
    answers: json("answers").$type(),
    feedback: text("feedback"),
    passed: tinyint("passed").default(0),
    attemptNumber: int("attemptNumber").default(1),
    completedAt: timestamp("completedAt").defaultNow().notNull(),
});
// ============================================================================
// Certifications
// ============================================================================
export var certifications = mysqlTable("certifications", {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    badgeName: varchar("badgeName", { length: 255 }).notNull(),
    pillarId: int("pillarId").notNull(),
    vosRole: varchar("vosRole", { length: 50 }).notNull(),
    tier: varchar("tier", { length: 20 }).default("bronze"), // "bronze", "silver", "gold"
    score: int("score"), // Overall certification score (0-100) using 40/30/30 rubric
    awardedAt: timestamp("awardedAt").defaultNow().notNull(),
});
// ============================================================================
// Maturity Assessments
// ============================================================================
export var maturityAssessments = mysqlTable("maturityAssessments", {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    level: int("level").notNull(),
    assessmentData: json("assessmentData").$type(),
    assessedAt: timestamp("assessedAt").defaultNow().notNull(),
});
// ============================================================================
// Resources
// ============================================================================
export var resources = mysqlTable("resources", {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    resourceType: varchar("resourceType", { length: 50 }).notNull(), // "template", "guide", "playbook", "framework", "kpi_sheet"
    fileUrl: varchar("fileUrl", { length: 500 }).notNull(),
    pillarId: int("pillarId"),
    vosRole: varchar("vosRole", { length: 50 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
// ============================================================================
// Simulation Scenarios
// ============================================================================
export var simulationScenarios = mysqlTable("simulationScenarios", {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    type: varchar("type", { length: 50 }).notNull(), // "business_case", "qbr_expansion"
    difficulty: varchar("difficulty", { length: 20 }).default("intermediate"),
    vosRole: varchar("vosRole", { length: 50 }),
    scenarioData: json("scenarioData").$type(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
// ============================================================================
// Simulation Attempts
// ============================================================================
export var simulationAttempts = mysqlTable("simulationAttempts", {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    scenarioId: int("scenarioId").notNull(),
    attemptNumber: int("attemptNumber").notNull().default(1),
    responsesData: json("responsesData").$type(),
    overallScore: int("overallScore").notNull(),
    categoryScores: json("categoryScores").$type(),
    passed: tinyint("passed").default(0),
    timeSpent: int("timeSpent"), // in seconds
    feedback: text("feedback"),
    completedAt: timestamp("completedAt").defaultNow().notNull(),
});
