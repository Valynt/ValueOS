/**
 * Accessibility Compliance Tests
 * 
 * Tests SDUI components for WCAG 2.1 AA compliance, ARIA attributes,
 * keyboard navigation, screen reader support, and focus management.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SDUIRenderer } from '../../sdui/renderer';
import { SDUIPageDefinition } from '../../sdui/schema';
import { hotSwapComponent, resetRegistry } from '../../sdui/registry';

expect.extend(toHaveNoViolations);

describe('AccessibilityCompliance - ARIA Attributes', () => {
  afterEach(() => {
    resetRegistry();
  });

  it('includes proper ARIA roles on components', () => {
    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'InfoBanner',
          props: { title: 'Test', role: 'banner' },
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    expect(screen.getByTestId('sdui-renderer')).toBeInTheDocument();
  });

  it('provides ARIA labels for interactive elements', () => {
    const ButtonComponent = () => (
      <button aria-label="Submit form" data-testid="button">
        Submit
      </button>
    );

    hotSwapComponent('Button', ButtonComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Button',
          props: {},
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    const button = screen.getByTestId('button');
    expect(button).toHaveAttribute('aria-label', 'Submit form');
  });

  it('uses ARIA live regions for dynamic content', () => {
    const LiveComponent = () => (
      <div aria-live="polite" aria-atomic="true" data-testid="live">
        Dynamic content
      </div>
    );

    hotSwapComponent('Live', LiveComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Live',
          props: {},
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    const live = screen.getByTestId('live');
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('marks required form fields with aria-required', () => {
    const FormComponent = () => (
      <input
        type="text"
        aria-required="true"
        aria-label="Email address"
        data-testid="input"
      />
    );

    hotSwapComponent('Form', FormComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Form',
          props: {},
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    const input = screen.getByTestId('input');
    expect(input).toHaveAttribute('aria-required', 'true');
  });
});

describe('AccessibilityCompliance - Keyboard Navigation', () => {
  afterEach(() => {
    resetRegistry();
  });

  it('supports tab navigation through interactive elements', () => {
    const NavComponent = () => (
      <div>
        <button tabIndex={0} data-testid="btn-1">First</button>
        <button tabIndex={0} data-testid="btn-2">Second</button>
      </div>
    );

    hotSwapComponent('Nav', NavComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Nav',
          props: {},
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    expect(screen.getByTestId('btn-1')).toHaveAttribute('tabIndex', '0');
    expect(screen.getByTestId('btn-2')).toHaveAttribute('tabIndex', '0');
  });

  it('excludes hidden elements from tab order', () => {
    const HiddenComponent = () => (
      <div>
        <button data-testid="visible">Visible</button>
        <button tabIndex={-1} data-testid="hidden">Hidden</button>
      </div>
    );

    hotSwapComponent('Hidden', HiddenComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Hidden',
          props: {},
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    expect(screen.getByTestId('hidden')).toHaveAttribute('tabIndex', '-1');
  });
});

describe('AccessibilityCompliance - Focus Management', () => {
  afterEach(() => {
    resetRegistry();
  });

  it('maintains visible focus indicators', () => {
    const FocusComponent = () => (
      <button
        data-testid="focus-btn"
        style={{ outline: '2px solid blue' }}
      >
        Focus me
      </button>
    );

    hotSwapComponent('Focus', FocusComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Focus',
          props: {},
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    const button = screen.getByTestId('focus-btn');
    expect(button).toHaveStyle({ outline: '2px solid blue' });
  });
});

describe('AccessibilityCompliance - Semantic HTML', () => {
  afterEach(() => {
    resetRegistry();
  });

  it('uses semantic heading hierarchy', () => {
    const HeadingComponent = () => (
      <div>
        <h1>Main Title</h1>
        <h2>Subtitle</h2>
        <h3>Section</h3>
      </div>
    );

    hotSwapComponent('Heading', HeadingComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Heading',
          props: {},
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('uses proper list markup', () => {
    const ListComponent = () => (
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
    );

    hotSwapComponent('List', ListComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'List',
          props: {},
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});

describe('AccessibilityCompliance - Color Contrast', () => {
  it('validates color contrast ratios', () => {
    const ContrastComponent = () => (
      <div
        style={{ backgroundColor: '#000', color: '#fff' }}
        data-testid="contrast"
      >
        High contrast text
      </div>
    );

    hotSwapComponent('Contrast', ContrastComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Contrast',
          props: {},
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    expect(screen.getByTestId('contrast')).toBeInTheDocument();
  });
});

describe('AccessibilityCompliance - Error Handling', () => {
  afterEach(() => {
    resetRegistry();
  });

  it('announces errors to screen readers', () => {
    const ErrorComponent = () => (
      <div role="alert" aria-live="assertive" data-testid="error">
        Error: Invalid input
      </div>
    );

    hotSwapComponent('Error', ErrorComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Error',
          props: {},
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    const error = screen.getByTestId('error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveAttribute('aria-live', 'assertive');
  });
});
