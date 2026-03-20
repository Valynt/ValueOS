import { describe, it, expect } from 'vitest';
import { parseLLMOutput } from '../safeJsonParser';
import { z } from 'zod';

describe('safeJsonParser', () => {
  it('should fix missing commas between properties', async () => {
    const rawContent = `
    {
      "key1": "value1"
      "key2": "value2"
      "array": [
        "item1"
        "item2"
      ]
      "obj1": { "a": 1 }
      "obj2": { "b": 2 }
    }
    `;

    // We only care if it parses successfully without throwing JSON errors
    const schema = z.any();
    const result = await parseLLMOutput(rawContent, schema);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      key1: "value1",
      key2: "value2",
      array: ["item1", "item2"],
      obj1: { a: 1 },
      obj2: { b: 2 }
    });
  });

  it('should handle the specific case in the description', async () => {
    // Description context:
    // // Fix missing commas between properties
    // // this regex tries to find a closing brace/bracket followed by an opening one without a comma
    // repaired = repaired.replace(/([\}\]])\s*([\{\["])/g, '$1,$2');

    const rawContent = `
    [
      { "id": 1 }
      { "id": 2 }
    ]
    `;

    const schema = z.any();
    const result = await parseLLMOutput(rawContent, schema);

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
