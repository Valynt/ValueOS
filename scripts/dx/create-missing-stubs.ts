#!/usr/bin/env tsx
/**
 * Missing Module Stub Creator
 * 
 * DISABLED BY DEFAULT - fails hard instead of creating stubs.
 * This prevents masking broken imports with stub files.
 * 
 * To enable (not recommended): export DX_AUTOSTUB=1
 * 
 * Real fix: add barrel exports + compat re-exports at canonical paths,
 * don't create stubs across 200 files.
 */

import fs from 'fs';
import path from 'path';

// Fail-hard by design - no stubs allowed
console.error('❌ Stub generation is PERMANENTLY DISABLED.');
console.error('');
console.error('Stubs hide broken imports and create more problems.');
console.error('');
console.error('If you see "cannot find module" errors, fix them properly:');
console.error('');
console.error('  1️⃣  Create the ACTUAL FILE with real implementation');
console.error('  2️⃣  Or create barrel exports at canonical paths');
console.error('  3️⃣  Or add compat re-exports for legacy import paths');
console.error('');
console.error('✅ See docs/DX_IMPORT_STRATEGY.md for detailed guidance.');
console.error('');
console.error('NO environment override - stubs are never acceptable.');
process.exit(1);

// Known missing modules - populated from validation scan
const missingModules = [
  'packages/backend/src/middleware/services/RateLimitKeyService.ts',
  'packages/backend/src/middleware/services/MLAnomalyDetectionService.ts',
  'packages/backend/src/middleware/services/DistributedAttackDetectionService.ts',
  'packages/backend/src/middleware/services/RateLimitEscalationService.ts',
  'packages/backend/src/middleware/services/AdvancedThreatDetectionService.ts',
  'packages/backend/src/middleware/services/AuditLogService.ts',
  'packages/backend/src/middleware/services/ChaosEngineering.ts',
  'packages/backend/src/middleware/services/consentRegistry.ts',
  'packages/backend/src/middleware/services/FeatureFlags.ts',
  'packages/backend/src/middleware/services/metering/UsageEmitter.ts',
  'packages/backend/src/middleware/config/billing.ts',
  'packages/backend/src/middleware/config/autonomy.ts',
  'packages/backend/src/api/services/CustomerAccessService.ts',
  'packages/backend/src/api/services/billing/InvoiceService.ts',
  'packages/backend/src/api/services/billing/CustomerService.ts',
  'packages/backend/src/api/services/billing/WebhookService.ts',
  'packages/backend/src/api/services/metering/MetricsCollector.ts',
  'packages/backend/src/api/services/metering/UsageCache.ts',
  'packages/backend/src/api/services/metering/GracePeriodService.ts',
  'packages/backend/src/api/config/billing.ts',
  'packages/backend/src/api/config/validateEnv.ts',
  'packages/backend/src/api/config/environment.ts',
  'packages/backend/src/config/billing.ts',
  'packages/backend/src/config/database.ts',
  'packages/backend/src/types/health.ts',
  'packages/backend/src/types/billing.ts',
  'packages/backend/src/types/consent.ts',
  'packages/backend/src/types/vos.ts',
  'packages/backend/src/types/workflow.ts',
  'packages/backend/src/types/intent.ts',
  'packages/backend/src/types/execution.ts',
  'packages/backend/src/types/agent.ts',
  'packages/backend/src/types/sdui-integration.ts',
  'packages/backend/src/types/agent-output.ts',
  'packages/backend/src/types/workflow-sdui.ts',
  'packages/backend/src/lib/redis.ts',
  'packages/backend/src/lib/env.ts',
  'packages/backend/src/lib/sentry.ts',
  'packages/backend/src/lib/agent-fabric/CircuitBreaker.ts',
  'packages/backend/src/lib/agent-fabric/LLMGateway.ts',
  'packages/backend/src/lib/agent-fabric/ContextFabric.ts',
  'packages/backend/src/lib/agent-fabric/MemorySystem.ts',
  'packages/backend/src/lib/agent-fabric/ExternalAPIAdapter.ts',
  'packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts',
  'packages/backend/src/lib/agent-fabric/SecureMessageBus.ts',
  'packages/backend/src/lib/agent-fabric/ServiceMessageBusAdapter.ts',
  'packages/backend/src/lib/auth/AgentIdentity.ts',
  'packages/backend/src/lib/llm-gating/types.ts',
  'packages/backend/src/lib/llm/secureLLMWrapper.ts',
  'packages/backend/src/lib/rules.ts',
  'packages/backend/src/lib/resilience/errors.ts',
  'packages/backend/src/repositories/WorkflowStateRepository.ts',
  'packages/backend/src/data/industryTemplates.ts',
  'packages/backend/src/metrics/billingMetrics.ts',
  'packages/backend/src/services/metering/UsageEmitter.ts',
  'packages/backend/src/test-utils/auth.helpers.ts',
  'packages/backend/src/test-utils/auth.fixtures.ts',
  'packages/backend/src/utils/export.ts',
  'packages/backend/src/SemanticMemory.ts',
];

function createStubFile(filePath: string) {
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath);
  const moduleName = fileName.replace(/\.(ts|tsx)$/, '');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
  
  // Skip if already exists
  if (fs.existsSync(filePath)) {
    return;
  }
  
  // Create minimal stub
  const stub = `/**
 * Auto-generated stub for missing module: ${moduleName}
 * 
 * This is a temporary stub to allow the application to start.
 * TODO: Implement proper ${moduleName} functionality
 */

export default class ${moduleName} {
  // Stub implementation
}

export const create${moduleName} = () => new ${moduleName}();
`;

  fs.writeFileSync(filePath, stub, 'utf-8');
  console.log(`✅ Created stub: ${path.relative(process.cwd(), filePath)}`);
}

async function main() {
  console.log('🔧 Missing Module Stub Creator\n');
  
  let created = 0;
  let skipped = 0;
  
  for (const modulePath of missingModules) {
    const fullPath = path.resolve(process.cwd(), modulePath);
    
    if (fs.existsSync(fullPath)) {
      skipped++;
    } else {
      createStubFile(fullPath);
      created++;
    }
  }
  
  console.log(`\n📊 Results:`);
  console.log(`✅ Created ${created} stub files`);
  console.log(`⏭️  Skipped ${skipped} files (already exist)\n`);
  console.log(`⚠️  These are temporary stubs. Replace with real implementations!`);
}

main().catch(console.error);
