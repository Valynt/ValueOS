import config from '../../vitest.config';
import { fileURLToPath } from 'url';
import path from 'path';

console.log('💨 Running Smoke Test on Package Exports...');

async function smokeTest() {
  const resolvedConfig = await (typeof config === 'function' ? config({}) : config);
  const aliases = resolvedConfig.resolve?.alias || {};
  
  const packagesToCheck = Object.keys(aliases).filter(key => {
    return key.startsWith('@valueos') || 
           ['@shared', '@backend', '@infra', '@memory', '@agents', '@integrations', '@mcp', '@sdui'].includes(key);
  });

  console.log(`Checking imports for: ${packagesToCheck.join(', ')}`);

  let failures = 0;

  for (const pkg of packagesToCheck) {
    try {
      console.log(`📦 Importing ${pkg}...`);
      await import(pkg);
      console.log(`✅ Success: ${pkg}`);
    } catch (e: any) {
      console.error(`❌ FAILED: ${pkg}`);
      console.error(e.message);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`\n💥 ${failures} packages failed to import.`);
    process.exit(1);
  } else {
    console.log('\n✨ All checked packages pass smoke test!');
  }
}

smokeTest();
