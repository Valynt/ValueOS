/* eslint-disable react/no-danger -- SEC-002: sole sanctioned dangerouslySetInnerHTML surface; all input passes through DOMPurify */
import { sanitizeHtml } from '../../utils/sanitizeHtml';

type SafeHtmlProps = {
  html: string;
  className?: string;
};

/**
 * SEC-002: The only permitted dangerouslySetInnerHTML surface in the codebase.
 *
 * All agent output, user-generated content, and rich text MUST be rendered
 * through this component. Direct use of dangerouslySetInnerHTML anywhere else
 * is a lint error that fails CI.
 *
 * Sanitization is handled by DOMPurify with an explicit allowlist — no bypass
 * flags, no conditional sanitization, no trusted-input shortcuts.
 */
export function SafeHtml({ html, className }: SafeHtmlProps) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
