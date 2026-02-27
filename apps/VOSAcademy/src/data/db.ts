import { and, avg, count, desc, eq, sql } from "drizzle-orm";
import {
  Certification,
  certifications,
  InsertCertification,
  InsertMaturityAssessment,
  InsertPillar,
  InsertProgress,
  InsertQuizQuestion,
  InsertQuizResult,
  InsertResource,
  InsertSimulationAttempt,
  InsertSimulationScenario,
  InsertUser,
  MaturityAssessment,
  maturityAssessments,
  Pillar,
  pillars,
  progress,
  Progress,
  quizQuestions,
  QuizResult,
  quizResults,
  resources,
  SimulationAttempt,
  simulationAttempts,
  SimulationScenario,
  simulationScenarios,
  User,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { getDbConnection } from "./_core/db-connection";

export async function getDb() {
  return getDbConnection();
}

// Re-export commonly used Drizzle ORM functions for convenience
export { sql, count, avg, eq, and, desc };

// ============================================================================
// User Management
// ============================================================================

export async function upsertUser(user: Partial<User> & { openId: string }): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: Record<string, unknown> = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (user.vosRole !== undefined) {
      values.vosRole = user.vosRole;
      updateSet.vosRole = user.vosRole;
    }
    if (user.maturityLevel !== undefined) {
      values.maturityLevel = user.maturityLevel;
      updateSet.maturityLevel = user.maturityLevel;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    const existing = await getUserByOpenId(user.openId);
    if (existing) {
      await db.update(users).set(updateSet as Partial<User>).where(eq(users.openId, user.openId));
    } else {
      await db.insert(users).values(values as InsertUser);
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserVosRole(userId: string, vosRole: string) {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set({ vosRole: vosRole } as Partial<User>).where(eq(users.id, userId));
}

export async function updateUserMaturityLevel(userId: string, level: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set({ maturityLevel: level } as Partial<User>).where(eq(users.id, userId));
}

// ============================================================================
// Pillars
// ============================================================================

export async function getAllPillars() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(pillars).orderBy(pillars.pillarNumber);
}

export async function getPillarById(pillarId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(pillars).where(eq(pillars.id, pillarId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPillarByNumber(pillarNumber: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(pillars).where(eq(pillars.pillarNumber, pillarNumber)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createPillar(pillar: InsertPillar) {
  const db = await getDb();
  if (!db) return;

  await db.insert(pillars).values(pillar);
}

// ============================================================================
// Progress Tracking
// ============================================================================

export async function getUserProgress(userId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(progress).where(eq(progress.userId, userId));
}

export async function getUserPillarProgress(userId: string, pillarId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.pillarId, pillarId)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertProgress(progressData: Partial<Progress> & { userId: string; pillarId: number; status: string }) {
  const db = await getDb();
  if (!db) return;

  const existing = await getUserPillarProgress(progressData.userId, progressData.pillarId);

  if (existing) {
    await db
      .update(progress)
      .set({
        status: progressData.status,
        completionPercentage: progressData.completionPercentage,
        lastAccessed: new Date(),
        completedAt: progressData.completedAt,
      } as Partial<Progress>)
      .where(eq(progress.id, existing.id));
  } else {
    await db.insert(progress).values(progressData as InsertProgress);
  }
}

// ============================================================================
// Quiz Questions
// ============================================================================

export async function getQuizQuestionsByPillar(pillarId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.pillarId, pillarId))
    .orderBy(quizQuestions.questionNumber);
}

export async function createQuizQuestion(question: InsertQuizQuestion) {
  const db = await getDb();
  if (!db) return;

  await db.insert(quizQuestions).values(question);
}

export async function createQuizQuestions(questions: InsertQuizQuestion[]) {
  const db = await getDb();
  if (!db) return;

  await db.insert(quizQuestions).values(questions);
}

// ============================================================================
// Quiz Results
// ============================================================================

export async function getUserQuizResults(userId: string, pillarId?: number) {
  const db = await getDb();
  if (!db) return [];

  const conditions = pillarId
    ? and(eq(quizResults.userId, userId), eq(quizResults.pillarId, pillarId))
    : eq(quizResults.userId, userId);

  return await db.select().from(quizResults).where(conditions).orderBy(desc(quizResults.completedAt));
}

export async function getLatestQuizResult(userId: string, pillarId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const results = await db
    .select()
    .from(quizResults)
    .where(and(eq(quizResults.userId, userId), eq(quizResults.pillarId, pillarId)))
    .orderBy(desc(quizResults.completedAt))
    .limit(1);

  return results.length > 0 ? results[0] : undefined;
}

export async function createQuizResult(result: Partial<QuizResult> & { userId: string; pillarId: number; score: number }) {
  const db = await getDb();
  if (!db) return;

  await db.insert(quizResults).values(result as InsertQuizResult);
}

// ============================================================================
// Certifications
// ============================================================================

export async function getUserCertifications(userId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(certifications).where(eq(certifications.userId, userId)).orderBy(desc(certifications.awardedAt));
}

export async function createCertification(cert: Partial<Certification> & { userId: string; badgeName: string; pillarId: number; vosRole: string }) {
  const db = await getDb();
  if (!db) return;

  await db.insert(certifications).values(cert as InsertCertification);
}

export async function hasCertification(userId: string, pillarId: number, vosRole: string) {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(certifications)
    .where(
      and(
        eq(certifications.userId, userId),
        eq(certifications.pillarId, pillarId),
        eq(certifications.vosRole, vosRole)
      )
    )
    .limit(1);

  return result.length > 0;
}

// ============================================================================
// Maturity Assessments
// ============================================================================

export async function getUserMaturityAssessments(userId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(maturityAssessments)
    .where(eq(maturityAssessments.userId, userId))
    .orderBy(desc(maturityAssessments.assessedAt));
}

export async function getLatestMaturityAssessment(userId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const results = await db
    .select()
    .from(maturityAssessments)
    .where(eq(maturityAssessments.userId, userId))
    .orderBy(desc(maturityAssessments.assessedAt))
    .limit(1);

  return results.length > 0 ? results[0] : undefined;
}

export async function createMaturityAssessment(assessment: Partial<MaturityAssessment> & { userId: string; level: number }) {
  const db = await getDb();
  if (!db) return;

  await db.insert(maturityAssessments).values(assessment as InsertMaturityAssessment);
}

// ============================================================================
// Resources
// ============================================================================

export async function getAllResources() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(resources);
}

export async function getResourcesByPillar(pillarId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(resources).where(eq(resources.pillarId, pillarId));
}

export async function getResourcesByRole(vosRole: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(resources).where(eq(resources.vosRole, vosRole));
}

export async function createResource(resource: InsertResource) {
  const db = await getDb();
  if (!db) return;

  await db.insert(resources).values(resource);
}

// ============================================================================
// Simulation Management
// ============================================================================

export async function createSimulationScenario(scenario: Partial<SimulationScenario> & { title: string; description: string; type: string }): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create simulation scenario: database not available");
    return;
  }

  await db.insert(simulationScenarios).values(scenario as InsertSimulationScenario);
}

export async function getAllSimulationScenarios(): Promise<SimulationScenario[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get simulation scenarios: database not available");
    return [];
  }

  return await db.select().from(simulationScenarios);
}

export async function getSimulationScenarioById(id: number): Promise<SimulationScenario | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get simulation scenario: database not available");
    return undefined;
  }

  const results = await db
    .select()
    .from(simulationScenarios)
    .where(eq(simulationScenarios.id, id))
    .limit(1);

  return results[0];
}

