/**
 * Component Interaction Tests
 * 
 * Tests dynamic UI rendering, component targeting, atomic mutations,
 * and interactive component behaviors in SDUI system.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SDUIRenderer } from '../../sdui/renderer';
import { ComponentTargeting } from '../../sdui/ComponentTargeting';
import { AtomicUIActions } from '../../sdui/AtomicUIActions';
import { hotSwapComponent, resetRegistry } from '../../sdui/registry';
import { SDUIPageDefinition } from '../../sdui/schema';

describe('ComponentInteraction - Dynamic Rendering', () => {
  afterEach(() => {
    resetRegistry();
  });

  it('renders components from schema definition', () => {
    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'InfoBanner',
          props: {
            title: 'Test Banner',
            message: 'Dynamic content',
          },
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    expect(screen.getByTestId('sdui-renderer')).toBeInTheDocument();
  });

  it('handles component hot-swapping during runtime', () => {
    const TestComponent = () => <div data-testid="test-component">Swapped</div>;
    
    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'TestWidget',
          props: {},
        },
      ],
    };

    hotSwapComponent('TestWidget', TestComponent);
    render(<SDUIRenderer schema={schema} />);
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
  });

  it('renders nested component hierarchies', () => {
    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Container',
          props: {
            children: [
              {
                type: 'component',
                component: 'InfoBanner',
                props: { title: 'Nested' },
              },
            ],
          },
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    expect(screen.getByTestId('sdui-renderer')).toBeInTheDocument();
  });

  it('handles conditional component rendering', () => {
    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'InfoBanner',
          props: {
            title: 'Visible',
            visible: true,
          },
        },
        {
          type: 'component',
          component: 'InfoBanner',
          props: {
            title: 'Hidden',
            visible: false,
          },
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    expect(screen.getByTestId('sdui-renderer')).toBeInTheDocument();
  });

  it('preserves component state during re-renders', async () => {
    const StatefulComponent = () => {
      const [count, setCount] = React.useState(0);
      return (
        <div>
          <span data-testid="count">{count}</span>
          <button onClick={() => setCount(count + 1)}>Increment</button>
        </div>
      );
    };

    hotSwapComponent('Counter', StatefulComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Counter',
          props: {},
        },
      ],
    };

    const { rerender } = render(<SDUIRenderer schema={schema} />);
    
    const button = screen.getByText('Increment');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });

    rerender(<SDUIRenderer schema={schema} />);
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });
});

describe('ComponentInteraction - Component Targeting', () => {
  const targeting = new ComponentTargeting();

  const sampleLayout: SDUIPageDefinition = {
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'StatCard',
        props: { id: 'card-1', title: 'Revenue', value: 1000 },
      },
      {
        type: 'component',
        component: 'InteractiveChart',
        props: { id: 'chart-1', type: 'bar' },
      },
      {
        type: 'component',
        component: 'StatCard',
        props: { id: 'card-2', title: 'Users', value: 500 },
      },
    ],
  };

  it('finds component by ID', () => {
    const matches = targeting.findComponents(sampleLayout, { id: 'card-1' });
    expect(matches).toHaveLength(1);
    expect(matches[0].section.props.id).toBe('card-1');
    expect(matches[0].confidence).toBeGreaterThan(0.9);
  });

  it('finds components by type', () => {
    const matches = targeting.findComponents(sampleLayout, { type: 'StatCard' });
    expect(matches).toHaveLength(2);
    expect(matches[0].section.component).toBe('StatCard');
  });

  it('finds component by index', () => {
    const matches = targeting.findComponents(sampleLayout, { index: 1 });
    expect(matches).toHaveLength(1);
    expect(matches[0].section.component).toBe('InteractiveChart');
  });

  it('finds components by props match', () => {
    const matches = targeting.findComponents(sampleLayout, {
      props: { type: 'bar' },
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].section.props.type).toBe('bar');
  });

  it('returns matches sorted by confidence', () => {
    const matches = targeting.findComponents(sampleLayout, {
      type: 'StatCard',
      props: { title: 'Revenue' },
    });
    expect(matches.length).toBeGreaterThan(0);
    
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].confidence).toBeGreaterThanOrEqual(matches[i].confidence);
    }
  });

  it('handles no matches gracefully', () => {
    const matches = targeting.findComponents(sampleLayout, {
      id: 'nonexistent',
    });
    expect(matches).toHaveLength(0);
  });

  it('supports fuzzy matching with description', () => {
    const matches = targeting.findComponents(sampleLayout, {
      description: 'revenue card',
    });
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe('ComponentInteraction - Atomic Mutations', () => {
  const actions = new AtomicUIActions();

  const baseLayout: SDUIPageDefinition = {
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'StatCard',
        props: { id: 'card-1', value: 100 },
      },
    ],
  };

  it('mutates component props', () => {
    const result = actions.mutateComponent(
      baseLayout,
      { id: 'card-1' },
      { value: 200 }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.layout.sections[0].props.value).toBe(200);
    }
  });

  it('adds new component to layout', () => {
    const result = actions.addComponent(baseLayout, {
      type: 'component',
      component: 'InfoBanner',
      props: { title: 'New' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.layout.sections).toHaveLength(2);
      expect(result.layout.sections[1].component).toBe('InfoBanner');
    }
  });

  it('removes component from layout', () => {
    const result = actions.removeComponent(baseLayout, { id: 'card-1' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.layout.sections).toHaveLength(0);
    }
  });

  it('reorders components in layout', () => {
    const layout: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'A',
          props: { id: 'a' },
        },
        {
          type: 'component',
          component: 'B',
          props: { id: 'b' },
        },
      ],
    };

    const result = actions.reorderComponents(layout, [1, 0]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.layout.sections[0].component).toBe('B');
      expect(result.layout.sections[1].component).toBe('A');
    }
  });

  it('executes batch mutations atomically', () => {
    const result = actions.batch(baseLayout, [
      {
        type: 'mutate_component',
        selector: { id: 'card-1' },
        props: { value: 300 },
      },
      {
        type: 'add_component',
        section: {
          type: 'component',
          component: 'InfoBanner',
          props: {},
        },
      },
    ]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.layout.sections[0].props.value).toBe(300);
      expect(result.layout.sections).toHaveLength(2);
    }
  });

  it('rolls back on batch mutation failure', () => {
    const result = actions.batch(baseLayout, [
      {
        type: 'mutate_component',
        selector: { id: 'card-1' },
        props: { value: 300 },
      },
      {
        type: 'remove_component',
        selector: { id: 'nonexistent' },
      },
    ]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it('validates mutations before applying', () => {
    const result = actions.mutateComponent(
      baseLayout,
      { id: 'nonexistent' },
      { value: 200 }
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('not found');
    }
  });

  it('preserves layout integrity during mutations', () => {
    const result = actions.mutateComponent(
      baseLayout,
      { id: 'card-1' },
      { value: 200 }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.layout.type).toBe('page');
      expect(result.layout.version).toBe(1);
      expect(result.layout.sections).toBeDefined();
    }
  });
});

describe('ComponentInteraction - Interactive Behaviors', () => {
  afterEach(() => {
    resetRegistry();
  });

  it('handles component click events', async () => {
    const handleClick = vi.fn();
    
    const ClickableComponent = ({ onClick }: { onClick: () => void }) => (
      <button onClick={onClick} data-testid="clickable">Click Me</button>
    );

    hotSwapComponent('Clickable', ClickableComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Clickable',
          props: { onClick: handleClick },
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    
    const button = screen.getByTestId('clickable');
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('handles form input changes', async () => {
    const handleChange = vi.fn();
    
    const FormComponent = ({ onChange }: { onChange: (value: string) => void }) => (
      <input
        data-testid="input"
        onChange={(e) => onChange(e.target.value)}
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
          props: { onChange: handleChange },
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    
    const input = screen.getByTestId('input');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(handleChange).toHaveBeenCalledWith('test');
  });

  it('handles async component loading', async () => {
    const AsyncComponent = () => {
      const [data, setData] = React.useState<string | null>(null);

      React.useEffect(() => {
        setTimeout(() => setData('Loaded'), 100);
      }, []);

      return <div data-testid="async">{data || 'Loading...'}</div>;
    };

    hotSwapComponent('Async', AsyncComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Async',
          props: {},
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    
    expect(screen.getByTestId('async')).toHaveTextContent('Loading...');

    await waitFor(() => {
      expect(screen.getByTestId('async')).toHaveTextContent('Loaded');
    });
  });

  it('propagates events through component hierarchy', async () => {
    const handleEvent = vi.fn();
    
    const ParentComponent = ({ onEvent }: { onEvent: () => void }) => (
      <div>
        <ChildComponent onEvent={onEvent} />
      </div>
    );

    const ChildComponent = ({ onEvent }: { onEvent: () => void }) => (
      <button onClick={onEvent} data-testid="child-button">
        Trigger
      </button>
    );

    hotSwapComponent('Parent', ParentComponent);
    hotSwapComponent('Child', ChildComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Parent',
          props: { onEvent: handleEvent },
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    
    const button = screen.getByTestId('child-button');
    fireEvent.click(button);

    expect(handleEvent).toHaveBeenCalledTimes(1);
  });

  it('handles component unmounting cleanup', () => {
    const cleanup = vi.fn();
    
    const CleanupComponent = () => {
      React.useEffect(() => {
        return cleanup;
      }, []);

      return <div data-testid="cleanup">Component</div>;
    };

    hotSwapComponent('Cleanup', CleanupComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Cleanup',
          props: {},
        },
      ],
    };

    const { unmount } = render(<SDUIRenderer schema={schema} />);
    expect(screen.getByTestId('cleanup')).toBeInTheDocument();

    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe('ComponentInteraction - Error Handling', () => {
  afterEach(() => {
    resetRegistry();
  });

  it('isolates component errors with error boundaries', () => {
    const BrokenComponent = () => {
      throw new Error('Component error');
    };

    hotSwapComponent('Broken', BrokenComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Broken',
          props: {},
        },
        {
          type: 'component',
          component: 'InfoBanner',
          props: { title: 'Safe' },
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    
    expect(screen.getByText(/Component failed to render/)).toBeInTheDocument();
  });

  it('reports hydration warnings', () => {
    const onWarning = vi.fn();

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'UnknownComponent',
          props: {},
        },
      ],
    };

    render(<SDUIRenderer schema={schema} onHydrationWarning={onWarning} />);
    
    expect(onWarning).toHaveBeenCalled();
  });

  it('handles invalid prop types gracefully', () => {
    const TypedComponent = ({ value }: { value: number }) => (
      <div data-testid="typed">{value}</div>
    );

    hotSwapComponent('Typed', TypedComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Typed',
          props: { value: 'invalid' as any },
        },
      ],
    };

    render(<SDUIRenderer schema={schema} />);
    expect(screen.getByTestId('sdui-renderer')).toBeInTheDocument();
  });
});

describe('ComponentInteraction - Performance', () => {
  it('memoizes component rendering', () => {
    const renderCount = { count: 0 };
    
    const MemoComponent = React.memo(() => {
      renderCount.count++;
      return <div data-testid="memo">Memoized</div>;
    });

    hotSwapComponent('Memo', MemoComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Memo',
          props: {},
        },
      ],
    };

    const { rerender } = render(<SDUIRenderer schema={schema} />);
    const initialCount = renderCount.count;

    rerender(<SDUIRenderer schema={schema} />);
    
    expect(renderCount.count).toBe(initialCount);
  });

  it('lazy loads components on demand', async () => {
    const LazyComponent = React.lazy(() =>
      Promise.resolve({
        default: () => <div data-testid="lazy">Lazy Loaded</div>,
      })
    );

    hotSwapComponent('Lazy', LazyComponent);

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'Lazy',
          props: {},
        },
      ],
    };

    render(
      <React.Suspense fallback={<div>Loading...</div>}>
        <SDUIRenderer schema={schema} />
      </React.Suspense>
    );

    await waitFor(() => {
      expect(screen.getByTestId('lazy')).toBeInTheDocument();
    });
  });

  it('handles large component lists efficiently', () => {
    const sections = Array.from({ length: 100 }, (_, i) => ({
      type: 'component' as const,
      component: 'InfoBanner',
      props: { id: `banner-${i}`, title: `Item ${i}` },
    }));

    const schema: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections,
    };

    const start = performance.now();
    render(<SDUIRenderer schema={schema} />);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(1000);
    expect(screen.getByTestId('sdui-renderer')).toBeInTheDocument();
  });
});
