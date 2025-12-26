import PQueue from 'p-queue';
import { Repository, Optimization, AnalysisJob, BotConfig } from '../types/index.js';
import { githubClient } from './githubClient.js';
import { logger, logAnalysisEvent } from '../utils/logger.js';
import { analyzeCode } from '../analysis/staticAnalyzer.js';
import { generateOptimizations } from '../analysis/optimizationEngine.js';
import { createPullRequest } from '../services/prService.js';
import { config } from '../config/index.js';

const analysisQueue = new PQueue({ concurrency: config.analysis.maxConcurrency });

export async function analyzeRepository(
  repository: Repository,
  commitSha: string,
  botConfig: BotConfig
): Promise<void> {
  const jobId = `${repository.fullName}-${commitSha}-${Date.now()}`;

  const job: AnalysisJob = {
    id: jobId,
    repository,
    commitSha,
    status: 'pending',
    optimizations: [],
  };

  try {
    logAnalysisEvent('job_started', {
      jobId,
      repository: repository.fullName,
      commitSha,
    });

    job.status = 'running';
    job.startedAt = new Date();

    // Get repository files
    const files = await githubClient.listRepositoryFiles(
      repository.owner,
      repository.name,
      commitSha
    );

    logger.info('Retrieved repository files', {
      repository: repository.fullName,
      fileCount: files.length,
    });

    // Filter files based on config
    const relevantFiles = filterRelevantFiles(files, botConfig);

    logger.info('Filtered relevant files', {
      repository: repository.fullName,
      originalCount: files.length,
      filteredCount: relevantFiles.length,
    });

    if (relevantFiles.length === 0) {
      logger.info('No relevant files to analyze', { repository: repository.fullName });
      job.status = 'completed';
      return;
    }

    // Analyze files in batches
    const allOptimizations: Optimization[] = [];

    for (let i = 0; i < relevantFiles.length; i += config.analysis.batchSize) {
      const batch = relevantFiles.slice(i, i + config.analysis.batchSize);

      const batchPromises = batch.map(file =>
        analysisQueue.add(() => analyzeFile(repository, file, botConfig))
      );

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          allOptimizations.push(...result.value);
        } else if (result.status === 'rejected') {
          logger.error('File analysis failed', {
            repository: repository.fullName,
            error: result.reason,
          });
        }
      }

      logger.debug('Processed batch', {
        repository: repository.fullName,
        batchIndex: Math.floor(i / config.analysis.batchSize),
        optimizationsFound: allOptimizations.length,
      });
    }

    // Filter optimizations based on thresholds
    const filteredOptimizations = allOptimizations.filter(opt =>
      opt.estimatedGain >= (botConfig.thresholds.performanceGain * 100)
    );

    logger.info('Analysis completed', {
      repository: repository.fullName,
      totalOptimizations: allOptimizations.length,
      filteredOptimizations: filteredOptimizations.length,
    });

    job.optimizations = filteredOptimizations;
    job.status = 'completed';
    job.completedAt = new Date();

    // Create PR if we have optimizations
    if (filteredOptimizations.length > 0) {
      await createPullRequest(repository, filteredOptimizations, commitSha, botConfig);
    }

    logAnalysisEvent('job_completed', {
      jobId,
      repository: repository.fullName,
      optimizationsCount: filteredOptimizations.length,
      duration: job.completedAt.getTime() - job.startedAt!.getTime(),
    });

  } catch (error) {
    logger.error('Analysis job failed', {
      jobId,
      repository: repository.fullName,
      error: error instanceof Error ? error.message : String(error),
    });

    job.status = 'failed';
    job.error = error instanceof Error ? error.message : String(error);

    logAnalysisEvent('job_failed', {
      jobId,
      repository: repository.fullName,
      error: job.error,
    });
  }
}

async function analyzeFile(
  repository: Repository,
  file: any,
  botConfig: BotConfig
): Promise<Optimization[]> {
  try {
    // Skip files that are too large
    if (file.size > botConfig.thresholds.maxFileSize) {
      logger.debug('Skipping large file', {
        repository: repository.fullName,
        file: file.path,
        size: file.size,
      });
      return [];
    }

    // Get file content
    const content = await githubClient.getFileContent(
      repository.owner,
      repository.name,
      file.path
    );

    if (!content) {
      logger.debug('Could not retrieve file content', {
        repository: repository.fullName,
        file: file.path,
      });
      return [];
    }

    // Static analysis
    const staticIssues = await analyzeCode(file.path, content, botConfig.languages);

    // Generate optimizations
    const optimizations = await generateOptimizations(
      file.path,
      content,
      staticIssues,
      botConfig
    );

    if (optimizations.length > 0) {
      logger.debug('Found optimizations', {
        repository: repository.fullName,
        file: file.path,
        count: optimizations.length,
      });
    }

    return optimizations;
  } catch (error) {
    logger.error('File analysis failed', {
      repository: repository.fullName,
      file: file.path,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function filterRelevantFiles(files: any[], botConfig: BotConfig): any[] {
  return files.filter(file => {
    // Must be a file
    if (file.type !== 'file') return false;

    // Check size limit
    if (file.size > botConfig.thresholds.maxFileSize) return false;

    // Check language support
    const extension = file.path.split('.').pop()?.toLowerCase();
    if (!extension || !botConfig.languages.includes(getLanguageFromExtension(extension))) {
      return false;
    }

    // Check blacklist
    if (isBlacklisted(file.path, botConfig.blacklist)) return false;

    return true;
  });
}

function getLanguageFromExtension(ext: string): string {
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
  };

  return languageMap[ext] || ext;
}

function isBlacklisted(path: string, blacklist: string[]): boolean {
  return blacklist.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\//g, '\\/'));
      return regex.test(path);
    }
    return path.includes(pattern);
  });
}