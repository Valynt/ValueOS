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
    const aliasPath = aliases[pkg];
    try {
      console.log(`📦 Importing ${pkg} from ${aliasPath}...`);
      // Use resolved path. If it's a directory, adding /index.ts might be safer for specific resolution
      // but let's try the path first so tsx can use its resolution logic.
      await import(aliasPath);
      console.log(`✅ Success: ${pkg}`);
    } catch (e: any) {
        // Retry with /index.ts if it looks like a directory import failure
        if (e.code === 'ERR_UNSUPPORTED_DIR_IMPORT') {
             try {
                 await import(path.join(aliasPath, 'index.ts'));
                 console.log(`✅ Success (with index.ts): ${pkg}`);
                 continue;
             } catch (e2: any) {
                 console.error(`❌ FAILED (retry): ${pkg}`);
                 console.error(e2.message);
                 failures++;
                 continue;
             }
        }

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
