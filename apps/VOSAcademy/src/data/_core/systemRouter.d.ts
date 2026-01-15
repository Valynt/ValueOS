export declare const systemRouter: import("@trpc/server").TRPCBuiltRouter<{
    ctx: {
        req: import("http").IncomingMessage;
        res: import("http").ServerResponse<import("http").IncomingMessage>;
        user: null;
    };
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
    health: any;
    version: any;
}>>;
