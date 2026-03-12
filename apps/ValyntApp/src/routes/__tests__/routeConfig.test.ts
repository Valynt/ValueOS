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
    ]);
  });

  it("keeps protected/admin route declarations explicit", () => {
    expect(protectedRoutePaths).toEqual([]);
    expect(adminRoutePaths).toEqual([]);
  });

  it("matches root and home redirects used by AppRoutes", () => {
    expect(redirectRoutes).toEqual([
      { path: "/", to: "/dashboard" },
      { path: "/home", to: "/dashboard" },
    ]);
  });
});
