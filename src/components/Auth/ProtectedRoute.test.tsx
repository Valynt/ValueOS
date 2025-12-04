import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext');

const mockUseAuth = useAuth as unknown as vi.Mock;

describe('ProtectedRoute', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  const renderRoute = () =>
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Secret Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

  it('shows loading state while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    renderRoute();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('redirects to login when unauthenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    renderRoute();

    expect(screen.getByText(/login page/i)).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { id: '1' }, loading: false });

    renderRoute();

    expect(screen.getByText(/secret content/i)).toBeInTheDocument();
  });
});
