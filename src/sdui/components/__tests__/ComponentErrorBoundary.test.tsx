import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { ComponentErrorBoundary } from '../ComponentErrorBoundary';
import { __setEnvSourceForTests, env } from '../../lib/env';

const Thrower = () => {
  throw new Error('password=secret123');
};

describe('ComponentErrorBoundary secrecy + retry', () => {
  it('hides sensitive error details outside development while keeping retry', () => {
    const originalMode = env.mode;
    __setEnvSourceForTests({ NODE_ENV: 'production' });

    render(
      <ComponentErrorBoundary componentName="Danger">
        <Thrower />
      </ComponentErrorBoundary>
    );

    expect(screen.queryByText(/password=secret123/)).toBeNull();
    const retry = screen.getByRole('button', { name: /try again/i });
    expect(retry).toBeEnabled();

    __setEnvSourceForTests({ NODE_ENV: originalMode });
  });
});
