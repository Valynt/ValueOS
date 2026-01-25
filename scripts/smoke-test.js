import http from 'http';

const SERVICES = [
  { name: 'Backend', url: 'http://localhost:3001/health' },
  { name: 'Frontend', url: 'http://localhost:5173/' },
];

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

const MAX_RETRIES = 12; // 12 * 5s = 60s
const RETRY_INTERVAL = 5000;

async function checkService(service) {
  return new Promise((resolve) => {
    const req = http.get(service.url, (res) => {
      // Allow redirects (3xx) as success for frontend
      if (res.statusCode >= 200 && res.statusCode < 400) {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    req.on('error', (err) => {
      resolve(false);
    });

    req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSmokeTests() {
  console.log('Running smoke tests...');

  let allPassed = true;

  for (const service of SERVICES) {
    let passed = false;
    process.stdout.write(`Checking ${service.name}... `);

    for (let i = 0; i < MAX_RETRIES; i++) {
        passed = await checkService(service);
        if (passed) break;
        if (i < MAX_RETRIES - 1) {
            // Wait before retry
            await sleep(RETRY_INTERVAL);
        }
    }

    if (passed) {
        console.log(`${GREEN}UP${NC}`);
    } else {
        console.log(`${RED}DOWN${NC}`);
        allPassed = false;
    }
  }

  if (allPassed) {
    console.log(`${GREEN}All smoke tests passed!${NC}`);
    process.exit(0);
  } else {
    console.log(`${RED}Some smoke tests failed.${NC}`);
    process.exit(1);
  }
}

runSmokeTests();
