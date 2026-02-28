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

  it("has no protected or admin routes wired yet", () => {
    expect(protectedRoutePaths).toEqual([]);
    expect(adminRoutePaths).toEqual([]);
  });

  it("redirects the root path to login", () => {
    expect(redirectRoutes).toEqual([{ path: "/", to: "/login" }]);
  });
});
