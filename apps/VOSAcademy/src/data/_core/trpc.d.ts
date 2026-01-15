import { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";
export declare const createContext: (opts: CreateHTTPContextOptions) => {
    req: import("http").IncomingMessage;
    res: import("http").ServerResponse<import("http").IncomingMessage>;
    user: null;
};
export type Context = Awaited<ReturnType<typeof createContext>>;
export declare const router: import("@trpc/server").TRPCRouterBuilder<{
    ctx: {
        req: import("http").IncomingMessage;
        res: import("http").ServerResponse<import("http").IncomingMessage>;
        user: null;
    };
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}>;
export declare const publicProcedure: import("@trpc/server").TRPCProcedureBuilder<{
    req: import("http").IncomingMessage;
    res: import("http").ServerResponse<import("http").IncomingMessage>;
    user: null;
}, object, object, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, false>;
export declare const protectedProcedure: import("@trpc/server").TRPCProcedureBuilder<{
    req: import("http").IncomingMessage;
    res: import("http").ServerResponse<import("http").IncomingMessage>;
    user: null;
}, object, {}, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, false>;
