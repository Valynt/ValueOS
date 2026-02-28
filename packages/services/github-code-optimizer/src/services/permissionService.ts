import { Repository } from '../types/index.js';
import { logger } from '../utils/logger.js';

import { githubClient } from './githubClient.js';

export async function checkPermissions(repository: Repository, username: string): Promise<boolean> {
  try {
    // For public repositories, allow analysis
    if (!repository.private) {
      logger.debug('Allowing analysis for public repository', { repository: repository.fullName });
      return true;
    }

    // For private repositories, check user permissions
    const hasPermission = await githubClient.checkPermissions(
      repository.owner,
      repository.name,
      username
    );

    if (hasPermission) {
      logger.debug('User has permission for private repository', {
        repository: repository.fullName,
        username,
      });
      return true;
    }

    logger.warn('User lacks permission for repository', {
      repository: repository.fullName,
      username,
    });
    return false;
  } catch (error) {
    logger.error('Permission check failed', {
      repository: repository.fullName,
      username,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function checkInstallationPermissions(installationId: number, repository: Repository): Promise<boolean> {
  try {
    // This would check if the GitHub App installation has access to the repository
    // For now, assume it does if the webhook was received
    logger.debug('Installation permission check', {
      installationId,
      repository: repository.fullName,
    });
    return true;
  } catch (error) {
    logger.error('Installation permission check failed', {
      installationId,
      repository: repository.fullName,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}