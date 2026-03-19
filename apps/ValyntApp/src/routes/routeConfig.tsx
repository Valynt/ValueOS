export const publicRoutePaths = [
  "/login",
  "/signup",
  "/reset-password",
  "/auth/callback",
  "/guest/access",
] as const;

export const protectedRoutePaths = [
  "/create-org",
  "/onboarding",
  "/dashboard",
  "/opportunities",
  "/opportunities/:id",
  "/opportunities/:oppId/cases/:caseId",
  "/models",
  "/models/:id",
  "/agents",
  "/agents/:id",
  "/integrations",
  "/settings",
  "/workspace/:caseId",
  "/company",
] as const;

export const adminRoutePaths: readonly string[] = [];

export const redirectRoutes = [
  { path: "/", to: "/dashboard" },
  { path: "/home", to: "/dashboard" },
] as const;
