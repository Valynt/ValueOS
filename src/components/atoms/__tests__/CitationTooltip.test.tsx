import { fireEvent, render, screen } from '@testing-library/react';
import { CitationTooltip } from '../CitationTooltip';
import React from 'react';

describe('CitationTooltip', () => {
  it('has accessible trigger button', () => {
    render(
      <CitationTooltip
        citationId="CRM-123"
        sourceType="crm"
      />
    );

    const button = screen.getByRole('button');
    // Expect label to include both ID and source
    expect(button).toHaveAttribute('aria-label', 'Citation CRM-123 from CRM');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('updates aria-expanded when toggled', () => {
    render(
      <CitationTooltip
        citationId="CRM-123"
        sourceType="crm"
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
