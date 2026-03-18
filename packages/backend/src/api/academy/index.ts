/**
 * Academy Router Index
 * Combines all academy domain routers
 */
import { analyticsRouter } from "./routers/analytics.router.js";
import { certificationsRouter } from "./routers/certifications.router.js";
import { maturityRouter } from "./routers/maturity.router.js";
import { pillarsRouter } from "./routers/pillars.router.js";
import { progressRouter } from "./routers/progress.router.js";
import { quizRouter } from "./routers/quiz.router.js";
import { resourcesRouter } from "./routers/resources.router.js";
import { simulationsRouter } from "./routers/simulations.router.js";
import { userRouter } from "./routers/user.router.js";
import { router } from "./trpc.js";

export const academyRouter = router({
  pillars: pillarsRouter,
  quiz: quizRouter,
  certifications: certificationsRouter,
  simulations: simulationsRouter,
  progress: progressRouter,
  resources: resourcesRouter,
  maturity: maturityRouter,
  user: userRouter,
  analytics: analyticsRouter,
});

export type AcademyRouter = typeof academyRouter;
