/**
 * SignupPage Component Tests
 * Comprehensive tests for user registration UI and validation
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../../../contexts/AuthContext';
import { RateLimitError, ValidationError } from '../../../services/errors';
import { SignupPage } from '../SignupPage';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('SignupPage Component', () => {
  const mockSignup = vi.fn();

  const createAuthContext = () => ({
    user: null,
    userClaims: null,
    session: null,
    loading: false,
    isAuthenticated: false,
    login: vi.fn(),
    signup: mockSignup,
    logout: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    resendVerificationEmail: vi.fn(),
    signInWithProvider: vi.fn(),
  });

  const renderSignupPage = () => {
    const authContext = createAuthContext();
    return render(
      <BrowserRouter>
        <AuthContext.Provider value={authContext}>
          <SignupPage />
        </AuthContext.Provider>
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('should render signup form with all required fields', () => {
      renderSignupPage();

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /terms/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('should render link to login page', () => {
      renderSignupPage();

      const loginLink = screen.getByText(/already have an account/i);
      expect(loginLink).toBeInTheDocument();
      expect(loginLink.closest('a')).toHaveAttribute('href', '/login');
    });

    it('should render terms of service link', () => {
      renderSignupPage();

      const tosLink = screen.getByText(/terms of service/i);
      expect(tosLink).toBeInTheDocument();
      expect(tosLink).toHaveAttribute('target', '_blank');
    });
  });

  describe('Email Validation', () => {
    it('should accept valid email addresses', async () => {
      renderSignupPage();
      mockSignup.mockResolvedValue({});

      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user@subdomain.example.com',
        'user@example.co.uk',
      ];

      for (const email of validEmails) {
        const emailInput = screen.getByLabelText(/email/i);
        fireEvent.change(emailInput, { target: { value: email } });
        
        // Should show no error
        await waitFor(() => {
          const errorMessage = screen.queryByText(/invalid email/i);
          expect(errorMessage).not.toBeInTheDocument();
        });
      }
    });

    it('should reject invalid email formats', async () => {
      renderSignupPage();

      const invalidEmails = [
        { email: 'notemail', error: /invalid email/i },
        { email: 'user@', error: /invalid email/i },
        { email: '@example.com', error: /invalid email/i },
        { email: 'user @example.com', error: /invalid email/i },
        { email: 'user@@example.com', error: /invalid email/i },
      ];

      for (const { email, error } of invalidEmails) {
        const emailInput = screen.getByLabelText(/email/i);
        fireEvent.change(emailInput, { target: { value: email } });
        fireEvent.blur(emailInput);

        await waitFor(() => {
          expect(screen.getByText(error)).toBeInTheDocument();
        });
      }
    });

    it('should reject email exceeding max length', async () => {
      renderSignupPage();

      const longEmail = 'a'.repeat(250) + '@example.com'; // > 254 chars
      const emailInput = screen.getByLabelText(/email/i);
      
      fireEvent.change(emailInput, { target: { value: longEmail } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText(/email too long/i)).toBeInTheDocument();
      });
    });
  });

  describe('Password Validation', () => {
    it('should enforce minimum length requirement', async () => {
      renderSignupPage();

      const passwordInput = screen.getByLabelText(/^password$/i);
      fireEvent.change(passwordInput, { target: { value: 'Pass1!' } }); // 6 chars
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it('should require uppercase letter', async () => {
      renderSignupPage();

      const passwordInput = screen.getByLabelText(/^password$/i);
      fireEvent.change(passwordInput, { target: { value: 'password123!' } });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText(/uppercase letter/i)).toBeInTheDocument();
      });
    });

    it('should require lowercase letter', async () => {
      renderSignupPage();

      const passwordInput = screen.getByLabelText(/^password$/i);
      fireEvent.change(passwordInput, { target: { value: 'PASSWORD123!' } });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText(/lowercase letter/i)).toBeInTheDocument();
      });
    });

    it('should require number', async () => {
      renderSignupPage();

      const passwordInput = screen.getByLabelText(/^password$/i);
      fireEvent.change(passwordInput, { target: { value: 'Password!@#' } });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText(/number/i)).toBeInTheDocument();
      });
    });

    it('should require special character', async () => {
      renderSignupPage();

      const passwordInput = screen.getByLabelText(/^password$/i);
      fireEvent.change(passwordInput, { target: { value: 'Password123' } });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText(/special character/i)).toBeInTheDocument();
      });
    });

    it('should accept password meeting all requirements', async () => {
      renderSignupPage();

      const passwordInput = screen.getByLabelText(/^password$/i);
      fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        const errorMessages = screen.queryAllByText(/password/i);
        const hasError = errorMessages.some(msg => 
          msg.textContent?.includes('must contain') ||
          msg.textContent?.includes('at least')
        );
        expect(hasError).toBe(false);
      });
    });

    it('should display password strength indicator', async () => {
      renderSignupPage();

      const passwordInput = screen.getByLabelText(/^password$/i);
      
      // Weak password
      fireEvent.change(passwordInput, { target: { value: 'pass123' } });
      await waitFor(() => {
        expect(screen.getByText(/weak/i)).toBeInTheDocument();
      });

      // Strong password
      fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
      await waitFor(() => {
        expect(screen.getByText(/strong/i)).toBeInTheDocument();
      });
    });
  });

  describe('Password Confirmation', () => {
    it('should require passwords to match', async () => {
      renderSignupPage();

      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
      fireEvent.change(confirmInput, { target: { value: 'DifferentPass123!' } });
      fireEvent.blur(confirmInput);

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('should show success when passwords match', async () => {
      renderSignupPage();

      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
      fireEvent.change(confirmInput, { target: { value: 'SecurePass123!' } });
      fireEvent.blur(confirmInput);

      await waitFor(() => {
        const errorMessage = screen.queryByText(/passwords do not match/i);
        expect(errorMessage).not.toBeInTheDocument();
      });
    });
  });

  describe('Full Name Validation', () => {
    it('should accept valid names', async () => {
      renderSignupPage();

      const validNames = [
        'John Doe',
        "O'Connor",
        'Jean-Pierre',
        'José María',
        'Müller',
      ];

      for (const name of validNames) {
        const nameInput = screen.getByLabelText(/full name/i);
        fireEvent.change(nameInput, { target: { value: name } });
        fireEvent.blur(nameInput);

        await waitFor(() => {
          const errorMessage = screen.queryByText(/invalid name/i);
          expect(errorMessage).not.toBeInTheDocument();
        });
      }
    });

    it('should reject name that is too short', async () => {
      renderSignupPage();

      const nameInput = screen.getByLabelText(/full name/i);
      fireEvent.change(nameInput, { target: { value: 'X' } });
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(screen.getByText(/name too short/i)).toBeInTheDocument();
      });
    });

    it('should reject name that is too long', async () => {
      renderSignupPage();

      const nameInput = screen.getByLabelText(/full name/i);
      const longName = 'A'.repeat(101);
      fireEvent.change(nameInput, { target: { value: longName } });
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(screen.getByText(/name too long/i)).toBeInTheDocument();
      });
    });
  });

  describe('Terms of Service', () => {
    it('should require ToS acceptance before submission', async () => {
      renderSignupPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);
      const nameInput = screen.getByLabelText(/full name/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
      fireEvent.change(confirmInput, { target: { value: 'SecurePass123!' } });
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      
      // Don't check ToS checkbox
      fireEvent.click(submitButton);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/must accept.*terms/i)).toBeInTheDocument();
      });
      expect(mockSignup).not.toHaveBeenCalled();
    });

    it('should allow submission when ToS is accepted', async () => {
      renderSignupPage();
      mockSignup.mockResolvedValue({});

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);
      const nameInput = screen.getByLabelText(/full name/i);
      const tosCheckbox = screen.getByRole('checkbox', { name: /terms/i });
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
      fireEvent.change(confirmInput, { target: { value: 'SecurePass123!' } });
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.click(tosCheckbox);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSignup).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'SecurePass123!',
          fullName: 'Test User',
        });
      });
    });
  });

  describe('Form Submission', () => {
    it('should successfully submit valid signup form', async () => {
      renderSignupPage();
      mockSignup.mockResolvedValue({
        user: { id: '123', email: 'test@example.com' },
        session: { access_token: 'token123' },
      });

      // Fill form
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'SecurePass123!' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'SecurePass123!' },
      });
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Test User' },
      });
      fireEvent.click(screen.getByRole('checkbox', { name: /terms/i }));
      
      // Submit
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockSignup).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/verify-email');
      });
    });

    it('should show loading state during submission', async () => {
      renderSignupPage();
      mockSignup.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'SecurePass123!' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'SecurePass123!' },
      });
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Test User' },
      });
      fireEvent.click(screen.getByRole('checkbox', { name: /terms/i }));
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/creating account/i)).toBeInTheDocument();
      });
    });

    it('should disable form during submission', async () => {
      renderSignupPage();
      mockSignup.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const submitButton = screen.getByRole('button', { name: /create account/i });

      // Fill and submit
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'SecurePass123!' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'SecurePass123!' },
      });
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Test User' },
      });
      fireEvent.click(screen.getByRole('checkbox', { name: /terms/i }));
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error for duplicate email', async () => {
      renderSignupPage();
      mockSignup.mockRejectedValue(
        new ValidationError('User already exists with this email')
      );

      // Fill and submit
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'existing@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'SecurePass123!' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'SecurePass123!' },
      });
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Test User' },
      });
      fireEvent.click(screen.getByRole('checkbox', { name: /terms/i }));
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });
    });

    it('should display rate limit error', async () => {
      renderSignupPage();
      mockSignup.mockRejectedValue(
        new RateLimitError('Too many signup attempts. Please try again later.')
      );

      // Fill and submit
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'SecurePass123!' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'SecurePass123!' },
      });
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Test User' },
      });
      fireEvent.click(screen.getByRole('checkbox', { name: /terms/i }));
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/too many.*attempts/i)).toBeInTheDocument();
      });
    });

    it('should display generic error for unknown errors', async () => {
      renderSignupPage();
      mockSignup.mockRejectedValue(new Error('Unknown error'));

      // Fill and submit
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'SecurePass123!' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'SecurePass123!' },
      });
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Test User' },
      });
      fireEvent.click(screen.getByRole('checkbox', { name: /terms/i }));
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility', () => {
      renderSignupPage();

      const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
      const toggleButton = screen.getAllByRole('button', { name: /show|hide/i })[0];

      expect(passwordInput.type).toBe('password');

      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('text');

      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('password');
    });

    it('should toggle confirm password visibility', () => {
      renderSignupPage();

      const confirmInput = screen.getByLabelText(/confirm password/i) as HTMLInputElement;
      const toggleButtons = screen.getAllByRole('button', { name: /show|hide/i });
      const confirmToggle = toggleButtons[1];

      expect(confirmInput.type).toBe('password');

      fireEvent.click(confirmToggle);
      expect(confirmInput.type).toBe('text');

      fireEvent.click(confirmToggle);
      expect(confirmInput.type).toBe('password');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderSignupPage();

      expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/full name/i)).toHaveAttribute('aria-required', 'true');
    });

    it('should associate error messages with inputs', async () => {
      renderSignupPage();

      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'invalid' } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveAttribute('aria-describedby');
      });
    });
  });
});