export async function createSimulationAttempt(attempt: Partial<SimulationAttempt> & { userId: string; scenarioId: number; overallScore: number }): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create simulation attempt: database not available");
    return;
  }

  await db.insert(simulationAttempts).values(attempt as InsertSimulationAttempt);
}

export async function getUserSimulationAttempts(
  userId: string,
  scenarioId?: number
): Promise<SimulationAttempt[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get simulation attempts: database not available");
    return [];
  }

  if (scenarioId) {
    return await db
      .select()
      .from(simulationAttempts)
      .where(
        and(
          eq(simulationAttempts.userId, userId),
          eq(simulationAttempts.scenarioId, scenarioId)
        )
      )
      .orderBy(desc(simulationAttempts.completedAt));
  }

  return await db
    .select()
    .from(simulationAttempts)
    .where(eq(simulationAttempts.userId, userId))
    .orderBy(desc(simulationAttempts.completedAt));
}

export async function getSimulationAttemptCount(
  userId: string,
  scenarioId: number
): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot count simulation attempts: database not available");
    return 0;
  }

  const results = await db
    .select()
    .from(simulationAttempts)
    .where(
      and(
        eq(simulationAttempts.userId, userId),
        eq(simulationAttempts.scenarioId, scenarioId)
      )
    );

  return results.length;
}
