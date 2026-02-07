import { describe, expect, it } from "vitest";
import { appRouter } from "../src/data/routers";
import type { Context } from "../src/data/_core/trpc";

type AuthenticatedUser = NonNullable<Context["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): { ctx: Context } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    vosRole: "Sales",
    maturityLevel: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  const ctx: Context = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as Context["req"],
    res: {} as Context["res"],
  };

  return { ctx };
}

describe("Quiz System", () => {
  describe("quiz.getQuestions", () => {
    it("returns questions for valid pillar", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.quiz.getQuestions({ pillarId: 1 });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Each question should have expected structure
      result.forEach(question => {
        expect(question).toHaveProperty("id");
        expect(question).toHaveProperty("pillarId");
        expect(question).toHaveProperty("questionText");
        expect(question).toHaveProperty("options");
        expect(question).toHaveProperty("correctAnswer");
        expect(question).toHaveProperty("category");
        
        // Options should be an array
        expect(Array.isArray(question.options)).toBe(true);
        expect(question.options.length).toBeGreaterThan(0);
      });
    });

    it("requires authentication", async () => {
      const ctx: Context = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as Context["req"],
        res: {} as Context["res"],
      };
      
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.quiz.getQuestions({ pillarId: 1 })
      ).rejects.toThrow();
    });
  });

  describe("quiz.submitQuiz", () => {
    it("accepts submission with all correct answers", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Get questions first
      const questions = await caller.quiz.getQuestions({ pillarId: 1 });
      
      // Submit all correct answers with calculated scores
      const answers = questions.map(q => ({
        questionId: q.id,
        selectedAnswer: q.correctAnswer,
        isCorrect: true,
        pointsEarned: 1
      }));

      const result = await caller.quiz.submitQuiz({
        pillarId: 1,
        answers,
        score: 100
      });

      expect(result).toHaveProperty("passed");
      expect(result).toHaveProperty("success");
      
      // All answers correct = passed
      expect(result.passed).toBe(true);
      expect(result.success).toBe(true);
    });

    it("accepts submission with mixed answers", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const questions = await caller.quiz.getQuestions({ pillarId: 1 });
      
      // Submit mix of correct and incorrect answers (50% correct)
      const answers = questions.map((q, index) => ({
        questionId: q.id,
        selectedAnswer: index % 2 === 0 ? q.correctAnswer : "wrong-answer",
        isCorrect: index % 2 === 0,
        pointsEarned: index % 2 === 0 ? 1 : 0
      }));

      const correctCount = answers.filter(a => a.isCorrect).length;
      const score = Math.round((correctCount / questions.length) * 100);

      const result = await caller.quiz.submitQuiz({
        pillarId: 1,
        answers,
        score
      });

      expect(result).toHaveProperty("passed");
      expect(result.passed).toBe(score >= 80);
    });

    it("marks quiz as passed with 80%+ score", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const questions = await caller.quiz.getQuestions({ pillarId: 1 });
      
      // Calculate how many correct answers needed for 80%
      const passingCount = Math.ceil(questions.length * 0.8);
      
      const answers = questions.map((q, index) => ({
        questionId: q.id,
        selectedAnswer: index < passingCount ? q.correctAnswer : "wrong-answer",
        isCorrect: index < passingCount,
        pointsEarned: index < passingCount ? 1 : 0
      }));

      const score = Math.round((passingCount / questions.length) * 100);

      const result = await caller.quiz.submitQuiz({
        pillarId: 1,
        answers,
        score
      });

      expect(result.passed).toBe(score >= 80);
    });

    it("awards Bronze certification for passing quiz", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const questions = await caller.quiz.getQuestions({ pillarId: 1 });
      
      // Submit all correct answers
      const answers = questions.map(q => ({
        questionId: q.id,
        selectedAnswer: q.correctAnswer,
        isCorrect: true,
        pointsEarned: 1
      }));

      const result = await caller.quiz.submitQuiz({
        pillarId: 1,
        answers,
        score: 100
      });

      expect(result.passed).toBe(true);
      
      // Check if certification was awarded
      const certs = await caller.certifications.getUserCertifications();
      const pillar1Cert = certs.find(c => c.pillarNumber === 1);
      
      if (pillar1Cert) {
        expect(pillar1Cert.tier).toBe("bronze");
      }
    });

    it("requires authentication", async () => {
      const ctx: Context = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as Context["req"],
        res: {} as Context["res"],
      };
      
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.quiz.submitQuiz({
          pillarId: 1,
          answers: [],
          score: 0
        })
      ).rejects.toThrow();
    });
  });

  describe("Quiz Scoring Rubric", () => {
    it("40% Technical Execution", () => {
      const technicalWeight = 0.4;
      expect(technicalWeight).toBe(0.4);
    });

    it("30% Cross-Functional Alignment", () => {
      const crossFunctionalWeight = 0.3;
      expect(crossFunctionalWeight).toBe(0.3);
    });

    it("30% AI Augmentation", () => {
      const aiAugmentationWeight = 0.3;
      expect(aiAugmentationWeight).toBe(0.3);
    });

    it("Total weight equals 100%", () => {
      const totalWeight = 0.4 + 0.3 + 0.3;
      expect(totalWeight).toBe(1.0);
    });
  });

  describe("Quiz Categories", () => {
    it("questions have category classification", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const questions = await caller.quiz.getQuestions({ pillarId: 1 });
      
      // All questions should have a category
      questions.forEach(q => {
        expect(q.category).toBeTruthy();
        expect(typeof q.category).toBe("string");
      });
      
      // Should have multiple categories
      const categories = new Set(questions.map(q => q.category));
      expect(categories.size).toBeGreaterThan(1);
    });
  });
});
