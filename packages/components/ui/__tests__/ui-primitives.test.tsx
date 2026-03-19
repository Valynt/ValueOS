import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Checkbox } from '../checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../dialog';
import { HelpTooltip } from '../help-tooltip';
import { LoadingSkeleton } from '../loading-skeleton';
import { ScrollArea } from '../scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '../sheet';
import { Skeleton } from '../skeleton';
import { ValidatedInput } from '../validated-input';

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

  it('renders Dialog content with accessible name and description', () => {
    render(
      <Dialog open={true}>
        <DialogContent>
          <DialogTitle>Preferences</DialogTitle>
          <DialogDescription>Update your account settings.</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByRole('dialog', { name: 'Preferences' })).toBeInTheDocument();
    expect(screen.getByText('Update your account settings.')).toBeVisible();
  });

  it('renders Sheet content with accessible name and description', () => {
    render(
      <Sheet open={true}>
        <SheetContent>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Refine the visible results.</SheetDescription>
        </SheetContent>
      </Sheet>
    );

    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.getByText('Refine the visible results.')).toBeVisible();
  });

  it('renders ScrollArea', () => {
    render(<ScrollArea>Content</ScrollArea>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('reveals HelpTooltip content on hover and focus', async () => {
    const user = userEvent.setup();

    render(<HelpTooltip content="Help info" />);

    const trigger = screen.getByRole('button', { name: 'Help' });
    expect(screen.queryByText('Help info')).not.toBeInTheDocument();

    await user.hover(trigger);
    expect(await screen.findByText('Help info')).toBeVisible();

    await user.unhover(trigger);
    expect(screen.queryByText('Help info')).not.toBeInTheDocument();

    await user.tab();
    expect(trigger).toHaveFocus();
    expect(await screen.findByText('Help info')).toBeVisible();
  });
});
