export class Kafka {
  producer() {
    return {
      connect: async () => undefined,
      disconnect: async () => undefined,
      send: async () => undefined,
      on: () => undefined,
    };
  }
}

export const CompressionTypes = {
  GZIP: 0,
} as const;

export const logLevel = {
  WARN: 0,
} as const;
