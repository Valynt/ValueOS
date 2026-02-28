import { describe, expect, it } from 'vitest';
import { MessageBus } from '../MessageBus.js';

describe('MessageBus', () => {
  describe('expandMessage', () => {
    it('returns original payload when not compressed', () => {
      const bus = new MessageBus();
      const payload = { foo: 'bar' };
      expect(bus.expandMessage(payload)).toEqual(payload);
    });

    it('decompresses a previously compressed payload', () => {
      const bus = new MessageBus();
      const original = { key: 'value', nested: [1, 2, 3] };
      const compressed = bus.compressMessage(original);

      expect(compressed.__compressed).toBe(true);

      const expanded = bus.expandMessage(compressed);
      expect(expanded).toEqual(original);
    });

    it('returns original payload when decompress returns null (corrupt data)', () => {
      const bus = new MessageBus();
      const badPayload = { __compressed: true, data: 'not-valid-lz-data' };

      // Should not throw; should return the original payload unchanged
      const result = bus.expandMessage(badPayload);
      expect(result).toEqual(badPayload);
    });
  });

  describe('compressMessage / expandMessage round-trip', () => {
    it('handles empty objects', () => {
      const bus = new MessageBus();
      const compressed = bus.compressMessage({});
      const expanded = bus.expandMessage(compressed);
      expect(expanded).toEqual({});
    });

    it('handles strings with special characters', () => {
      const bus = new MessageBus();
      const original = { text: "Hello 'world' \"quotes\" & <tags>" };
      const compressed = bus.compressMessage(original);
      const expanded = bus.expandMessage(compressed);
      expect(expanded).toEqual(original);
    });

    it('handles large payloads', () => {
      const bus = new MessageBus();
      const original = { data: 'x'.repeat(5000) };
      const compressed = bus.compressMessage(original);
      expect(compressed.__compressed).toBe(true);
      const expanded = bus.expandMessage(compressed);
      expect(expanded).toEqual(original);
    });
  });
});
