import { performance } from 'perf_hooks';

// Setup mock
const mockSendNotification = async (alert, channel) => {
    // simulate network latency
    await new Promise(resolve => setTimeout(resolve, 50));
};

async function testSequential() {
    const channels = ['email', 'webhook', 'log', 'sms', 'slack'];
    const alert = { id: 'test' };

    const start = performance.now();
    for (const channel of channels) {
      try {
        await mockSendNotification(alert, channel);
      } catch (error) {
        console.error(error);
      }
    }
    const end = performance.now();
    return end - start;
}

async function testParallel() {
    const channels = ['email', 'webhook', 'log', 'sms', 'slack'];
    const alert = { id: 'test' };

    const start = performance.now();
    await Promise.allSettled(
      channels.map(async (channel) => {
        try {
          await mockSendNotification(alert, channel);
        } catch (error) {
          console.error(error);
        }
      })
    );
    const end = performance.now();
    return end - start;
}

async function run() {
    const seq = await testSequential();
    const par = await testParallel();
    console.log(`Sequential: ${seq.toFixed(2)}ms`);
    console.log(`Parallel: ${par.toFixed(2)}ms`);
}

run();
