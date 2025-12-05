#!/usr/bin/env ts-node

import { runBiasProbes } from '../src/security/bias-probes/BiasProbeRunner.js';

async function main() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const summary = await runBiasProbes(controller.signal);
    console.log(summary.report);

    if (summary.variance > 5) {
      console.error(`Fairness variance ${summary.variance}% exceeds threshold (5%). Failing build.`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Bias probes failed:', error);
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }
}

main();