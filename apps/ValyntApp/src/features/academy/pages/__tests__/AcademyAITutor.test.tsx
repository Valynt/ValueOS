import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it } from 'vitest';

import AcademyAITutor from '../AcademyAITutor';

describe('AcademyAITutor', () => {
  it('renders with accessible labels', () => {
    render(
      <MemoryRouter>
        <AcademyAITutor />
      </MemoryRouter>
    );

    expect(screen.getByLabelText('Send message')).toBeInTheDocument();
    expect(screen.getByLabelText('Message input')).toBeInTheDocument();
  });
});
