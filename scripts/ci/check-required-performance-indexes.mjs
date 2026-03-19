#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
const MIGRATIONS_DIR = resolve(ROOT, 'infra/supabase/supabase/migrations');

const REQUIRED_INDEXES = [
  {
    name: 'idx_usage_events_unprocessed_timestamp',
    table: 'usage_events',
    source: '20260331050000_transaction_hot_path_indexes.sql',
    queryShape: 'WHERE processed = false ORDER BY timestamp ASC LIMIT N',
    services: [
      'UsageAggregator',
      'MetricsCollector',
      'UsageQueueConsumerWorker',
    ],
  },
  {
    name: 'idx_workflow_executions_org_active_created',
    table: 'workflow_executions',
    source: '20260331050000_transaction_hot_path_indexes.sql',
    queryShape: 'WHERE organization_id = $1 AND status IN (pending, in_progress, waiting_approval) ORDER BY created_at DESC',
    services: [
      'HumanCheckpointService',
      'WorkflowDAGIntegration',
      'WorkflowExecutionStore',
      'WorkflowExecutor',
    ],
  },
  {
    name: 'idx_workflow_execution_logs_org_execution_created',
    table: 'workflow_execution_logs',
    source: '20260331050000_transaction_hot_path_indexes.sql',
    queryShape: 'WHERE organization_id = $1 AND execution_id = $2 ORDER BY created_at ASC',
    services: [
      'WorkflowExecutionStore',
      'WorkflowCompensation',
    ],
  },
  {
    name: 'idx_semantic_memory_embedding_hnsw',
    table: 'semantic_memory',
    source: '20260322000000_persistent_memory_tables.sql',
    queryShape: 'ORDER BY embedding <=> query_embedding LIMIT N',
    services: [
      'SupabaseVectorStore',
      'SupabaseSemanticStore',
      'VectorSearchService',
    ],
  },
  {
    name: 'idx_semantic_memory_org_created_at',
    table: 'semantic_memory',
    source: '20260331051000_semantic_memory_hot_path_indexes.sql',
    queryShape: 'WHERE organization_id = $1 ORDER BY created_at DESC',
    services: [
      'SupabaseSemanticStore',
      'SemanticMemoryService',
      'get_semantic_memory_stats',
    ],
  },
  {
    name: 'idx_semantic_memory_org_type_created_at',
    table: 'semantic_memory',
    source: '20260331051000_semantic_memory_hot_path_indexes.sql',
    queryShape: 'WHERE organization_id = $1 AND type = $2 ORDER BY created_at DESC',
    services: [
      'SupabaseSemanticStore',
      'SemanticMemoryService',
      'SupabaseVectorStore',
    ],
  },
  {
    name: 'idx_semantic_memory_org_artifact_id',
    table: 'semantic_memory',
    source: '20260331051000_semantic_memory_hot_path_indexes.sql',
    queryShape: "WHERE organization_id = $1 AND metadata->>'artifact_id' = $2",
    services: [
      'SupabaseVectorStore.deleteByArtifactId',
    ],
  },
  {
    name: 'idx_semantic_memory_org_tenant_context_created_at',
    table: 'semantic_memory',
    source: '20260331051000_semantic_memory_hot_path_indexes.sql',
    queryShape: "WHERE organization_id = $1 AND metadata @> '{\"context_type\":\"tenant_context\"}' ORDER BY created_at DESC LIMIT 20",
    services: [
      'TenantContextIngestionService',
    ],
  },
];

function loadActiveMigrationSql() {
  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => /^\d{14}_.+\.sql$/.test(entry.name))
    .filter((entry) => !entry.name.includes('.rollback.'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => ({
      name: entry.name,
      sql: readFileSync(resolve(MIGRATIONS_DIR, entry.name), 'utf8'),
    }));
}

function verifyInMigrations(files) {
  const missing = [];

  for (const index of REQUIRED_INDEXES) {
    const expectedFile = files.find((file) => file.name === index.source);
    const foundInExpectedFile = expectedFile?.sql.includes(index.name) ?? false;
    if (!foundInExpectedFile) {
      missing.push({ ...index, reason: `Index declaration not found in ${index.source}` });
    }
  }

  return missing;
}

function canQueryDatabase() {
  return Boolean(process.env.DATABASE_URL) && process.env.SKIP_DB_INDEX_CHECK !== '1';
}

function verifyInDatabase() {
  if (!canQueryDatabase()) {
    console.log('ℹ️  DATABASE_URL not set (or SKIP_DB_INDEX_CHECK=1); verified migration declarations only.');
    return [];
  }

  try {
    execFileSync('psql', ['--version'], { stdio: 'ignore' });
  } catch {
    console.log('ℹ️  psql is unavailable; verified migration declarations only.');
    return [];
  }

  const names = REQUIRED_INDEXES.map((index) => index.name).join(',');
  const sql = [
    "SELECT indexname, tablename",
    'FROM pg_indexes',
    "WHERE schemaname = 'public'",
    `  AND indexname = ANY (string_to_array('${names}', ','))`,
    'ORDER BY indexname;',
  ].join(' ');

  const output = execFileSync('psql', [process.env.DATABASE_URL, '-At', '-F', '\t', '-c', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const found = new Set(
    output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split('\t')[0]),
  );

  return REQUIRED_INDEXES.filter((index) => !found.has(index.name)).map((index) => ({
    ...index,
    reason: 'Index not present in target database schema',
  }));
}

function printMissing(title, missing) {
  if (missing.length === 0) return;

  console.error(`\n❌ ${title}`);
  for (const index of missing) {
    console.error(`  - ${index.name} on ${index.table}`);
    console.error(`    source: ${index.source}`);
    console.error(`    query:  ${index.queryShape}`);
    console.error(`    uses:   ${index.services.join(', ')}`);
    console.error(`    issue:  ${index.reason}`);
  }
}

try {
  console.log('🔍 Verifying required performance indexes...\n');

  const files = loadActiveMigrationSql();
  const migrationMissing = verifyInMigrations(files);
  const databaseMissing = migrationMissing.length === 0 ? verifyInDatabase() : [];

  if (migrationMissing.length > 0 || databaseMissing.length > 0) {
    printMissing('Missing required index declarations', migrationMissing);
    printMissing('Missing required indexes in database', databaseMissing);
    process.exit(1);
  }

  console.log(`✅ Verified ${REQUIRED_INDEXES.length} required performance indexes.`);
} catch (error) {
  console.error('❌ Performance index verification failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
