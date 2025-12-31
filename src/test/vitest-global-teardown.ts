import { teardown } from './testcontainers-global-setup';

export default async function () {
  await teardown();
}
