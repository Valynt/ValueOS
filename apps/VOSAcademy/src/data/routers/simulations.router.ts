import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  calculateScoringResult,
  generateFeedbackPrompt,
  type SimulationResponse,
  validateScoringResult,
} from "../../lib/simulation-scoring";
import { safeDbOperation, safeLLMOperation } from "../_core/error-handling";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * Simulations router
 * Handles simulation scenarios, attempts, evaluation, and analytics
 */
export const simulationsRouter = router({
  /**
   * Get all simulation scenarios
   */
  list: publicProcedure.query(async () => {
    return await db.getAllSimulationScenarios();
  }),

  /**
   * Get simulation scenario by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getSimulationScenarioById(input.id);
    }),

  /**
   * Get user's simulation attempts
   * Optionally filter by scenario
   */
  getAttempts: protectedProcedure
    .input(z.object({ scenarioId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return await db.getUserSimulationAttempts(ctx.user.id, input.scenarioId);
    }),

  /**
   * Get simulation analytics for current user
   * Includes overview stats, category averages, and score trends
   */
  getAnalytics: protectedProcedure
    .query(async ({ ctx }) => {
      const attempts = await db.getUserSimulationAttempts(ctx.user.id);
      const scenarios = await db.getAllSimulationScenarios();
      
      // Calculate overall statistics
      const totalAttempts = attempts.length;
      const avgScore = totalAttempts > 0 
        ? Math.round(attempts.reduce((sum, a) => sum + a.overallScore, 0) / totalAttempts)
        : 0;
      const bestScore = totalAttempts > 0
        ? Math.max(...attempts.map(a => a.overallScore))
        : 0;
      const passedAttempts = attempts.filter(a => a.passed).length;
      const completionRate = totalAttempts > 0
        ? Math.round((passedAttempts / totalAttempts) * 100)
        : 0;

      // Calculate category averages
      const categoryAverages = totalAttempts > 0 ? {
        technical: Math.round(attempts.reduce((sum, a) => sum + (a.categoryScores?.technical || 0), 0) / totalAttempts),
        crossFunctional: Math.round(attempts.reduce((sum, a) => sum + (a.categoryScores?.crossFunctional || 0), 0) / totalAttempts),
        aiAugmentation: Math.round(attempts.reduce((sum, a) => sum + (a.categoryScores?.aiAugmentation || 0), 0) / totalAttempts),
      } : {
        technical: 0,
        crossFunctional: 0,
        aiAugmentation: 0,
      };

      // Group attempts by scenario for detailed stats
      const scenarioStats = scenarios.map(scenario => {
        const scenarioAttempts = attempts.filter(a => a.scenarioId === scenario.id);
        const scenarioAvg = scenarioAttempts.length > 0
          ? Math.round(scenarioAttempts.reduce((sum, a) => sum + a.overallScore, 0) / scenarioAttempts.length)
          : 0;
        const scenarioBest = scenarioAttempts.length > 0
          ? Math.max(...scenarioAttempts.map(a => a.overallScore))
          : 0;
        
        return {
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          scenarioType: scenario.type,
          attemptCount: scenarioAttempts.length,
          avgScore: scenarioAvg,
          bestScore: scenarioBest,
          lastAttempt: scenarioAttempts.length > 0 
            ? scenarioAttempts[scenarioAttempts.length - 1].completedAt
            : null,
        };
      }).filter(s => s.attemptCount > 0);

      // Prepare score trend data (last 10 attempts)
      const scoreTrend = attempts
        .slice(-10)
        .map(a => ({
          attemptId: a.id,
          scenarioTitle: scenarios.find(s => s.id === a.scenarioId)?.title || 'Unknown',
          score: a.overallScore,
          completedAt: a.completedAt,
          passed: a.passed,
        }));

      return {
        overview: {
          totalAttempts,
          avgScore,
          bestScore,
          completionRate,
        },
        categoryAverages,
        scenarioStats,
        scoreTrend,
        recentAttempts: attempts.slice(-5).reverse().map(a => ({
          id: a.id,
          scenarioTitle: scenarios.find(s => s.id === a.scenarioId)?.title || 'Unknown',
          scenarioType: scenarios.find(s => s.id === a.scenarioId)?.type || 'unknown',
          attemptNumber: a.attemptNumber,
          overallScore: a.overallScore,
          categoryScores: a.categoryScores,
          passed: a.passed,
          timeSpent: a.timeSpent,
          completedAt: a.completedAt,
        })),
      };
    }),

  /**
   * Evaluate a single simulation response
   * Uses AI to provide feedback and scoring
   */
  evaluateResponse: protectedProcedure
    .input(z.object({
      scenarioId: z.number(),
      stepNumber: z.number(),
      userResponse: z.string(),
    }))
    .mutation(async ({ input }) => {
      const scenario = await db.getSimulationScenarioById(input.scenarioId);
      
      if (!scenario) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Scenario not found',
        });
      }

      // Check simulation type and use appropriate evaluation prompts
      if (scenario.type === 'business_case') {
        const { getBusinessCaseEvaluationPrompt, getSystemPrompt } = await import('../../lib/business-case-evaluation');
        
        const evaluationPrompt = getBusinessCaseEvaluationPrompt(input.stepNumber, input.userResponse);
        const systemPrompt = getSystemPrompt();

        const aiResponse = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: evaluationPrompt }
          ]
        });

        const messageContent = aiResponse.choices[0]?.message?.content;
        
        if (!messageContent || typeof messageContent !== 'string') {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to get AI evaluation',
          });
        }

        // Parse JSON response
        try {
          // Extract JSON from markdown code blocks if present
          const jsonMatch = messageContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                           messageContent.match(/```\s*([\s\S]*?)\s*```/) ||
                           [null, messageContent];
          const jsonStr = jsonMatch[1] || messageContent;
          const evaluation = JSON.parse(jsonStr.trim());
          
          return {
            score: evaluation.score,
            categoryBreakdown: evaluation.categoryBreakdown,
            strengths: evaluation.strengths,
            improvements: evaluation.improvements,
            feedback: evaluation.feedback,
          };
        } catch (error) {
          console.error('Failed to parse AI evaluation:', messageContent);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to parse AI evaluation response',
          });
        }
      } else if (scenario.type === 'qbr_expansion') {
        const { getQBRExpansionEvaluationPrompt, getSystemPrompt } = await import('../../lib/qbr-expansion-evaluation');
        
        const evaluationPrompt = getQBRExpansionEvaluationPrompt(input.stepNumber, input.userResponse);
        const systemPrompt = getSystemPrompt();

        const aiResponse = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: evaluationPrompt }
          ]
        });

        const messageContent = aiResponse.choices[0]?.message?.content;
        
        if (!messageContent || typeof messageContent !== 'string') {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to get AI evaluation',
          });
        }

        // Parse JSON response
        try {
          const jsonMatch = messageContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                           messageContent.match(/```\s*([\s\S]*?)\s*```/) ||
                           [null, messageContent];
          const jsonStr = jsonMatch[1] || messageContent;
          const evaluation = JSON.parse(jsonStr.trim());
          
          return {
            score: evaluation.score,
            categoryBreakdown: evaluation.categoryBreakdown,
            strengths: evaluation.strengths,
            improvements: evaluation.improvements,
            feedback: evaluation.feedback,
          };
        } catch (error) {
          console.error('Failed to parse AI evaluation:', messageContent);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to parse AI evaluation response',
          });
        }
      }

      // For other simulation types, use generic evaluation
      const aiResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a VOS training expert. Evaluate this simulation response." },
          { role: "user", content: `Evaluate this response: ${input.userResponse}` }
        ]
      });

      const messageContent = aiResponse.choices[0]?.message?.content || "Good effort!";
      
      return {
        score: 75,
        categoryBreakdown: { technical: 30, crossFunctional: 23, aiAugmentation: 22 },
        strengths: ["Shows understanding of concepts"],
        improvements: ["Could provide more detail"],
        feedback: typeof messageContent === 'string' ? messageContent : "Good effort!",
      };
    }),

  /**
   * Submit completed simulation attempt
   * Calculates scores, awards certifications if applicable
   */
  submitAttempt: protectedProcedure
    .input(z.object({
      scenarioId: z.number(),
      responsesData: z.array(z.object({
        stepNumber: z.number(),
        userResponse: z.string(),
        aiFeedback: z.string(),
        score: z.number(),
        strengths: z.array(z.string()),
        improvements: z.array(z.string()),
      })),
      timeSpent: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Calculate scores using dedicated scoring module
      const scoringResult = calculateScoringResult(input.responsesData as SimulationResponse[]);
      
      // Validate scoring result
      const validation = validateScoringResult(scoringResult);
      if (!validation.valid) {
        console.error('[Simulation] Invalid scoring result:', validation.errors);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Scoring calculation error',
        });
      }

      const { overallScore, categoryScores, passed, tier } = scoringResult;

      // Get attempt number
      const attemptCount = await safeDbOperation(
        () => db.getSimulationAttemptCount(ctx.user.id, input.scenarioId),
        "Failed to get attempt count"
      );
      const attemptNumber = attemptCount + 1;

      // Generate overall feedback using AI
      const feedbackPrompt = generateFeedbackPrompt(overallScore, categoryScores, passed);

      const aiResponse = await safeLLMOperation(
        () => invokeLLM({
          messages: [
            { role: "system", content: "You are a VOS training expert." },
            { role: "user", content: feedbackPrompt }
          ]
        }),
        {
          maxRetries: 2,
          timeout: 30000,
          fallback: {
            choices: [{
              message: {
                content: passed 
                  ? "Great work! You've demonstrated solid understanding of VOS principles."
                  : "Good effort! Review the feedback and try again to improve your score."
              }
            }]
          }
        }
      );

      const messageContent = aiResponse.choices[0]?.message?.content;
      const overallFeedback = typeof messageContent === 'string' ? messageContent : "Great effort!";

      // Save attempt
      await db.createSimulationAttempt({
        userId: ctx.user.id,
        scenarioId: input.scenarioId,
        attemptNumber,
        responsesData: input.responsesData,
        overallScore,
        categoryScores,
        passed: passed,
        timeSpent: input.timeSpent,
        feedback: overallFeedback,
        completedAt: new Date(),
      });

      // Award certification if passed with high score
      if (passed && tier && (tier === 'gold' || tier === 'silver') && ctx.user.vosRole) {
        const scenario = await db.getSimulationScenarioById(input.scenarioId);
        if (scenario && scenario.pillarId) {
          const alreadyCertified = await db.hasCertification(
            ctx.user.id,
            scenario.pillarId,
            ctx.user.vosRole
          );

          if (!alreadyCertified) {
            const badgeTier = tier.charAt(0).toUpperCase() + tier.slice(1);
            await db.createCertification({
              userId: ctx.user.id,
              badgeName: `${scenario.title} - ${badgeTier}`,
              pillarId: scenario.pillarId,
              vosRole: ctx.user.vosRole,
              tier: tier,
              score: overallScore,
              awardedAt: new Date(),
            });
          }
        }
      }

      return {
        success: true,
        passed,
        overallScore,
        categoryScores,
        feedback: overallFeedback,
        attemptNumber,
      };
    }),

  /**
   * Get personalized recommendations based on user performance
   * TODO: Implement AI-powered recommendations
   */
  getRecommendations: protectedProcedure
    .query(async ({ ctx }) => {
      const attempts = await db.getUserSimulationAttempts(ctx.user.id);
      const scenarios = await db.getAllSimulationScenarios();

      // Calculate analytics for recommendations
      const totalAttempts = attempts.length;
      const avgScore = totalAttempts > 0 
        ? Math.round(attempts.reduce((sum, a) => sum + a.overallScore, 0) / totalAttempts)
        : 0;

      // Basic recommendations based on performance
      const recommendations = [];

      if (totalAttempts === 0) {
        recommendations.push({
          type: 'start',
          title: 'Start Your First Simulation',
          description: 'Begin with a business case simulation to practice value engineering',
          scenarioId: scenarios.find(s => s.type === 'business_case')?.id,
        });
      } else if (avgScore < 70) {
        recommendations.push({
          type: 'review',
          title: 'Review Core Concepts',
          description: 'Revisit pillar content to strengthen foundational knowledge',
        });
      } else if (avgScore < 85) {
        recommendations.push({
          type: 'practice',
          title: 'Practice Advanced Scenarios',
          description: 'Try more challenging simulations to improve your skills',
        });
      } else {
        recommendations.push({
          type: 'mentor',
          title: 'Share Your Expertise',
          description: 'Help others by mentoring or creating content',
        });
      }

      return recommendations;
    }),
});
