import { logger, logAnalysisEvent } from '../utils/logger.js';
import { Repository, GitHubEvent } from '../types/index.js';
import { analyzeRepository } from '../services/analysisService.js';
import { checkPermissions } from '../services/permissionService.js';
import { loadRepositoryConfig } from '../services/configService.js';

interface WebhookPayload {
  action?: string;
  repository: any;
  sender?: any;
  installation?: any;
  pull_request?: any;
  repositories?: any[];
  commits?: any[];
  after?: string;
  ref?: string;
}

export const webhookHandlers: Record<string, (event: WebhookPayload) => Promise<void>> = {
  push: handlePushEvent,
  pull_request: handlePullRequestEvent,
  installation: handleInstallationEvent,
  installation_repositories: handleInstallationRepositoriesEvent,
};

async function handlePushEvent(event: WebhookPayload) {
  const payload = event;
  const repository = extractRepository(payload.repository);
  const sender = payload.sender?.login;
  const ref = payload.ref;
  const commits = payload.commits || [];

  if (!sender) {
    logger.warn('Push event missing sender', { repository: repository.fullName });
    return;
  }

  if (!ref) {
    logger.warn('Push event missing ref', { repository: repository.fullName });
    return;
  }

  logger.info('Push event received', {
    repository: repository.fullName,
    sender,
    ref,
    commitsCount: commits.length,
  });

  // Only process pushes to main/master branches
  if (!isMainBranch(ref)) {
    logger.debug('Ignoring push to non-main branch', { ref });
    return;
  }

  // Check permissions
  if (!(await checkPermissions(repository, sender))) {
    logger.warn('Permission denied for push analysis', { repository: repository.fullName, sender });
    return;
  }

  // Load repository configuration
  const config = await loadRepositoryConfig(repository);
  if (!config?.enabled) {
    logger.debug('Bot disabled for repository', { repository: repository.fullName });
    return;
  }

  // Check if this is a relevant code change
  if (!hasRelevantChanges(commits, config)) {
    logger.debug('No relevant code changes detected');
    return;
  }

  // Start analysis
  try {
    const commitSha = payload.after;
    if (!commitSha) {
      logger.warn('Push event missing commit SHA', { repository: repository.fullName });
      return;
    }

    logAnalysisEvent('analysis_started', {
      repository: repository.fullName,
      trigger: 'push',
      commitSha,
    });

    await analyzeRepository(repository, commitSha, config);
  } catch (error) {
    logger.error('Analysis failed for push event', {
      repository: repository.fullName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handlePullRequestEvent(event: WebhookPayload) {
  const payload = event;
  const repository = extractRepository(payload.repository);
  const action = payload.action;
  const sender = payload.sender?.login;

  if (!sender) {
    logger.warn('PR event missing sender', { repository: repository.fullName });
    return;
  }

  if (!payload.pull_request) {
    logger.warn('PR event missing pull_request data', { repository: repository.fullName });
    return;
  }

  logger.info('PR event received', {
    repository: repository.fullName,
    action,
    sender,
    prNumber: payload.pull_request.number,
  });

  // Only process opened PRs
  if (action !== 'opened' && action !== 'synchronize') {
    logger.debug('Ignoring PR action', { action });
    return;
  }

  // Check permissions
  if (!(await checkPermissions(repository, sender))) {
    logger.warn('Permission denied for PR analysis', { repository: repository.fullName, sender });
    return;
  }

  // Load repository configuration
  const config = await loadRepositoryConfig(repository);
  if (!config?.enabled) {
    logger.debug('Bot disabled for repository', { repository: repository.fullName });
    return;
  }

  // Start analysis
  try {
    const commitSha = payload.pull_request.head?.sha;
    if (!commitSha) {
      logger.warn('PR event missing commit SHA', { repository: repository.fullName });
      return;
    }

    logAnalysisEvent('analysis_started', {
      repository: repository.fullName,
      trigger: 'pull_request',
      prNumber: payload.pull_request.number,
      commitSha,
    });

    await analyzeRepository(repository, commitSha, config);
  } catch (error) {
    logger.error('Analysis failed for PR event', {
      repository: repository.fullName,
      prNumber: payload.pull_request?.number,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleInstallationEvent(event: WebhookPayload) {
  const payload = event;
  const action = payload.action;
  const installationId = payload.installation?.id;

  if (!installationId) {
    logger.warn('Installation event missing installation ID');
    return;
  }

  logger.info('Installation event received', { action, installationId });

  // Handle installation created/added
  if (action === 'created' || action === 'new_permissions_accepted') {
    logger.info('Bot installed on repositories', {
      installationId,
      repositoriesCount: payload.repositories?.length || 0,
    });
  }
}

async function handleInstallationRepositoriesEvent(event: WebhookPayload) {
  const payload = event;
  const action = payload.action;
  const installationId = payload.installation?.id;

  if (!installationId) {
    logger.warn('Installation repositories event missing installation ID');
    return;
  }

  logger.info('Installation repositories event received', {
    action,
    installationId,
    repository: payload.repository?.full_name,
  });
}

function extractRepository(repoPayload: any): Repository {
  return {
    owner: repoPayload.owner.login,
    name: repoPayload.name,
    fullName: repoPayload.full_name,
    id: repoPayload.id,
    private: repoPayload.private,
    defaultBranch: repoPayload.default_branch,
    url: repoPayload.html_url,
  };
}

function isMainBranch(ref: string): boolean {
  const branch = ref.replace('refs/heads/', '');
  return branch === 'main' || branch === 'master';
}

function hasRelevantChanges(commits: any[], config: any): boolean {
  if (!commits.length) return false;

  const relevantExtensions = new Set([
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs',
    '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala'
  ]);

  for (const commit of commits) {
    for (const file of commit.modified || []) {
      const ext = file.substring(file.lastIndexOf('.'));
      if (relevantExtensions.has(ext) && !isBlacklisted(file, config.blacklist || [])) {
        return true;
      }
    }
    for (const file of commit.added || []) {
      const ext = file.substring(file.lastIndexOf('.'));
      if (relevantExtensions.has(ext) && !isBlacklisted(file, config.blacklist || [])) {
        return true;
      }
    }
  }

  return false;
}

function isBlacklisted(file: string, blacklist: string[]): boolean {
  return blacklist.some(pattern => {
    if (pattern.includes('*')) {
      // Simple glob matching
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(file);
    }
    return file.includes(pattern);
  });
}