import { router } from "./trpc";
export var systemRouter = router({
    health: publicProcedure.query(function () {
        return { status: "ok", timestamp: new Date().toISOString() };
    }),
    version: publicProcedure.query(function () {
        return { version: "1.0.0", name: "VOS Academy" };
    }),
});
