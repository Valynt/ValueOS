declare let supabase: any;
export { supabase };
export declare function getSupabaseClient(): any;
export declare function createRequestSupabaseClient(req: {
    headers?: {
        authorization?: string | string[];
    };
    supabase?: any;
    supabaseUser?: any;
    user?: any;
}): import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
export declare function getRequestSupabaseClient(req: {
    headers?: {
        authorization?: string | string[];
    };
    supabase?: any;
    supabaseUser?: any;
    user?: any;
}): any;
export declare function createServerSupabaseClient(serviceKey?: string): import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
//# sourceMappingURL=supabase.d.ts.map