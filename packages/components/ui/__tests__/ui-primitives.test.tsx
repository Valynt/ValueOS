import { render, screen } from '@testing-library/react';
import { Skeleton } from '../skeleton';
import { LoadingSkeleton } from '../loading-skeleton';
import { ValidatedInput } from '../validated-input';
import { Checkbox } from '../checkbox';
import { Dialog } from '../dialog';
import { Sheet } from '../sheet';
import { ScrollArea } from '../scroll-area';
import { Tooltip } from '../tooltip';
import { HelpTooltip } from '../help-tooltip';

describe('UI Primitives Accessibility & Render', () => {
  it('renders Skeleton and LoadingSkeleton', () => {
    render(<Skeleton className="h-4 w-4" />);
    render(<LoadingSkeleton variant="card" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders ValidatedInput with label and error', () => {
    render(<ValidatedInput label="Test" value="" error="Required" showValidation />);
    expect(screen.getByLabelText('Test')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('renders Checkbox', () => {
    render(<Checkbox />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renders Dialog', () => {
    render(<Dialog />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders Sheet', () => {
    render(<Sheet />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders ScrollArea', () => {
    render(<ScrollArea>Content</ScrollArea>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders Tooltip and HelpTooltip', () => {
    render(<Tooltip />);
    render(<HelpTooltip content="Help info" />);
    expect(screen.getByLabelText('Help')).toBeInTheDocument();
  });
});
