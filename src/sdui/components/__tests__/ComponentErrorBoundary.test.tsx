import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { ComponentErrorBoundary } from '../ComponentErrorBoundary';
import { __setEnvSourceForTests, env } from '../../../lib/env';
import { captureException } from '../../../lib/sentry';
import { isProduction, isDevelopment } from '../../../config/environment';

// Mock Sentry
vi.mock('../../../lib/sentry', () => ({
  captureException: vi.fn(),
}));

// Mock config environment
vi.mock('../../../config/environment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../config/environment')>();
  return {
    ...actual,
    isProduction: vi.fn(),
    isDevelopment: vi.fn(),
  };
});

const Thrower = () => {
  throw new Error('password=secret123');
};

describe('ComponentErrorBoundary secrecy + retry', () => {
  it('hides sensitive error details outside development while keeping retry and logs to Sentry', () => {
    vi.mocked(isProduction).mockReturnValue(true);
    vi.mocked(isDevelopment).mockReturnValue(false);

    render(
      <ComponentErrorBoundary componentName="Danger">
        <Thrower />
      </ComponentErrorBoundary>
    );

    expect(screen.queryByText(/password=secret123/)).toBeNull();
    const retry = screen.getByRole('button', { name: /retry rendering/i });
    expect(retry).toBeEnabled();

    // Verify Sentry logging
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        contexts: expect.objectContaining({
          react: expect.objectContaining({
            componentStack: expect.any(String),
          }),
        }),
        extra: {
          componentName: 'Danger',
        },
      })
    );
  });
});
