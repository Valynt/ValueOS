import { z } from "zod";

import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * Generate personalized quiz feedback based on score and maturity level
 */
function generateQuizFeedback(
  score: number,
  maturityLevel: number,
  categoryScores?: Record<string, number>
) {
  const feedback: {
    overall: string;
    strengths: string[];
    improvements: string[];
    nextSteps: string[];
  } = {
    overall: "",
    strengths: [],
    improvements: [],
    nextSteps: [],
  };

  // Overall feedback based on score
  if (score >= 90) {
    feedback.overall = "Excellent work! You've demonstrated strong mastery of this pillar's concepts.";
  } else if (score >= 80) {
    feedback.overall = "Good job! You've passed and shown solid understanding of the core concepts.";
  } else if (score >= 70) {
    feedback.overall = "You're close! Review the feedback below and retake the quiz to achieve certification.";
  } else {
    feedback.overall = "Keep learning! Focus on the improvement areas below and revisit the pillar content.";
  }

  // Maturity-based guidance
  if (maturityLevel <= 1) {
    feedback.nextSteps.push("Focus on building foundational knowledge through the pillar content");
    feedback.nextSteps.push("Review the KPI Definition Sheet and practice mapping pain to value");
  } else if (maturityLevel === 2) {
    feedback.nextSteps.push("Apply these concepts in cross-functional scenarios");
    feedback.nextSteps.push("Practice structured value realization tracking");
  } else {
    feedback.nextSteps.push("Integrate these concepts into automated workflows");
    feedback.nextSteps.push("Mentor others on value language and frameworks");
  }

  // Category-specific feedback
  if (categoryScores) {
    const categories = Object.entries(categoryScores);
    const strongCategories = categories.filter(([_, score]) => score >= 80);
    const weakCategories = categories.filter(([_, score]) => score < 70);

    strongCategories.forEach(([category]) => {
      feedback.strengths.push(`Strong performance in ${category}`);
    });

    weakCategories.forEach(([category]) => {
      feedback.improvements.push(`Review ${category} concepts and examples`);
    });
  }

  return feedback;
}

/**
 * Quiz management router
 * Handles quiz questions, submissions, and results
 */
export const quizRouter = router({
  /**
   * Get quiz questions for a pillar
   */
  getQuestions: protectedProcedure
    .input(z.object({ pillarId: z.number() }))
    .query(async ({ input }) => {
      return await db.getQuizQuestionsByPillar(input.pillarId);
    }),
  
  /**
   * Submit quiz answers and calculate results
   * Awards certification if passed (80%+) using 40/30/30 rubric
   */
  submitQuiz: protectedProcedure
    .input(z.object({
      pillarId: z.number(),
      answers: z.array(z.object({
        questionId: z.number(),
        selectedAnswer: z.string(),
        isCorrect: z.boolean(),
        pointsEarned: z.number(),
      })),
      score: z.number(),
      categoryScores: z.record(z.string(), z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const passed = input.score >= 80;
      
      // Get attempt number
      const previousResults = await db.getUserQuizResults(ctx.user.id, input.pillarId);
      const attemptNumber = previousResults.length + 1;
      
      // Generate feedback based on score and maturity level
      const maturityLevel = ctx.user.maturityLevel ?? 0;
      const feedback = generateQuizFeedback(input.score, maturityLevel, input.categoryScores);
      
      // Save quiz result
      await db.createQuizResult({
        userId: ctx.user.id,
        pillarId: input.pillarId,
        score: input.score,
        categoryScores: input.categoryScores,
        answers: input.answers,
        feedback: JSON.stringify(feedback),
        passed: passed,
        attemptNumber,
        completedAt: new Date(),
      });
      
      // If passed, award certification using 40/30/30 rubric
      if (passed && ctx.user.vosRole) {
        const pillar = await db.getPillarById(input.pillarId);

        // Get user's simulation performance for this pillar (if applicable)
        const simulationAttempts = await db.getUserSimulationAttempts(ctx.user.id);
        const pillarSimulations = simulationAttempts.filter(() => {
          // TODO: Filter simulations related to this pillar
          return true;
        });

        // Calculate simulation average (30% of certification score)
        const simulationAvg = pillarSimulations.length > 0
          ? pillarSimulations.reduce((sum, attempt) => sum + attempt.overallScore, 0) / pillarSimulations.length
          : 0;

        // Calculate role task performance (30% of certification score)
        // Based on attempt number and category scores
        const roleTaskScore = Math.min(100, input.score * 0.5 + (input.categoryScores?.technical || 0) * 0.3 + (input.categoryScores?.crossFunctional || 0) * 0.2);

        // Calculate final certification score using 40/30/30 rubric
        const quizWeight = 0.4;
        const simulationWeight = 0.3;
        const roleTaskWeight = 0.3;

        const finalCertificationScore = Math.round(
          (input.score * quizWeight) +
          (simulationAvg * simulationWeight) +
          (roleTaskScore * roleTaskWeight)
        );

        const badgeName = `${pillar?.title} - ${ctx.user.vosRole} Certified`;

        const alreadyCertified = await db.hasCertification(
          ctx.user.id,
          input.pillarId,
          ctx.user.vosRole
        );

        if (!alreadyCertified) {
          await db.createCertification({
            userId: ctx.user.id,
            badgeName,
            pillarId: input.pillarId,
            vosRole: ctx.user.vosRole,
            tier: finalCertificationScore >= 95 ? "gold" :
                  finalCertificationScore >= 80 ? "silver" : "bronze",
            score: finalCertificationScore,
            awardedAt: new Date(),
          });
        }

        // Update progress to completed
        await db.upsertProgress({
          userId: ctx.user.id,
          pillarId: input.pillarId,
          status: "completed",
          completionPercentage: 100,
          lastAccessed: new Date(),
          completedAt: new Date(),
        } as any);
      }
      
      return {
        success: true,
        passed,
        feedback,
        attemptNumber,
      };
    }),
  
  /**
   * Get quiz results for user
   * Optionally filter by pillar
   */
  getResults: protectedProcedure
    .input(z.object({ pillarId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return await db.getUserQuizResults(ctx.user.id, input.pillarId);
    }),
});
