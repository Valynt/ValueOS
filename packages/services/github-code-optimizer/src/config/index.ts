import { z } from 'zod';
import { getDatabaseUrl } from './env.js';

const configSchema = z.object({
  port: z.number().default(3000),
  github: z.object({
    token: z.string().optional(),
    webhookSecret: z.string().optional(),
    appId: z.string().optional(),
    privateKey: z.string().optional(),
  }),
  openRouter: z.object({
    apiKey: z.string().optional(),
    baseUrl: z.string().default('https://openrouter.ai/api/v1'),
  }),
  database: z.object({
    type: z.enum(['memory', 'sqlite', 'postgres']).default('memory'),
    url: z.string().optional(),
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    file: z.string().optional(),
  }),
  analysis: z.object({
    timeout: z.number().default(300000), // 5 minutes
    maxConcurrency: z.number().default(3),
    batchSize: z.number().default(10),
  }),
});

export type Config = z.infer<typeof configSchema>;

export const config: Config = configSchema.parse({
  port: parseInt(process.env.PORT || '3000'),
  github: {
    token: process.env.GITHUB_TOKEN,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_PRIVATE_KEY,
  },
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  },
  database: {
    type: process.env.DATABASE_TYPE || 'memory',
    url: getDatabaseUrl(),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE,
  },
  analysis: {
    timeout: parseInt(process.env.ANALYSIS_TIMEOUT || '300000'),
    maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '3'),
    batchSize: parseInt(process.env.BATCH_SIZE || '10'),
  },
});

// Validate required environment variables
const requiredVars = [
  'GITHUB_TOKEN',
  'OPENROUTER_API_KEY',
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`Warning: Missing required environment variables: ${missingVars.join(', ')}`);
  console.warn('Some features may not work correctly.');
}
