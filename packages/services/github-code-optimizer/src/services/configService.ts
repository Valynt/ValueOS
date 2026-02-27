import yaml from 'js-yaml';
import { Repository, BotConfig } from '../types/index.js';
import { githubClient } from './githubClient.js';
import { logger } from '../utils/logger.js';

const DEFAULT_CONFIG: BotConfig = {
  enabled: false,
  thresholds: {
    performanceGain: 0.1, // 10% improvement required
    maxFiles: 100,
    maxFileSize: 1024 * 1024, // 1MB
  },
  languages: ['javascript', 'typescript', 'python', 'java'],
  blacklist: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '.git/**',
    '*.min.js',
    '*.min.css',
  ],
  ai: {
    model: 'openai/gpt-4o',
    maxTokens: 4096,
  },
};

export async function loadRepositoryConfig(repository: Repository): Promise<BotConfig | null> {
  try {
    const configPaths = [
      '.github/code-optimizer.yml',
      '.github/code-optimizer.yaml',
      'code-optimizer.yml',
      'code-optimizer.yaml',
    ];

    for (const path of configPaths) {
      const content = await githubClient.getFileContent(
        repository.owner,
        repository.name,
        path
      );

      if (content) {
        const config = yaml.load(content) as Partial<BotConfig>;

        // Merge with defaults
        const mergedConfig: BotConfig = {
          ...DEFAULT_CONFIG,
          ...config,
          thresholds: {
            ...DEFAULT_CONFIG.thresholds,
            ...config.thresholds,
          },
          ai: {
            ...DEFAULT_CONFIG.ai,
            ...config.ai,
          },
        };

        logger.debug('Loaded repository config', {
          repository: repository.fullName,
          configPath: path,
          enabled: mergedConfig.enabled,
        });

        return mergedConfig;
      }
    }

    logger.debug('No config file found, using defaults', {
      repository: repository.fullName,
      enabled: false,
    });

    return { ...DEFAULT_CONFIG };
  } catch (error) {
    logger.error('Failed to load repository config', {
      repository: repository.fullName,
      error: error instanceof Error ? error.message : String(error),
    });

    // Return disabled config on error
    return { ...DEFAULT_CONFIG, enabled: false };
  }
}

export function validateConfig(config: unknown): BotConfig {
  if (typeof config !== 'object' || config === null) {
    throw new Error('Config must be an object');
  }

  const raw = config as Record<string, unknown>;
  const thresholds = raw.thresholds as Record<string, unknown> | undefined;
  const ai = raw.ai as Record<string, unknown> | undefined;

  return {
    enabled: (raw.enabled as boolean) ?? DEFAULT_CONFIG.enabled,
    thresholds: {
      performanceGain: (thresholds?.performanceGain as number) ?? DEFAULT_CONFIG.thresholds.performanceGain,
      maxFiles: (thresholds?.maxFiles as number) ?? DEFAULT_CONFIG.thresholds.maxFiles,
      maxFileSize: (thresholds?.maxFileSize as number) ?? DEFAULT_CONFIG.thresholds.maxFileSize,
    },
    languages: (raw.languages as string[]) ?? DEFAULT_CONFIG.languages,
    blacklist: (raw.blacklist as string[]) ?? DEFAULT_CONFIG.blacklist,
    ai: {
      model: (ai?.model as string) ?? DEFAULT_CONFIG.ai.model,
      maxTokens: (ai?.maxTokens as number) ?? DEFAULT_CONFIG.ai.maxTokens,
    },
  };
}

export async function saveRepositoryConfig(repository: Repository, config: BotConfig): Promise<void> {
  try {
    const configYaml = yaml.dump(config);
    const path = '.github/code-optimizer.yml';

    await githubClient.updateFile(
      repository.owner,
      repository.name,
      path,
      configYaml,
      'Update code optimizer configuration',
      repository.defaultBranch
    );

    logger.info('Saved repository config', { repository: repository.fullName, path });
  } catch (error) {
    logger.error('Failed to save repository config', {
      repository: repository.fullName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}