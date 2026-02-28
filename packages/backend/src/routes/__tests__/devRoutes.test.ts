import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  isDevRouteHostAllowed,
  registerDevRoutes,
  shouldEnableDevRoutes,
} from '../devRoutes.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('dev routes gating', () => {
  it('does not enable dev routes when NODE_ENV is unset', () => {
    delete process.env.NODE_ENV;
    process.env.ENABLE_DEV_ROUTES = 'true';

    expect(shouldEnableDevRoutes()).toBe(false);
  });

  it('does not register dev routes in production builds', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEV_ROUTES = 'true';

    const app = express();
    const registered = await registerDevRoutes(app);
    const stack = (app as any)._router?.stack ?? [];
    const hasDevRoute = stack.some((layer: any) =>
      layer?.regexp?.toString()?.includes('/api/dev')
    );

    expect(shouldEnableDevRoutes()).toBe(false);
    expect(registered).toBe(false);
    expect(hasDevRoute).toBe(false);
  });


  it('never attempts dev module import in production even with module override', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEV_ROUTES = 'true';
    process.env.VALUEOS_DEV_ROUTES_MODULE_PATH = './does-not-exist.js';

    const app = express();
    await expect(registerDevRoutes(app)).resolves.toBe(false);
  it('enables dev routes only in non-production environments when explicitly configured', () => {
    process.env.NODE_ENV = 'staging';
    process.env.ENABLE_DEV_ROUTES = 'true';

    expect(shouldEnableDevRoutes()).toBe(true);
  });

  it('respects the dev route host allowlist', () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_DEV_ROUTES = 'true';
    process.env.DEV_ROUTES_ALLOWED_HOSTS = 'localhost,.example.test';

    expect(isDevRouteHostAllowed('localhost')).toBe(true);
    expect(isDevRouteHostAllowed('app.example.test')).toBe(true);
    expect(isDevRouteHostAllowed('malicious.com')).toBe(false);
  });
});
