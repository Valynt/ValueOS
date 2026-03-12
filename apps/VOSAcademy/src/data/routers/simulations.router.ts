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
   * Get personalized recommendations based on user performance.
   * Uses a deterministic data pipeline by default.
   * Optional AI enrichment can be enabled via SIMULATION_AI_RECOMMENDATIONS_ENABLED=true.
   */
  getRecommendations: protectedProcedure
    .query(async ({ ctx }) => {
      const attempts = await db.getUserSimulationAttempts(ctx.user.id);
      const scenarios = await db.getAllSimulationScenarios();
      const aiRecommendationsEnabled = process.env.SIMULATION_AI_RECOMMENDATIONS_ENABLED === 'true';

      const attemptsByScenario = new Map<number, typeof attempts>();
      for (const attempt of attempts) {
        const grouped = attemptsByScenario.get(attempt.scenarioId) ?? [];
        grouped.push(attempt);
        attemptsByScenario.set(attempt.scenarioId, grouped);
      }

      const totalAttempts = attempts.length;
      const avgScore = totalAttempts > 0
        ? Math.round(attempts.reduce((sum, a) => sum + a.overallScore, 0) / totalAttempts)
        : 0;

      const recommendations: Array<{
        type: 'start' | 'review' | 'practice' | 'challenge' | 'mentor';
        title: string;
        description: string;
        scenarioId?: number;
        confidence: number;
        source: 'rules' | 'ai';
      }> = [];

      const unattemptedScenario = scenarios.find((scenario) => !attemptsByScenario.has(scenario.id));
      if (totalAttempts === 0 && unattemptedScenario) {
        recommendations.push({
          type: 'start',
          title: 'Start Your First Simulation',
          description: `Begin with ${unattemptedScenario.title} to establish a baseline score.`,
          scenarioId: unattemptedScenario.id,
          confidence: 0.92,
          source: 'rules',
        });
      }

      const lowPerformingScenario = scenarios
        .map((scenario) => {
          const scenarioAttempts = attemptsByScenario.get(scenario.id) ?? [];
          if (scenarioAttempts.length === 0) return null;
          const scenarioAvg = scenarioAttempts.reduce((sum, a) => sum + a.overallScore, 0) / scenarioAttempts.length;
          return { scenario, scenarioAvg };
        })
        .filter((entry): entry is { scenario: (typeof scenarios)[number]; scenarioAvg: number } => entry !== null)
        .sort((a, b) => a.scenarioAvg - b.scenarioAvg)[0];

      if (lowPerformingScenario && lowPerformingScenario.scenarioAvg < 80) {
        recommendations.push({
          type: 'review',
          title: 'Target your lowest-scoring scenario',
          description: `${lowPerformingScenario.scenario.title} is averaging ${Math.round(lowPerformingScenario.scenarioAvg)}%. Re-run this scenario and focus on rubric gaps.`,
          scenarioId: lowPerformingScenario.scenario.id,
          confidence: 0.88,
          source: 'rules',
        });
      }

      if (avgScore >= 70 && avgScore < 90) {
        const nextPractice = unattemptedScenario ?? scenarios.find((s) => s.type !== lowPerformingScenario?.scenario.type);
        if (nextPractice) {
          recommendations.push({
            type: 'practice',
            title: 'Expand scenario coverage',
            description: `Practice ${nextPractice.title} to improve cross-category fluency.`,
            scenarioId: nextPractice.id,
            confidence: 0.84,
            source: 'rules',
          });
        }
      }

      if (avgScore >= 90) {
        recommendations.push({
          type: 'challenge',
          title: 'Maintain expert-level performance',
          description: 'Take a new advanced scenario this week and keep all category scores above 85%.',
          confidence: 0.8,
          source: 'rules',
        });
        recommendations.push({
          type: 'mentor',
          title: 'Mentor peers',
          description: 'Share your approach and coach lower-scoring learners to reinforce mastery.',
          confidence: 0.75,
          source: 'rules',
        });
      }

      if (recommendations.length === 0) {
        recommendations.push({
          type: 'start',
          title: 'Build momentum with regular practice',
          description: 'Complete at least one simulation this week to generate personalized insights.',
          scenarioId: scenarios[0]?.id,
          confidence: 0.7,
          source: 'rules',
        });
      }

      if (!aiRecommendationsEnabled) {
        return recommendations;
      }

      try {
        const aiResponse = await safeLLMOperation(
          () => invokeLLM({
            messages: [
              {
                role: 'system',
                content: 'You generate short, practical simulation coaching recommendations in valid JSON only.',
              },
              {
                role: 'user',
                content: JSON.stringify({
                  avgScore,
                  totalAttempts,
                  recommendations,
                }),
              },
            ],
          }),
          { maxRetries: 1, timeout: 15000 }
        );

        const content = aiResponse?.choices?.[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          return recommendations;
        }

        const parsed = JSON.parse(content) as Array<{ title: string; description: string }>;
        const aiEnhanced = parsed
          .filter((item) => typeof item.title === 'string' && typeof item.description === 'string')
          .slice(0, 3)
          .map((item) => ({
            type: 'practice' as const,
            title: item.title,
            description: item.description,
            confidence: 0.65,
            source: 'ai' as const,
          }));

        return aiEnhanced.length > 0 ? [...recommendations, ...aiEnhanced] : recommendations;
      } catch {
        return recommendations;
      }
    }),
});
