import React from 'react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '../../test/test-utils';
import { Button, IconButton, ButtonGroup } from './Button';

const user = userEvent.setup();

describe('Button', () => {
  it('renders with label and handles click', async () => {
    const onClick = vi.fn();

    renderWithProviders(<Button onClick={onClick}>Submit</Button>);

    const button = screen.getByRole('button', { name: /submit/i });
    expect(button).toBeEnabled();

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies loading state and prevents interaction', async () => {
    const onClick = vi.fn();

    renderWithProviders(
      <Button loading loadingText="Saving" onClick={onClick}>
        Save
      </Button>
    );

    const button = screen.getByRole('button', { name: /saving/i });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders icons and respects variant, size, and fullWidth props', () => {
    const leftIcon = <span data-testid="left">L</span>;
    const rightIcon = <span data-testid="right">R</span>;

    renderWithProviders(
      <Button variant="outline" size="lg" fullWidth leftIcon={leftIcon} rightIcon={rightIcon}>
        Download
      </Button>
    );

    expect(screen.getByTestId('left')).toBeInTheDocument();
    expect(screen.getByTestId('right')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /download/i });
    expect(button.className).toContain('w-full');
    expect(button.className).toContain('border-indigo-600');
  });

  it('supports keyboard activation', async () => {
    const onClick = vi.fn();
    renderWithProviders(<Button onClick={onClick}>Keyboard</Button>);

    const button = screen.getByRole('button', { name: /keyboard/i });
    button.focus();
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

describe('IconButton', () => {
  it('renders accessible icon button and triggers click', async () => {
    const onClick = vi.fn();

    renderWithProviders(
      <IconButton icon={<span>★</span>} label="favorite" onClick={onClick} variant="danger" />
    );

    const button = screen.getByRole('button', { name: /favorite/i });
    expect(button).toBeEnabled();

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows loader when loading and hides icon', () => {
    renderWithProviders(
      <IconButton icon={<span>★</span>} label="sync" loading size="sm" />
    );

    const button = screen.getByRole('button', { name: /sync/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('svg')).toBeInTheDocument();
  });
});

describe('ButtonGroup', () => {
  it('groups buttons with correct orientation', () => {
    renderWithProviders(
      <ButtonGroup orientation="vertical" className="custom">
        <Button>One</Button>
        <Button>Two</Button>
      </ButtonGroup>
    );

    const group = screen.getByRole('group');
    expect(group.className).toContain('flex-col');
    expect(group.className).toContain('custom');
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
