/**
 * Classname Utility
 *
 * Utility function for combining CSS class names.
 * Replaces external dependencies like clsx.
 */

export type ClassValue = string | number | boolean | undefined | null;
export type ClassArray = ClassValue[];
export type ClassObject = Record<string, boolean | undefined | null>;

export function cn(...inputs: (ClassValue | ClassArray)[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === "string" || typeof input === "number") {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) classes.push(nested);
    } else if (typeof input === "object") {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }

  return classes.join(" ");
}
