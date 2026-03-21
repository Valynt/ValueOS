import { authRouter } from "./routers/auth.router.js";
import { router } from "./trpc.js";

export const appRouter = router({
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
