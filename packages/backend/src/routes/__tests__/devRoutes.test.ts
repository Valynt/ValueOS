import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../lib/logger.js";
import {
  assertDevRoutesConfiguration,
  isDevRouteHostAllowed,
  registerDevRoutes,
  shouldEnableDevRoutes,
} from "../devRoutes.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("dev routes gating", () => {
  it("does not enable dev routes when NODE_ENV is unset", () => {
    delete process.env.NODE_ENV;
    process.env.ENABLE_DEV_ROUTES = "true";

    expect(shouldEnableDevRoutes()).toBe(false);
  });

  it("does not register dev routes in production builds", async () => {
    process.env.NODE_ENV = "production";
    process.env.ENABLE_DEV_ROUTES = "true";

    const app = express();
    const registered = await registerDevRoutes(app);
    const stack = (app as any)._router?.stack ?? [];
    const hasDevRoute = stack.some((layer: any) =>
      layer?.regexp?.toString()?.includes("/api/dev")
    );

    expect(shouldEnableDevRoutes()).toBe(false);
    expect(registered).toBe(false);
    expect(hasDevRoute).toBe(false);
  });

  it("enables dev routes only in non-production environments when explicitly configured", () => {
    process.env.NODE_ENV = "staging";
    process.env.ENABLE_DEV_ROUTES = "true";

    expect(shouldEnableDevRoutes()).toBe(true);
  });

  it("respects the dev route host allowlist", () => {
    process.env.NODE_ENV = "development";
    process.env.ENABLE_DEV_ROUTES = "true";
    process.env.DEV_ROUTES_ALLOWED_HOSTS = "localhost,.example.test";

    expect(isDevRouteHostAllowed("localhost")).toBe(true);
    expect(isDevRouteHostAllowed("app.example.test")).toBe(true);
    expect(isDevRouteHostAllowed("malicious.com")).toBe(false);
  });
});

describe("assertDevRoutesConfiguration", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // process.exit must be spied on — it would terminate the test runner otherwise
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  it("calls process.exit(1) when ENABLE_DEV_ROUTES=true in production", () => {
    process.env.NODE_ENV = "production";
    process.env.ENABLE_DEV_ROUTES = "true";

    assertDevRoutesConfiguration();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("logs the child_process risk before exiting", () => {
    process.env.NODE_ENV = "production";
    process.env.ENABLE_DEV_ROUTES = "true";

    const logSpy = vi.spyOn(logger, "error");

    assertDevRoutesConfiguration();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("child_process operations")
    );
  });

  it("does not call process.exit when ENABLE_DEV_ROUTES is unset in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ENABLE_DEV_ROUTES;

    assertDevRoutesConfiguration();

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("does not call process.exit when ENABLE_DEV_ROUTES=true in development", () => {
    process.env.NODE_ENV = "development";
    process.env.ENABLE_DEV_ROUTES = "true";

    assertDevRoutesConfiguration();

    expect(exitSpy).not.toHaveBeenCalled();
  });
});
