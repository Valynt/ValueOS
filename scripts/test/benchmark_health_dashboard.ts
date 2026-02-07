
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { performance } from 'perf_hooks';

const filePath = path.join(process.cwd(), 'public', 'health-dashboard.html');

// Ensure file exists for benchmark
if (!fs.existsSync(filePath)) {
  console.log('Creating dummy file for benchmark...');
  if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  // Make it 50KB to simulate a real dashboard html
  fs.writeFileSync(filePath, 'x'.repeat(50 * 1024));
} else {
    console.log(`Using existing file: ${filePath}`);
}

const ITERATIONS = 1000;

async function benchmark() {
    console.log(`\nStarting benchmark with ${ITERATIONS} iterations...`);
    console.log('This benchmark compares Blocking I/O (fs.readFileSync) vs Non-Blocking I/O (fs.promises.readFile).');
    console.log('The optimization replaces blocking code with res.sendFile() which utilizes non-blocking I/O internally.');

    // --- SYNC TEST ---
    console.log('\n--- SYNC (Current Implementation: fs.readFileSync) ---');
    console.log('Simulating multiple concurrent requests hitting the blocking endpoint.');

    let syncTimerFired = false;
    let syncTimerDelay = 0;

    const syncStart = performance.now();

    // Schedule a timer to measure event loop blocking
    const timerStart = performance.now();
    setTimeout(() => {
        syncTimerFired = true;
        syncTimerDelay = performance.now() - timerStart;
    }, 5);

    // Run blocking operations
    for (let i = 0; i < ITERATIONS; i++) {
        fs.readFileSync(filePath, 'utf8');
    }

    const syncEnd = performance.now();
    const syncDuration = syncEnd - syncStart;

    // Wait for timer if it hasn't fired (it definitely hasn't if blocked)
    if (!syncTimerFired) {
        await new Promise<void>(resolve => {
             const check = setInterval(() => {
                 if (syncTimerFired) {
                     clearInterval(check);
                     resolve();
                 }
             }, 1);
        });
    }

    console.log(`Total Processing Time: ${syncDuration.toFixed(2)}ms`);
    console.log(`Event Loop Lag (Timer set for 5ms): ${syncTimerDelay.toFixed(2)}ms`);
    if (syncTimerDelay >= syncDuration) {
        console.log('❌ EVENT LOOP BLOCKED: Timer fired after all operations completed. This causes the server to freeze for all other requests.');
    } else {
        console.log('✅ Event loop not fully blocked.');
    }


    // Cool down
    await new Promise(resolve => setTimeout(resolve, 500));


    // --- ASYNC TEST ---
    console.log('\n--- ASYNC (Optimized: res.sendFile / fs.promises.readFile) ---');
    console.log('Simulating multiple concurrent requests handled asynchronously.');

    let asyncTimerFired = false;
    let asyncTimerDelay = 0;

    const asyncStart = performance.now();

    const asyncTimerStart = performance.now();
    setTimeout(() => {
        asyncTimerFired = true;
        asyncTimerDelay = performance.now() - asyncTimerStart;
    }, 5);

    const promises = [];
    for (let i = 0; i < ITERATIONS; i++) {
        promises.push(fsPromises.readFile(filePath, 'utf8'));
    }

    await Promise.all(promises);

    const asyncEnd = performance.now();
    const asyncDuration = asyncEnd - asyncStart;

     // Wait for timer if it hasn't fired
    if (!asyncTimerFired) {
        await new Promise<void>(resolve => {
             const check = setInterval(() => {
                 if (asyncTimerFired) {
                     clearInterval(check);
                     resolve();
                 }
             }, 1);
        });
    }

    console.log(`Total Processing Time: ${asyncDuration.toFixed(2)}ms`);
    console.log(`Event Loop Lag (Timer set for 5ms): ${asyncTimerDelay.toFixed(2)}ms`);

    if (asyncTimerDelay < asyncDuration) {
         console.log('✅ EVENT LOOP UNBLOCKED: Timer fired while operations were pending. The server remained responsive to other requests.');
    } else {
         console.log('❌ Event loop blocked?');
    }
}

benchmark().catch(console.error);
