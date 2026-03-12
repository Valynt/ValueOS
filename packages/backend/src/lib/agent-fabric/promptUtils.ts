/**
 * Prompt template utilities for agent-fabric agents.
 *
 * Uses a lightweight {{key}} substitution syntax consistent with Handlebars
 * without requiring the Handlebars runtime dependency. Migrate to Handlebars
 * if conditional blocks or partials are needed.
 */

/**
 * Render a prompt template by replacing `{{ key }}` placeholders with values.
 * Unknown keys are left as-is. Values are coerced to strings.
 */
export function renderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) =>
      // Escape $ in replacement values — String.replace() treats $& $$ $1 etc. as special.
      result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value.replace(/\$/g, '$$$$')),
    template,
  );
}
