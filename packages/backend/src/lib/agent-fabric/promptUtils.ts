/**
 * Prompt template utilities for agent-fabric agents.
 *
 * Uses a lightweight {{key}} substitution syntax consistent with Handlebars
 * without requiring the Handlebars runtime dependency. Migrate to Handlebars
 * if conditional blocks or partials are needed.
 */

import { llmSanitizer } from '../../services/llm/LLMSanitizer.js';

interface RenderTemplateOptions {
  allowedVariables?: readonly string[];
  untrustedVariables?: readonly string[];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Render a prompt template by replacing `{{ key }}` placeholders with values.
 * Unknown keys are left as-is. Values are coerced to strings.
 */
export function renderTemplate(
  template: string,
  values: Record<string, string>,
  options: RenderTemplateOptions = {},
): string {
  const allowedVariables = options.allowedVariables
    ? new Set(options.allowedVariables)
    : null;
  const untrustedVariables = new Set(options.untrustedVariables ?? []);

  return Object.entries(values).reduce(
    (result, [key, value]) => {
      if (allowedVariables && !allowedVariables.has(key)) {
        return result;
      }

      const sanitizedValue = llmSanitizer.sanitizePrompt(value).content;
      const safeValue = untrustedVariables.has(key)
        ? llmSanitizer.applyXmlSandbox(sanitizedValue)
        : sanitizedValue;

      return (
      // Escape $ in replacement values — String.replace() treats $& $$ $1 etc. as special.
      result.replace(
        new RegExp(`{{\\s*${escapeRegex(key)}\\s*}}`, 'g'),
        safeValue.replace(/\$/g, '$$$$'),
      )
      );
    },
    template,
  );
}
