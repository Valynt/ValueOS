import { describe, expect, it } from "vitest";

import {
  adminRoutePaths,
  protectedRoutePaths,
  publicRoutePaths,
  redirectRoutes,
} from "../routeConfig";

describe("ValyntApp route config", () => {
  it("lists the intended public routes", () => {
    expect(publicRoutePaths).toEqual([
      "/login",
      "/signup",
      "/reset-password",
      "/auth/callback",
      "/guest/access",
    ]);
  });

  it("tracks protected routes from the active AppRoutes tree", () => {
    expect(protectedRoutePaths).toEqual([
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
    ]);
  });

  it("has no admin-only routes in the current active router", () => {
    expect(adminRoutePaths).toEqual([]);
  });

  it("redirects legacy root paths to dashboard", () => {
    expect(redirectRoutes).toEqual([
      { path: "/", to: "/dashboard" },
      { path: "/home", to: "/dashboard" },
    ]);
  });
});
