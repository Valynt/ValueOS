import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseLLMOutput } from '../safeJsonParser';

describe('safeJsonParser', () => {
  describe('repairJson', () => {
    it('should replace single quotes with double quotes correctly', async () => {
      const schema = z.object({
        key: z.string()
      });
      // Test that 'value' becomes "value" and 'key' becomes "key"
      // Also it shouldn't replace a single quote inside a double-quoted string
      const input = "{'key': 'value'}";
      const result = await parseLLMOutput(input, schema);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
    });

    it('should not break single quotes inside valid double quotes', async () => {
      const schema = z.object({
        key: z.string()
      });
      // The word don't has a single quote inside a double quoted string.
      // Prior implementation would replace ' with " and break JSON.
      const input = '{"key": "don\'t do that"}';
      const result = await parseLLMOutput(input, schema);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: "don't do that" });
    });

    it('should fix missing commas between objects in arrays', async () => {
      const schema = z.array(z.object({
        a: z.number().optional(),
        b: z.number().optional()
      }));
      // Missing comma between the two objects
      const input = '[{"a": 1} {"b": 2}]';
      const result = await parseLLMOutput(input, schema);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ a: 1 }, { b: 2 }]);
    });

    it('should fix undefined values to null', async () => {
      const schema = z.object({
        key: z.null()
      });
      // undefined should be converted to null
      const input = '{"key": undefined}';
      const result = await parseLLMOutput(input, schema);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: null });
    });
  });
});
