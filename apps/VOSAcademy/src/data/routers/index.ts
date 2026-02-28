/**
 * Main router index
 * Combines all domain-specific routers into the application router
 */
import { systemRouter } from "../_core/systemRouter";
import { router } from "../_core/trpc";

import { aiRouter } from "./ai.router";
import { analyticsRouter } from "./analytics.router";
import { authRouter } from "./auth.router";
import { certificationsRouter } from "./certifications.router";
import { maturityRouter } from "./maturity.router";
import { pillarsRouter } from "./pillars.router";
import { progressRouter } from "./progress.router";
import { quizRouter } from "./quiz.router";
import { resourcesRouter } from "./resources.router";
import { simulationsRouter } from "./simulations.router";
import { userRouter } from "./user.router";

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
