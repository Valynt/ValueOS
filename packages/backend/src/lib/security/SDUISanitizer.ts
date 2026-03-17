/**
 * SDUI Sanitizer
 */

export class SDUISanitizer {
  sanitize(input: unknown): unknown {
    if (typeof input === 'string') {
      return input.replace(/<script/gi, '&lt;script');
    }
    return input;
  }
}

export const sduiSanitizer = new SDUISanitizer();
