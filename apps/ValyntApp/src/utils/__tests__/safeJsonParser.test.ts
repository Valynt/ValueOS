import { z } from 'zod';
import { describe, it, expect } from 'vitest';
import { parseLLMOutput } from '../safeJsonParser';

describe('safeJsonParser', () => {
  describe('repairJson', () => {
    it('should correctly replace single quotes with double quotes', async () => {
      const input = "{ 'key': 'value' }";
      const schema = z.object({ key: z.string() });

      const result = await parseLLMOutput(input, schema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ key: 'value' });
      }
    });

    it('should not replace single quotes inside double quotes', async () => {
      const input = '{ "message": "It\'s a beautiful day", "data": { "item": "Don\'t stop" } }';
      const schema = z.object({
        message: z.string(),
        data: z.object({
          item: z.string()
        })
      });

      const result = await parseLLMOutput(input, schema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ message: "It's a beautiful day", data: { item: "Don't stop" } });
      }
    });

    it('should handle a mix of single quotes and double quotes correctly', async () => {
      const input = "{ 'message': \"It's a beautiful day\" }";
      const schema = z.object({ message: z.string() });

      const result = await parseLLMOutput(input, schema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ message: "It's a beautiful day" });
      }
    });

    it('should handle nested single quotes correctly', async () => {
      const input = "{ 'items': ['apple', 'banana', 'cherry'] }";
      const schema = z.object({ items: z.array(z.string()) });

      const result = await parseLLMOutput(input, schema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ items: ['apple', 'banana', 'cherry'] });
      }
    });
  });
});
