/**
 * Admin Content Loader
 * Utility for loading and managing educational content from various sources
 */

import { z } from 'zod';
import { type CurriculumModule } from '../data/curriculum';
import { logger } from './logger';

export interface ContentLoaderOptions {
  source: 'json' | 'api' | 'file';
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
});

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

  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to load JSON content from "${path}": HTTP ${response.status}`);
  }

  const raw: unknown = await response.json();
  const parsed = ContentPayloadSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(`Invalid content JSON at "${path}": ${parsed.error.message}`);
  }

  return {
    modules: parsed.data.modules as CurriculumModule[],
    resources: parsed.data.resources ?? [],
    metadata: {
      source: path,
      loadedAt: new Date(),
      version: parsed.data.version,
    },
  };
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

  const url = new URL(endpoint, window.location.origin);
  if (options['pillarId'] !== undefined) url.searchParams.set('pillarId', String(options['pillarId']));
  if (options['role'] !== undefined) url.searchParams.set('role', String(options['role']));

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to load content from API "${endpoint}": HTTP ${response.status}`);
  }

  const raw: unknown = await response.json();
  const parsed = ContentPayloadSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(`Invalid content from API "${endpoint}": ${parsed.error.message}`);
  }

  return {
    modules: parsed.data.modules as CurriculumModule[],
    resources: parsed.data.resources ?? [],
    metadata: {
      source: endpoint,
      loadedAt: new Date(),
      version: parsed.data.version,
    },
  };
}

/**
 * Main content loader function
 */
export async function loadContent(options: ContentLoaderOptions): Promise<LoadedContent> {
  switch (options.source) {
    case 'json':
      if (!options.path) throw new Error('Path required for JSON loading');
      return loadContentFromJson(options.path);

    case 'api':
      if (!options.path) throw new Error('Path required for API loading');
      return loadContentFromApi(options.path, { pillarId: options.pillarId, role: options.role });

    case 'file':
      // File loading would require server-side implementation
      throw new Error('File loading not implemented in browser environment');

    default:
      throw new Error(`Unsupported content source: ${options.source}`);
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
