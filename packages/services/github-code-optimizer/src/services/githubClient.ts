import { Octokit } from '@octokit/rest';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { Repository, PullRequestData } from '../types/index.js';

export class GitHubClient {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || config.github.token,
      userAgent: 'github-code-optimizer-bot',
    });
  }

  async getRepository(owner: string, repo: string): Promise<Repository> {
    try {
      const { data } = await this.octokit.repos.get({ owner, repo });
      return {
        owner: data.owner.login,
        name: data.name,
        fullName: data.full_name,
        id: data.id,
        private: data.private,
        defaultBranch: data.default_branch,
        url: data.html_url,
      };
    } catch (error) {
      logger.error('Failed to get repository info', { owner, repo, error });
      throw error;
    }
  }

  async getFileContent(owner: string, repo: string, path: string, ref?: string) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if ('content' in data && data.encoding === 'base64') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      throw new Error('File content not available or not base64 encoded');
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return null; // File doesn't exist
      }
      logger.error('Failed to get file content', { owner, repo, path, error });
      throw error;
    }
  }

  async listRepositoryFiles(owner: string, repo: string, ref?: string): Promise<Array<{ path: string; size: number; type: string; sha: string }>> {
    try {
      const files: Array<{ path: string; size: number; type: string; sha: string }> = [];

      const getContents = async (path = '') => {
        const { data } = await this.octokit.repos.getContent({
          owner,
          repo,
          path,
          ref,
        });

        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.type === 'file') {
              files.push(item);
            } else if (item.type === 'dir') {
              await getContents(item.path);
            }
          }
        }
      };

      await getContents();
      return files;
    } catch (error) {
      logger.error('Failed to list repository files', { owner, repo, error });
      throw error;
    }
  }

  async createBranch(owner: string, repo: string, branchName: string, sha: string): Promise<void> {
    try {
      await this.octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha,
      });
      logger.info('Created branch', { owner, repo, branchName, sha });
    } catch (error) {
      logger.error('Failed to create branch', { owner, repo, branchName, error });
      throw error;
    }
  }

  async createPullRequest(owner: string, repo: string, prData: PullRequestData): Promise<number> {
    try {
      const { data } = await this.octokit.pulls.create({
        owner,
        repo,
        title: prData.title,
        body: prData.body,
        head: prData.head,
        base: prData.base,
        draft: prData.draft || false,
      });

      logger.info('Created pull request', {
        owner,
        repo,
        prNumber: data.number,
        title: prData.title,
      });

      return data.number;
    } catch (error) {
      logger.error('Failed to create pull request', { owner, repo, prData, error });
      throw error;
    }
  }

  async updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string
  ): Promise<void> {
    try {
      await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
        sha,
      });

      logger.info('Updated file', { owner, repo, path, branch });
    } catch (error) {
      logger.error('Failed to update file', { owner, repo, path, error });
      throw error;
    }
  }

  async getCommit(owner: string, repo: string, ref: string) {
    try {
      const { data } = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref,
      });
      return data;
    } catch (error) {
      logger.error('Failed to get commit', { owner, repo, ref, error });
      throw error;
    }
  }

  async checkPermissions(owner: string, repo: string, username: string): Promise<boolean> {
    try {
      // Check if user has push access to the repository
      const { data } = await this.octokit.repos.getCollaboratorPermissionLevel({
        owner,
        repo,
        username,
      });

      // Allow users with write or admin permissions
      return ['write', 'admin'].includes(data.permission);
    } catch (error) {
      logger.warn('Failed to check permissions', { owner, repo, username, error });
      return false;
    }
  }
}

export const githubClient = new GitHubClient();