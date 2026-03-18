import React from 'react';

import { sanitizeHtml } from '../../utils/sanitizeHtml';

interface SafeHtmlProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * SEC-002: Centralized, sanitized HTML rendering surface.
 */
export function SafeHtml({ html, className, style }: SafeHtmlProps) {
  return (
    <div
      className={className}
      style={style}
      // eslint-disable-next-line react/no-danger -- sanitized content
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}

