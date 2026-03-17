import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

// ============================================================================
// User Management
// ============================================================================

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  openId: text("open_id").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("login_method"),
  role: text("role"),
  vosRole: text("vos_role"),
  maturityLevel: integer("maturity_level").default(1),
  lastSignedIn: timestamp("last_signed_in", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// Pillars
// ============================================================================

export const pillars = pgTable("pillars", {
  id: serial("id").primaryKey(),
  pillarNumber: integer("pillar_number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  targetMaturityLevel: integer("target_maturity_level").default(1),
  duration: text("duration"),
  content: jsonb("content").$type<{
    overview: string;
    learningObjectives: string[];
    keyTakeaways: string[];
    resources: any[];
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Pillar = typeof pillars.$inferSelect;
export type InsertPillar = typeof pillars.$inferInsert;

// ============================================================================
// Progress Tracking
// ============================================================================

export const progress = pgTable("progress", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pillarId: integer("pillar_id").notNull().references(() => pillars.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // "not_started", "in_progress", "completed"
  completionPercentage: integer("completion_percentage").default(0),
  lastAccessed: timestamp("last_accessed", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type Progress = typeof progress.$inferSelect;
export type InsertProgress = typeof progress.$inferInsert;

// ============================================================================
// Quiz Questions
// ============================================================================

export const quizQuestions = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  pillarId: integer("pillar_id").notNull().references(() => pillars.id, { onDelete: "cascade" }),
  questionNumber: integer("question_number").notNull(),
  questionType: text("question_type").notNull(), // "multiple_choice", "scenario_based"
  category: text("category"),
  questionText: text("question_text").notNull(),
  options: jsonb("options").$type<Array<{
    id: string;
    text: string;
  }>>(),
  correctAnswer: text("correct_answer").notNull(),
  points: integer("points").default(4),
  explanation: text("explanation"),
  difficultyLevel: text("difficulty_level").default("intermediate"), // "beginner", "intermediate", "advanced"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = typeof quizQuestions.$inferInsert;

// ============================================================================
// Quiz Results
// ============================================================================

export const quizResults = pgTable("quiz_results", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pillarId: integer("pillar_id").notNull().references(() => pillars.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  categoryScores: jsonb("category_scores").$type<Record<string, number>>(),
  answers: jsonb("answers").$type<Array<{
    questionId: number;
    selectedAnswer: string;
    isCorrect: boolean;
    pointsEarned: number;
  }>>(),
  feedback: text("feedback"),
  passed: boolean("passed").default(false),
  attemptNumber: integer("attempt_number").default(1),
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
});

export type QuizResult = typeof quizResults.$inferSelect;
export type InsertQuizResult = typeof quizResults.$inferInsert;

// ============================================================================
// Certifications
// ============================================================================

export const certifications = pgTable("certifications", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  badgeName: text("badge_name").notNull(),
  pillarId: integer("pillar_id").notNull().references(() => pillars.id, { onDelete: "cascade" }),
  vosRole: text("vos_role").notNull(),
  tier: text("tier").default("bronze"), // "bronze", "silver", "gold"
  score: integer("score"), // Overall certification score (0-100) using 40/30/30 rubric
  awardedAt: timestamp("awarded_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Certification = typeof certifications.$inferSelect;
export type InsertCertification = typeof certifications.$inferInsert;

// ============================================================================
// Maturity Assessments
// ============================================================================

export const maturityAssessments = pgTable("maturity_assessments", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  level: integer("level").notNull(),
  assessmentData: jsonb("assessment_data").$type<{
    selfAssessment: number;
    quizAverage: number;
    pillarsCompleted: number;
    behaviorIndicators: string[];
    recommendations: string[];
  }>(),
  assessedAt: timestamp("assessed_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MaturityAssessment = typeof maturityAssessments.$inferSelect;
export type InsertMaturityAssessment = typeof maturityAssessments.$inferInsert;

// ============================================================================
// Resources
// ============================================================================

export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  resourceType: text("resource_type").notNull(), // "template", "guide", "playbook", "framework", "kpi_sheet"
  fileUrl: text("file_url").notNull(),
  pillarId: integer("pillar_id").references(() => pillars.id, { onDelete: "set null" }),
  vosRole: text("vos_role"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Resource = typeof resources.$inferSelect;
export type InsertResource = typeof resources.$inferInsert;

// ============================================================================
// Simulation Scenarios
// ============================================================================

export const simulationScenarios = pgTable("simulation_scenarios", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // "business_case", "qbr_expansion"
  difficulty: text("difficulty").default("intermediate"),
  pillarId: integer("pillar_id").references(() => pillars.id, { onDelete: "set null" }),
  vosRole: text("vos_role"),
  scenarioData: jsonb("scenario_data").$type<{
    context: string;
    customerProfile: Record<string, any>;
    objectives: string[];
    steps: Array<{
      stepNumber: number;
      title: string;
      instruction: string;
      promptType: string;
      expectedElements?: string[];
      hints?: string[];
    }>;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SimulationScenario = typeof simulationScenarios.$inferSelect;
export type InsertSimulationScenario = typeof simulationScenarios.$inferInsert;

// ============================================================================
// Simulation Attempts
// ============================================================================

export const simulationAttempts = pgTable("simulation_attempts", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scenarioId: integer("scenario_id").notNull().references(() => simulationScenarios.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull().default(1),
  responsesData: jsonb("responses_data").$type<Array<{
    stepNumber: number;
    userResponse: string;
    aiFeedback: string;
    score: number;
    strengths: string[];
    improvements: string[];
  }>>(),
  overallScore: integer("overall_score").notNull(),
  categoryScores: jsonb("category_scores").$type<{
    technical: number;
    crossFunctional: number;
    aiAugmentation: number;
  }>(),
  passed: boolean("passed").default(false),
  timeSpent: integer("time_spent"), // in seconds
  feedback: text("feedback"),
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SimulationAttempt = typeof simulationAttempts.$inferSelect;
export type InsertSimulationAttempt = typeof simulationAttempts.$inferInsert;
