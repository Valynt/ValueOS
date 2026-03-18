/**
 * Admin Content Loader
 * Utility for loading and managing educational content from various sources
 */

import { z } from 'zod';

import { type CurriculumModule } from '../data/curriculum';

import { logger } from './logger';

export interface ContentLoaderOptions {
  source?: 'json' | 'api' | 'file';
  path?: string;
  pillarId?: number;
  role?: string;
}

export interface LoadedContent {
  modules: CurriculumModule[];
  resources: unknown[];
  metadata: {
    source: string;
    loadedAt: Date;
    version?: string;
  };
}

// ---------------------------------------------------------------------------
// Zod schema for the expected JSON/API payload shape
// ---------------------------------------------------------------------------

const CurriculumModuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  pillarId: z.number(),
  order: z.number(),
  requiredMaturityLevel: z.number(),
  estimatedDuration: z.string(),
  prerequisites: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  resources: z.array(z.string()).optional(),
});

const ContentPayloadSchema = z.object({
  modules: z.array(CurriculumModuleSchema),
  resources: z.array(z.unknown()).optional(),
  version: z.string().optional(),
}).strict();

const ApiPayloadSchema = z.union([
  ContentPayloadSchema,
  z.object({ data: ContentPayloadSchema }).strict(),
  z.object({ curriculum: ContentPayloadSchema }).strict(),
  z.object({ data: z.object({ curriculum: ContentPayloadSchema }).strict() }).strict(),
]);

type NormalizedPayload = z.infer<typeof ContentPayloadSchema>;

const jsonCache = new Map<string, LoadedContent>();
const apiCache = new Map<string, LoadedContent>();

function normalizeApiPayload(raw: unknown): NormalizedPayload {
  const parsed = ApiPayloadSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(`Invalid API payload: ${parsed.error.message}`);
  }

  if ('modules' in parsed.data) return parsed.data;
  if ('data' in parsed.data && 'modules' in parsed.data.data) return parsed.data.data;
  if ('curriculum' in parsed.data) return parsed.data.curriculum;
  return parsed.data.data.curriculum;
}

function normalizeContentPayload(raw: unknown): NormalizedPayload {
  const parsed = ContentPayloadSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(`Invalid content payload: ${parsed.error.message}`);
  }

  return parsed.data;
}

function toLoadedContent(payload: NormalizedPayload, source: string): LoadedContent {
  return {
    modules: payload.modules,
    resources: payload.resources ?? [],
    metadata: {
      source,
      loadedAt: new Date(),
      version: payload.version,
    },
  };
}

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

