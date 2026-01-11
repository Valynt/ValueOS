
import { describe, it, expect } from 'vitest';
import { parseJSONFromLLM } from '../SafeJSONParser';

describe('SafeJSONParser', () => {
  it('should parse valid JSON', async () => {
    const json = '{"key": "value"}';
    const result = await parseJSONFromLLM(json);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ key: 'value' });
  });

  it('should handle single quotes escaped in JSON string', async () => {
    // LLM output: {"key": "It\'s fine"}
    const json = '{"key": "It\\\'s fine"}';
    const result = await parseJSONFromLLM(json);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ key: "It's fine" });
  });

  it('should handle unescaped backslashes in regex patterns (common LLM issue)', async () => {
    // LLM output: {"pattern": "\d+"}
    const json = '{"pattern": "\\d+"}';
    const result = await parseJSONFromLLM(json);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ pattern: '\\d+' });
  });

  it('should handle unescaped backslashes in file paths', async () => {
    // LLM output: {"path": "C:\Windows"}
    const json = '{"path": "C:\\Windows"}';
    const result = await parseJSONFromLLM(json);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ path: 'C:\\Windows' });
  });

  // Regression test
  it('should NOT corrupt valid escaped backslashes', async () => {
    // Valid JSON: {"pattern": "\\d"} -> content is \d
    const json = '{"pattern": "\\\\d"}';
    // In JS string '\\\\d' means two backslashes then d.
    // JSON.parse('{"pattern": "\\\\d"}') -> {pattern: "\d"}

    const result = await parseJSONFromLLM(json);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ pattern: '\\d' });
  });

  // Test specifically for \u issue (not valid unicode escape)
  it('should handle invalid unicode escapes like \\Users', async () => {
    // LLM output: {"path": "C:\Users"}
    // JS string: '{"path": "C:\\Users"}'
    const json = '{"path": "C:\\Users"}';
    const result = await parseJSONFromLLM(json);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ path: 'C:\\Users' });
  });

  // Test for incomplete unicode escape
  it('should handle incomplete unicode escapes', async () => {
    const json = '{"val": "\\u123"}';
    const result = await parseJSONFromLLM(json);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ val: '\\u123' });
  });
});
