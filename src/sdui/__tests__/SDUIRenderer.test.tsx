import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SDUIRenderer } from '../../sdui/renderer';
import { OpportunityTemplate } from '../../sdui/templates';
import { hotSwapComponent, resetRegistry } from '../../sdui/registry';

const BrokenComponent = () => {
  throw new Error('Boom');
};

describe('SDUIRenderer', () => {
  afterEach(() => {
    resetRegistry();
  });

  it('renders schema-driven lifecycle layout', () => {
    render(<SDUIRenderer schema={OpportunityTemplate} />);
    expect(screen.getByTestId('sdui-renderer')).toBeInTheDocument();
    expect(screen.getByText('Opportunity Discovery')).toBeInTheDocument();
    // Verify sections are rendered (3 sections in OpportunityTemplate)
    const renderer = screen.getByTestId('sdui-renderer');
    expect(renderer.children.length).toBe(3);
  });

  it('falls back when schema is invalid', () => {
    render(<SDUIRenderer schema={{}} />);
    expect(screen.getByTestId('invalid-schema')).toBeInTheDocument();
  });

  it('surfaces unknown component placeholders', () => {
    const template = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'NonexistentWidget',
          props: {},
        },
      ],
    };

    render(<SDUIRenderer schema={template} />);
    expect(screen.getByText(/Component unavailable/)).toBeInTheDocument();
  });

  it('wraps components in error boundaries to preserve hydration', () => {
    hotSwapComponent('InfoBanner', BrokenComponent);
    const warn = vi.fn();
    render(<SDUIRenderer schema={OpportunityTemplate} onHydrationWarning={warn} />);
    // Error boundary should catch the error
    expect(screen.queryByText('Opportunity Discovery')).not.toBeInTheDocument();
  });
});
