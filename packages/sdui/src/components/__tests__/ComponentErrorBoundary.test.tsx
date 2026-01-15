import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ComponentErrorBoundary } from '../ComponentErrorBoundary';
import { captureException } from '../../../lib/sentry';
import { isDevelopment, isProduction } from '../../../config/environment';

vi.mock('../../../lib/sentry', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../../config/environment', () => ({
  isProduction: vi.fn(),
  isDevelopment: vi.fn(),
}));

const Thrower = () => {
  throw new Error('password=secret123');
};

describe('ComponentErrorBoundary secrecy + retry', () => {
  it('hides sensitive error details outside development while keeping retry', () => {
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

    expect(captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: {
        componentName: 'Danger',
        componentStack: expect.any(String),
      },
    });
  });
});
