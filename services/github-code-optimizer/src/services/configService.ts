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

export function validateConfig(config: any): BotConfig {
  // Basic validation - could be enhanced with zod
  if (typeof config !== 'object' || config === null) {
    throw new Error('Config must be an object');
  }

  return {
    enabled: config.enabled ?? DEFAULT_CONFIG.enabled,
    thresholds: {
      performanceGain: config.thresholds?.performanceGain ?? DEFAULT_CONFIG.thresholds.performanceGain,
      maxFiles: config.thresholds?.maxFiles ?? DEFAULT_CONFIG.thresholds.maxFiles,
      maxFileSize: config.thresholds?.maxFileSize ?? DEFAULT_CONFIG.thresholds.maxFileSize,
    },
    languages: config.languages ?? DEFAULT_CONFIG.languages,
    blacklist: config.blacklist ?? DEFAULT_CONFIG.blacklist,
    ai: {
      model: config.ai?.model ?? DEFAULT_CONFIG.ai.model,
      maxTokens: config.ai?.maxTokens ?? DEFAULT_CONFIG.ai.maxTokens,
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