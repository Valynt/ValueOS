/**
 * Prompt template utilities for agent-fabric agents.
 *
 * Uses a lightweight {{key}} substitution syntax consistent with Handlebars
 * without requiring the Handlebars runtime dependency. Migrate to Handlebars
 * if conditional blocks or partials are needed.
 */

import { llmSanitizer } from "../../services/llm/LLMSanitizer.js";

/**
 * Escape untrusted interpolation content by sanitizing and XML-sandboxing it.
 */
export function escapePromptInterpolation(value: unknown): string {
  const sanitized = llmSanitizer.sanitizePrompt(String(value ?? ""));
  return llmSanitizer.applyXmlSandbox(sanitized.content);
}

/**
 * Render a prompt template by replacing `{{ key }}` placeholders with values.
 * Unknown keys are left as-is. Values are coerced to strings.
 */
export function renderTemplate(
  template: string,
  values: Record<string, string>,
  options: { allowlist?: readonly string[]; escapeUntrusted?: boolean } = {}
): string {
  const allowed = options.allowlist ? new Set(options.allowlist) : null;

  return Object.entries(values).reduce((result, [key, value]) => {
    if (allowed && !allowed.has(key)) {
      return result;
    }

    const replacement =
      options.escapeUntrusted === false
        ? value
        : escapePromptInterpolation(value);

    // Escape $ in replacement values — String.replace() treats $& $$ $1 etc. as special.
    return result.replace(
      new RegExp(`{{\\s*${key}\\s*}}`, "g"),
      replacement.replace(/\$/g, "$$$$")
    );
  }, template);
}
