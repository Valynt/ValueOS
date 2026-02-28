import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

import { registerComponent, resetRegistry } from '../registry';
import { renderPage } from '../renderPage';

describe('renderPage SDUI fallbacks', () => {
  beforeEach(() => {
    resetRegistry();
  });

  it('renders fallback component inside ComponentErrorBoundary on hydration failure', () => {
    const Fallback = ({ message }: { message: string }) => <div data-testid="fallback">{message}</div>;
    registerComponent('FallbackComponent', { component: Fallback, versions: [1] });

    const page = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'MissingPrimary',
          version: 1,
          hydrateWith: ['/api/bad'],
          fallback: {
            component: 'FallbackComponent',
            props: { message: 'Using fallback' },
          },
        },
      ],
    };

    const { element } = renderPage(page);
    const { getByTestId } = render(element);
    expect(getByTestId('fallback').textContent).toContain('Using fallback');
  });

  it('falls back to message block when fallback component cannot resolve', () => {
    const page = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Primary',
          version: 1,
          hydrateWith: ['/api/bad'],
          fallback: { message: 'Component unavailable' },
        },
      ],
    };

    const { element } = renderPage(page, { debug: true });
    const { getByText } = render(element);
    expect(getByText('Component unavailable')).toBeInTheDocument();
  });
});
