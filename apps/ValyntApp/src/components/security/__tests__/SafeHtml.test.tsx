import { render, screen } from '@testing-library/react';
import { describe, it } from 'vitest';

import { SafeHtml } from '../SafeHtml';

describe('SafeHtml', () => {
  it('sanitizes scriptable html before rendering', () => {
    render(<SafeHtml html={'<img src=x onerror="alert(1)"><p>ok</p>'} />);

    expect(screen.getByText('ok')).toBeInTheDocument();
    const html = document.body.innerHTML;
    expect(html).not.toContain('onerror');
  });
});
