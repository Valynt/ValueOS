import * as fs from 'fs';
import * as path from 'path';
import postgres from 'postgres';

interface SchemaValidationResult {
  missingTables: string[];
  extraTables: string[];
  valid: boolean;
}

async function globFiles(dir: string, pattern: string): Promise<string[]> {
  const files: string[] = [];

  function walk(dirPath: string) {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (item.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

async function extractCodeReferences(): Promise<Set<string>> {
  const tableRefs = new Set<string>();
  const srcDirs = ['packages/backend/src', 'apps/ValyntApp/src'];

  const fromPattern = /\.from\(['"]([^'"]+)['"]\)/g;

  for (const dir of srcDirs) {
    try {
      const files = await globFiles(dir, '/*.ts');
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        let match;
        while ((match = fromPattern.exec(content)) !== null) {
          tableRefs.add(match[1]);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not scan ${dir}:`, error.message);
    }
  }
  return tableRefs;
}

async function getDbTables(connectionString: string): Promise<Set<string>> {
  const sql = postgres(connectionString);
  try {
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    return new Set(result.map(r => r.table_name));
  } finally {
    await sql.end();
  }
}

export async function validateSchemaDrift(): Promise<SchemaValidationResult> {
  const codeRefs = await extractCodeReferences();
  const dbTables = await getDbTables(process.env.DATABASE_URL!);

  const missingTables = [...codeRefs].filter(t => !dbTables.has(t));
  const extraTables = [...dbTables].filter(t => !codeRefs.has(t));

  return {
    missingTables,
    extraTables,
    valid: missingTables.length === 0
  };
}

// CI integration
if (import.meta.url === `file://${process.argv[1]}`) {
  validateSchemaDrift().then(result => {
    if (!result.valid) {
      console.error('❌ Schema drift detected!');
      console.error('Missing tables:', result.missingTables);
      console.error('Extra tables:', result.extraTables);
      process.exit(1);
    }
    console.log('✅ Schema validation passed');
  }).catch(error => {
    console.error('Schema validation failed:', error);
    process.exit(1);
  });
}