/* eslint-disable no-console */

import { performance } from 'perf_hooks';

// Mock environment variables needed for Supabase client
process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJh...'; // Fake key
process.env.VITE_SUPABASE_ANON_KEY = 'eyJh...'; // Fake key

async function runBenchmark() {
  const iterations = 1000;
  console.log(`Running benchmark with ${iterations} iterations...`);

  // --- Baseline: Dynamic Import + Create Client ---
  const startBaseline = performance.now();
  for (let i = 0; i < iterations; i++) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    // Simulate usage (accessing a property)
    const _ = supabase.from;
  }
  const endBaseline = performance.now();
  const baselineDuration = endBaseline - startBaseline;
  console.log(`Baseline (Dynamic Import + Create): ${baselineDuration.toFixed(2)}ms`);
  console.log(`Average per op: ${(baselineDuration / iterations).toFixed(4)}ms`);


  // --- Optimized: Singleton / Shared Client ---
  // Note: We are simulating the "singleton" by creating it once outside the loop.
  // In the real fix, we import a function that returns a pre-configured client.

  const { createClient } = await import('@supabase/supabase-js');
  const startOptimized = performance.now();

  // Create once
  const sharedSupabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  for (let i = 0; i < iterations; i++) {
    // Simulate usage
    const _ = sharedSupabase.from;
  }
  const endOptimized = performance.now();
  const optimizedDuration = endOptimized - startOptimized;
  console.log(`Optimized (Singleton): ${optimizedDuration.toFixed(2)}ms`);
  console.log(`Average per op: ${(optimizedDuration / iterations).toFixed(4)}ms`);

  const improvement = baselineDuration / optimizedDuration;
  console.log(`Speedup: ${improvement.toFixed(2)}x`);
}

runBenchmark().catch(console.error);
