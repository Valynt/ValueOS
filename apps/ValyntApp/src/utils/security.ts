/**
 * Security utilities — thin re-export bridge.
 *
 * The canonical implementations live in `src/security/`. This file
 * re-exports the subset that legacy callers (e.g. UserSecurity.tsx)
 * import from `utils/security`. New code should import directly from
 * `@/security` instead.
 */

export {
  validatePassword,
  hashPassword,
  verifyPassword,
  type PasswordValidationResult,
} from "../security/PasswordValidator";

export { sanitizeInput } from "../security/InputSanitizer";

export { validateCSRFToken } from "../security/CSRFProtection";

export {
  getSecurityConfig,
  type SecurityConfig,
} from "../security/SecurityConfig";

/**
 * Convenience alias used by UserSecurity.tsx for inline password-policy
 * checks (e.g. `defaultPasswordPolicy.minLength`).
 */
export const defaultPasswordPolicy = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
} as const;
