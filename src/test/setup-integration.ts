import { beforeAll, afterAll } from 'vitest';
import { setup, teardown } from './testcontainers-global-setup';

// Increase timeout for Docker operations (pulling images can take time)
const DOCKER_TIMEOUT = 120_000;

beforeAll(async () => {
  await setup();
}, DOCKER_TIMEOUT);

afterAll(async () => {
  await teardown();
});
