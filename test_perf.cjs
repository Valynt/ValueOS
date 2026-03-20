const { execSync } = require('child_process');
const fs = require('fs');

async function measure() {
  const result = execSync('./node_modules/.bin/vitest run packages/backend/src/security/__benchmarks__/RedisSessionStore.benchmark.test.ts', { encoding: 'utf-8' });

  const userMatch = result.match(/invalidateUserSessions took: ([\d.]+) ms/);
  const deviceMatch = result.match(/invalidateDeviceSessions took: ([\d.]+) ms/);

  return {
    user: parseFloat(userMatch[1]),
    device: parseFloat(deviceMatch[1])
  };
}

async function runMany() {
  let userTotal = 0;
  let deviceTotal = 0;

  for(let i=0; i<5; i++) {
    const res = await measure();
    userTotal += res.user;
    deviceTotal += res.device;
  }

  console.log(`Average user invalidation: ${(userTotal/5).toFixed(2)} ms`);
  console.log(`Average device invalidation: ${(deviceTotal/5).toFixed(2)} ms`);
}

runMany();
