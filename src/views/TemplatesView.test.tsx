import React from 'react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '../test/test-utils';
import { TemplatesView } from './TemplatesView';

vi.mock('../services/TemplateLibrary', () => {
  const { createTemplate } = vi.importActual<any>('../test/factories');
  const templates = [
    createTemplate({ id: '1', name: 'Revenue Metrics', category: 'metrics', tags: ['finance'] }),
    createTemplate({ id: '2', name: 'Customer Table', category: 'tables', tags: ['customers'] }),
  ];
  return {
    templateLibrary: {
      getAllTemplates: vi.fn(() => templates),
    },
  };
});

const user = userEvent.setup();

describe('TemplatesView', () => {
  it('renders templates and triggers use action', async () => {
    const onUseTemplate = vi.fn();

    renderWithProviders(<TemplatesView onUseTemplate={onUseTemplate} />);

    expect(screen.getByRole('heading', { name: /template library/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use template/i })).toBeEnabled();

    await user.click(screen.getAllByRole('button', { name: /use template/i })[0]);
    expect(onUseTemplate).toHaveBeenCalledWith('1');
  });

  it('filters by search and category', async () => {
    const onUseTemplate = vi.fn();
    renderWithProviders(<TemplatesView onUseTemplate={onUseTemplate} />);

    await user.type(
      screen.getByPlaceholderText(/search templates/i),
      'customer'
    );
    expect(screen.getByText(/customer table/i)).toBeInTheDocument();
    expect(screen.queryByText(/revenue metrics/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /charts/i }));
    expect(screen.getByText(/no templates found/i)).toBeInTheDocument();
  });
});
