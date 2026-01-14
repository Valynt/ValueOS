import express from 'express';
import { Repository, Optimization, AnalysisJob } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// In-memory storage for demo purposes
// In production, this should use a proper database
const repositories = new Map<string, Repository>();
const optimizations = new Map<string, Optimization[]>();
const jobs = new Map<string, AnalysisJob>();

// Get dashboard overview
router.get('/overview', (req, res) => {
  try {
    const stats = {
      totalRepositories: repositories.size,
      totalOptimizations: Array.from(optimizations.values()).reduce((sum, opts) => sum + opts.length, 0),
      activeJobs: Array.from(jobs.values()).filter(job => job.status === 'running').length,
      completedJobs: Array.from(jobs.values()).filter(job => job.status === 'completed').length,
    };

    res.json(stats);
  } catch (error) {
    logger.error('Dashboard overview error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all repositories
router.get('/repositories', (req, res) => {
  try {
    const repos = Array.from(repositories.values());
    res.json(repos);
  } catch (error) {
    logger.error('Get repositories error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get repository details
router.get('/repositories/:owner/:name', (req, res) => {
  try {
    const { owner, name } = req.params;
    const repoKey = `${owner}/${name}`;
    const repository = repositories.get(repoKey);

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const repoOptimizations = optimizations.get(repoKey) || [];
    const repoJobs = Array.from(jobs.values()).filter(job =>
      job.repository.fullName === repoKey
    );

    res.json({
      repository,
      optimizations: repoOptimizations,
      jobs: repoJobs,
    });
  } catch (error) {
    logger.error('Get repository details error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get optimizations for a repository
router.get('/repositories/:owner/:name/optimizations', (req, res) => {
  try {
    const { owner, name } = req.params;
    const repoKey = `${owner}/${name}`;
    const repoOptimizations = optimizations.get(repoKey) || [];

    res.json(repoOptimizations);
  } catch (error) {
    logger.error('Get repository optimizations error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get analysis jobs
router.get('/jobs', (req, res) => {
  try {
    const allJobs = Array.from(jobs.values());
    res.json(allJobs);
  } catch (error) {
    logger.error('Get jobs error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get job details
router.get('/jobs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const job = jobs.get(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    logger.error('Get job details error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve/reject optimization (for future use)
router.post('/optimizations/:id/:action', (req, res) => {
  try {
    const { id, action } = req.params;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Find and update optimization status
    let found = false;
    for (const [repoKey, repoOpts] of optimizations) {
      const optIndex = repoOpts.findIndex(opt => opt.id === id);
      if (optIndex !== -1) {
        repoOpts[optIndex] = {
          ...repoOpts[optIndex],
          status: action === 'approve' ? 'approved' : 'rejected',
        };
        found = true;
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: 'Optimization not found' });
    }

    res.json({ success: true, action });
  } catch (error) {
    logger.error('Optimization action error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add repository (for manual addition)
router.post('/repositories', (req, res) => {
  try {
    const { owner, name, ...repoData } = req.body;

    if (!owner || !name) {
      return res.status(400).json({ error: 'Owner and name are required' });
    }

    const repository: Repository = {
      owner,
      name,
      fullName: `${owner}/${name}`,
      id: Date.now(), // Mock ID
      private: repoData.private || false,
      defaultBranch: repoData.defaultBranch || 'main',
      url: `https://github.com/${owner}/${name}`,
      ...repoData,
    };

    repositories.set(repository.fullName, repository);

    logger.info('Added repository to dashboard', { repository: repository.fullName });

    res.json(repository);
  } catch (error) {
    logger.error('Add repository error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions to update data from the bot
export function addRepository(repository: Repository): void {
  repositories.set(repository.fullName, repository);
}

export function addOptimizations(repoKey: string, repoOptimizations: Optimization[]): void {
  optimizations.set(repoKey, repoOptimizations);
}

export function addJob(job: AnalysisJob): void {
  jobs.set(job.id, job);
}

export function updateJob(job: AnalysisJob): void {
  jobs.set(job.id, job);
}

export { router as dashboardRouter };