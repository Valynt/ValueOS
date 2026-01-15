/**
 * Main router index
 * Combines all domain-specific routers into the application router
 */
import { router } from "../_core/trpc";
import { systemRouter } from "../_core/systemRouter";
import { authRouter } from "./auth.router";
import { userRouter } from "./user.router";
import { pillarsRouter } from "./pillars.router";
import { progressRouter } from "./progress.router";
import { quizRouter } from "./quiz.router";
import { certificationsRouter } from "./certifications.router";
import { maturityRouter } from "./maturity.router";
import { resourcesRouter } from "./resources.router";
import { aiRouter } from "./ai.router";
import { simulationsRouter } from "./simulations.router";
import { analyticsRouter } from "./analytics.router";

/**
 * Application router
 * Exports the complete tRPC API surface
 */
export const appRouter = router({
  // System health and version
  system: systemRouter,
  
  // Authentication and user management
  auth: authRouter,
  user: userRouter,
  
  // Learning content
  pillars: pillarsRouter,
  progress: progressRouter,
  resources: resourcesRouter,
  
  // Assessments
  quiz: quizRouter,
  simulations: simulationsRouter,
  maturity: maturityRouter,
  
  // Achievements
  certifications: certificationsRouter,
  
  // AI features
  ai: aiRouter,
  
  // Analytics and reporting
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
