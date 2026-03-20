import { LLMCache } from '../src/services/llm/LLMCache.js';
import { performance } from 'perf_hooks';

async function run() {
  const cache = new LLMCache({ enabled: true, keyPrefix: 'test:' });
  // Mock 'connected'
  (cache as any).connected = true;

  // Mock 'get' and 'set'
  cache.get = async () => null;
  cache.set = async () => {};

  const prompts = Array.from({ length: 50 }, (_, i) => ({
    prompt: `Prompt ${i}`,
    model: 'gpt-4'
  }));

  const llmCaller = async () => {
    // simulate network delay
    await new Promise(resolve => setTimeout(resolve, 20));
    return 'response';
  };

  const start = performance.now();
  await cache.warmCache(prompts, llmCaller);
  const end = performance.now();

  console.log(`Cache warming took: ${end - start}ms`);
  process.exit(0);
}

run().catch(console.error);
