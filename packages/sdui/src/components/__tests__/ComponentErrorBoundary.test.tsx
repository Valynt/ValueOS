import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { captureException } from '../../../lib/sentry';
import { ComponentErrorBoundary } from '../ComponentErrorBoundary';

vi.mock('../../../lib/sentry', () => ({
  captureException: vi.fn(),
}));

const Thrower = () => {
  throw new Error('password=secret123');
};

describe('ComponentErrorBoundary secrecy + retry', () => {
  it('hides sensitive error details outside development while keeping retry', () => {
    render(
      <ComponentErrorBoundary componentName="Danger" showErrorDetails={false}>
        <Thrower />
      </ComponentErrorBoundary>
    );

    expect(screen.queryByText(/password=secret123/)).toBeNull();
    const retry = screen.getByRole('button', { name: /retry rendering/i });
    expect(retry).toBeEnabled();
    expect(captureException).not.toHaveBeenCalled();
  });
});