async function readJsonFromFilesystem(path: string): Promise<unknown> {
  const { readFile } = await import('node:fs/promises');
  const contents = await readFile(path, 'utf8');
  return JSON.parse(contents) as unknown;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Request failed for "${url}": HTTP ${response.status}`);
  }

  return (await response.json()) as unknown;
}

function resolveSource(configuredSource?: string): 'json' | 'api' | 'file' {
  const sourceFromEnv = configuredSource ?? import.meta.env.VITE_CONTENT_SOURCE;

  if (sourceFromEnv === 'json' || sourceFromEnv === 'api' || sourceFromEnv === 'file') {
    return sourceFromEnv;
  }

  return 'json';
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

/**
 * Load content from a JSON file served at the given URL path.
 *
 * In the browser environment (Vite), `path` should be a URL relative to the
 * app origin (e.g. `/content/curriculum.json`). The file must be placed in
 * the `public/` directory so Vite serves it as a static asset.
 */
export async function loadContentFromJson(path: string): Promise<LoadedContent> {
  logger.debug('loadContentFromJson', { path });

  if (jsonCache.has(path)) {
    return jsonCache.get(path)!;
  }

  const isHttpPath = /^https?:\/\//.test(path);

  const raw = isBrowserRuntime() || isHttpPath
    ? await fetchJson(path)
    : await readJsonFromFilesystem(path);

  const payload = normalizeContentPayload(raw);
  const loaded = toLoadedContent(payload, path);
  jsonCache.set(path, loaded);

  return loaded;
}

/**
 * Load content from an API endpoint.
 *
 * The endpoint must return a JSON body matching ContentPayloadSchema.
 * Query parameters `pillarId` and `role` are appended when provided.
 */
export async function loadContentFromApi(
  endpoint: string,
  options: Record<string, unknown> = {}
): Promise<LoadedContent> {
  logger.debug('loadContentFromApi', { endpoint, options });

  const origin = isBrowserRuntime() ? window.location.origin : 'http://localhost';
  const url = new URL(endpoint, origin);
  if (options['pillarId'] !== undefined) url.searchParams.set('pillarId', String(options['pillarId']));
  if (options['role'] !== undefined) url.searchParams.set('role', String(options['role']));
  const cacheKey = url.toString();

  if (apiCache.has(cacheKey)) {
    return apiCache.get(cacheKey)!;
  }

  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const raw = await fetchJson(cacheKey);
      const payload = normalizeApiPayload(raw);
      const loaded = toLoadedContent(payload, endpoint);
      apiCache.set(cacheKey, loaded);
      return loaded;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        break;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 50 * attempt);
      });
    }
  }

  throw new Error(`Failed to load content from API "${endpoint}" after ${maxAttempts} attempts: ${String(lastError)}`);
}

/**
 * Main content loader function
 */
export async function loadContent(options: ContentLoaderOptions): Promise<LoadedContent> {
  const selectedSource = options.source ?? resolveSource();

  switch (selectedSource) {
    case 'json':
      if (!options.path) throw new Error('Path required for JSON loading');
      return loadContentFromJson(options.path);

    case 'api':
      if (!options.path) throw new Error('Path required for API loading');
      return loadContentFromApi(options.path, { pillarId: options.pillarId, role: options.role });

    case 'file':
      if (!options.path) throw new Error('Path required for file loading');
      return loadContentFromJson(options.path);

    default:
      throw new Error(`Unsupported content source: ${selectedSource}`);
  }
}

/**
 * Validate loaded content structure
 */
export function validateContent(content: LoadedContent): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate modules
  content.modules.forEach((module, index) => {
    if (!module.id) errors.push(`Module ${index}: missing id`);
    if (!module.title) errors.push(`Module ${index}: missing title`);
    if (!module.pillarId) errors.push(`Module ${index}: missing pillarId`);
    if (module.order === undefined) errors.push(`Module ${index}: missing order`);
    if (module.requiredMaturityLevel === undefined) errors.push(`Module ${index}: missing requiredMaturityLevel`);
  });

  // Validate metadata
  if (!content.metadata.source) errors.push('Missing metadata source');
  if (!content.metadata.loadedAt) errors.push('Missing metadata loadedAt');

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Merge loaded content with existing curriculum
 */
export function mergeContent(
  existingCurriculum: Record<string, unknown>,
  newContent: LoadedContent,
  options: { overwrite?: boolean } = {}
): Record<string, unknown> {
  logger.debug("Merging content", { overwrite: options.overwrite });

  return {
    ...existingCurriculum,
    ...newContent,
    mergedAt: new Date()
  };
}

/**
 * Export content for backup or migration
 */
export function exportContent(content: { modules?: CurriculumModule[] }, format: 'json' | 'csv' = 'json'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(content, null, 2);

    case 'csv':
      return 'id,title,description,pillarId,order,requiredMaturityLevel\n' +
             (content.modules?.map((m) =>
               `"${m.id}","${m.title}","${m.description}",${m.pillarId},${m.order},${m.requiredMaturityLevel}`
             ).join('\n') ?? '');

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Content loader UI component for admin interface
 */
export interface ContentLoaderProps {
  onContentLoaded: (content: LoadedContent) => void;
  onError: (error: string) => void;
}

// Note: UI component should be in a separate component file
// This is just the interface definition for now
