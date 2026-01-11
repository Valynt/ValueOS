/**
 * Password Policy Hook
 * Phase 2 Task 2: Password Policy Integration
 * 
 * Fetches organization password policy from database and provides validation
 */

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: {
    score: number; // 0-4
    label: string; // 'weak', 'fair', 'good', 'strong'
    color: string; // CSS color
  };
}

const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
};

/**
 * Hook to fetch and use organization password policy
 * 
 * @param organizationId - Organization ID to fetch policy for
 * @returns Password policy and validation function
 * 
 * @example
 * ```tsx
 * const { policy, validatePassword, loading } = usePasswordPolicy(organizationId);
 * 
 * const result = validatePassword('MyPassword123!');
 * if (!result.isValid) {
 *   console.error(result.errors);
 * }
 * ```
 */
export function usePasswordPolicy(organizationId?: string) {
  const [policy, setPolicy] = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setPolicy(DEFAULT_PASSWORD_POLICY);
      setLoading(false);
      return;
    }

    const fetchPolicy = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('organization_configurations')
          .select('auth_policy')
          .eq('organization_id', organizationId)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        if (data?.auth_policy?.passwordPolicy) {
          const dbPolicy = data.auth_policy.passwordPolicy;
          setPolicy({
            minLength: dbPolicy.minLength || DEFAULT_PASSWORD_POLICY.minLength,
            requireUppercase: dbPolicy.requireUppercase ?? DEFAULT_PASSWORD_POLICY.requireUppercase,
            requireLowercase: dbPolicy.requireLowercase ?? DEFAULT_PASSWORD_POLICY.requireLowercase,
            requireNumbers: dbPolicy.requireNumbers ?? DEFAULT_PASSWORD_POLICY.requireNumbers,
            requireSpecialChars: dbPolicy.requireSpecialChars ?? DEFAULT_PASSWORD_POLICY.requireSpecialChars,
          });
        } else {
          setPolicy(DEFAULT_PASSWORD_POLICY);
        }
      } catch (err) {
        logger.error('Failed to fetch password policy', err as Error, {
          organizationId,
        });
        setError(err as Error);
        // Fall back to default policy on error
        setPolicy(DEFAULT_PASSWORD_POLICY);
      } finally {
        setLoading(false);
      }
    };

    fetchPolicy();
  }, [organizationId]);

  /**
   * Validate password against organization policy
   */
  const validatePassword = useMemo(() => {
    return (password: string): PasswordValidationResult => {
      const errors: string[] = [];

      // Check minimum length
      if (password.length < policy.minLength) {
        errors.push(`Password must be at least ${policy.minLength} characters long`);
      }

      // Check uppercase requirement
      if (policy.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }

      // Check lowercase requirement
      if (policy.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }

      // Check numbers requirement
      if (policy.requireNumbers && !/\d/.test(password)) {
        errors.push('Password must contain at least one number');
      }

      // Check special characters requirement
      if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
      }

      // Calculate strength score
      const strength = calculatePasswordStrength(password, policy);

      return {
        isValid: errors.length === 0,
        errors,
        strength,
      };
    };
  }, [policy]);

  return {
    policy,
    validatePassword,
    loading,
    error,
  };
}

/**
 * Calculate password strength score
 */
function calculatePasswordStrength(
  password: string,
  policy: PasswordPolicy
): PasswordValidationResult['strength'] {
  let score = 0;

  // Length score (0-2 points)
  if (password.length >= policy.minLength) score += 1;
  if (password.length >= policy.minLength + 4) score += 1;

  // Character variety score (0-4 points)
  if (/[a-z]/.test(password)) score += 0.5;
  if (/[A-Z]/.test(password)) score += 0.5;
  if (/\d/.test(password)) score += 0.5;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 0.5;

  // Normalize to 0-4 scale
  score = Math.min(4, Math.round(score));

  // Determine label and color
  let label: string;
  let color: string;

  if (score === 0 || score === 1) {
    label = 'weak';
    color = 'red';
  } else if (score === 2) {
    label = 'fair';
    color = 'orange';
  } else if (score === 3) {
    label = 'good';
    color = 'yellow';
  } else {
    label = 'strong';
    color = 'green';
  }

  return { score, label, color };
}

/**
 * Hook to get password policy requirements as human-readable list
 */
export function usePasswordPolicyRequirements(organizationId?: string) {
  const { policy, loading } = usePasswordPolicy(organizationId);

  const requirements = useMemo(() => {
    const reqs: string[] = [];

    reqs.push(`At least ${policy.minLength} characters`);
    
    if (policy.requireUppercase) {
      reqs.push('At least one uppercase letter (A-Z)');
    }
    
    if (policy.requireLowercase) {
      reqs.push('At least one lowercase letter (a-z)');
    }
    
    if (policy.requireNumbers) {
      reqs.push('At least one number (0-9)');
    }
    
    if (policy.requireSpecialChars) {
      reqs.push('At least one special character (!@#$%^&*...)');
    }

    return reqs;
  }, [policy]);

  return {
    requirements,
    policy,
    loading,
  };
}
