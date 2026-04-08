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
  // Warmth-era paths
  "/work",
  "/work/cases",
  "/work/cases/new",
  "/case/:caseId",
  "/review/:caseId",
  "/library/models",
  "/library/templates",
  "/library/agents",
] as const;

export const adminRoutePaths: readonly string[] = [];

export const workRoutePaths = [
  "/work",
  "/work/cases",
  "/work/cases/new",
] as const;

export const caseRoutePaths = [
  "/case/:caseId",
] as const;

export const reviewRoutePaths = [
  "/review/:caseId",
] as const;

export const libraryRoutePaths = [
  "/library/models",
  "/library/templates",
  "/library/agents",
] as const;

export const redirectRoutes = [
  { path: "/", to: "/dashboard" },
  { path: "/home", to: "/dashboard" },
] as const;
