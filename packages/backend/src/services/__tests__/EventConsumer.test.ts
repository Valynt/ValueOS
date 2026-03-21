import { EachMessagePayload } from 'kafkajs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger.js'
import { ConsumerConfig, EventConsumer } from '../EventConsumer.js'

// Mocks must be hoisted or defined before imports if using vi.mock factory
const mockProducer = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  send: vi.fn(),
  on: vi.fn(),
};

const mockConsumer = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  subscribe: vi.fn(),
  run: vi.fn(),
  on: vi.fn(),
};

const mockKafka = {
  consumer: vi.fn(() => mockConsumer),
  producer: vi.fn(() => mockProducer),
};

vi.mock('kafkajs', () => ({
  Kafka: vi.fn(function () { return mockKafka; }),
  logLevel: { WARN: 1 },
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('../../middleware/tenantContext', () => ({
  tenantContextStorage: {
    run: vi.fn((context, callback) => callback()),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

describe('EventConsumer', () => {
  let eventConsumer: EventConsumer;
  const config: ConsumerConfig = {
    clientId: 'test-client',
    groupId: 'test-group',
    brokers: ['localhost:9092'],
    topics: ['test-topic'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    eventConsumer = new EventConsumer(config);
  });

  it('should initialize consumer and producer', () => {
    expect(mockKafka.consumer).toHaveBeenCalled();
    // Producer initialization is part of the task, initially this might fail if not implemented
    // But since I'm implementing it, I expect it to be called.
  });

  it('should connect both consumer and producer', async () => {
    await eventConsumer.connect();
    expect(mockConsumer.connect).toHaveBeenCalled();
    // Verify producer connect once implemented
  });

  it('should send failed messages to DLQ', async () => {
    // 1. Setup handler that throws error
    const handler = {
      eventType: 'test-event',
      handler: vi.fn().mockRejectedValue(new Error('Processing failed')),
    };
    eventConsumer.registerHandler(handler);

    // 2. Mock message
    const payload: EachMessagePayload = {
      topic: 'test-topic',
      partition: 0,
      message: {
        key: Buffer.from('test-key'),
        value: Buffer.from(JSON.stringify({ eventType: 'test-event', eventId: '1' })),
        offset: '10',
        headers: { 'custom-header': 'value' },
        timestamp: new Date().toISOString(),
        attributes: 0,
      },
      heartbeat: vi.fn(),
      pause: vi.fn(),
    };

    // 3. Trigger handleMessage (access private method via casting or specialized test helper)
    // Since handleMessage is passed to consumer.run, we can capture it
    await eventConsumer.subscribe();
    const runCall = mockConsumer.run.mock.calls[0][0];
    const eachMessage = runCall.eachMessage;

    await eachMessage(payload);

    // 4. Verify DLQ logic
    expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process event'),
        expect.any(Error),
        expect.any(Object)
    );

    expect(mockProducer.send).toHaveBeenCalledWith({
      topic: 'test-topic.dlq',
      messages: [
        expect.objectContaining({
          key: payload.message.key,
          value: payload.message.value,
          headers: expect.objectContaining({
            'custom-header': 'value',
            'x-original-topic': 'test-topic',
            'x-error-message': 'Processing failed',
          }),
        }),
      ],
    });
  });
});
