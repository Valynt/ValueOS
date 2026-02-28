import { BotConfig, Optimization, PullRequestData, Repository } from '../types/index.js';
import { githubClient } from './githubClient.js';
import { logger, logPREvent } from '../utils/logger.js';
import { generateTests } from '../generation/testGenerator.js';

export async function createPullRequest(
  repository: Repository,
  optimizations: Optimization[],
  commitSha: string,
  _config: BotConfig
): Promise<void> {
  try {
    // Create a new branch for the optimizations
    const branchName = `code-optimizer-${Date.now()}`;
    await githubClient.createBranch(repository.owner, repository.name, branchName, commitSha);

    logger.info('Created optimization branch', {
      repository: repository.fullName,
      branch: branchName,
      optimizations: optimizations.length,
    });

    // Apply optimizations to files
    const changedFiles = await applyOptimizations(repository, optimizations, branchName);

    // Generate tests for the optimizations
    await generateAndCommitTests(repository, optimizations, branchName);

    // Create the pull request
    const prData = buildPRData(repository, optimizations, branchName, changedFiles);
    const prNumber = await githubClient.createPullRequest(repository.owner, repository.name, prData);

    logPREvent(repository.fullName, prNumber, 'created');

    logger.info('Created optimization PR', {
      repository: repository.fullName,
      prNumber,
      branch: branchName,
      optimizations: optimizations.length,
      changedFiles: changedFiles.length,
    });

  } catch (error) {
    logger.error('Failed to create optimization PR', {
      repository: repository.fullName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function applyOptimizations(
  repository: Repository,
  optimizations: Optimization[],
  branch: string
): Promise<string[]> {
  const changedFiles = new Set<string>();

  // Group optimizations by file
  const optimizationsByFile = optimizations.reduce((acc, opt) => {
    if (!acc[opt.file]) acc[opt.file] = [];
    acc[opt.file].push(opt);
    return acc;
  }, {} as Record<string, Optimization[]>);

  for (const [filePath, fileOptimizations] of Object.entries(optimizationsByFile)) {
    try {
      // Get current file content
      const currentContent = await githubClient.getFileContent(
        repository.owner,
        repository.name,
        filePath,
        branch
      );

      if (!currentContent) {
        logger.warn('Could not get file content for optimization', {
          repository: repository.fullName,
          file: filePath,
        });
        continue;
      }

      // Apply optimizations to the content
      const optimizedContent = applyFileOptimizations(currentContent, fileOptimizations);

      // Commit the changes
      const commitMessage = buildCommitMessage(fileOptimizations);
      await githubClient.updateFile(
        repository.owner,
        repository.name,
        filePath,
        optimizedContent,
        commitMessage,
        branch
      );

      changedFiles.add(filePath);

      logger.debug('Applied optimizations to file', {
        repository: repository.fullName,
        file: filePath,
        optimizations: fileOptimizations.length,
      });

    } catch (error) {
      logger.error('Failed to apply optimizations to file', {
        repository: repository.fullName,
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return Array.from(changedFiles);
}

async function generateAndCommitTests(
  repository: Repository,
  optimizations: Optimization[],
  branch: string
): Promise<void> {
  // Generate tests for optimizations that might affect functionality
  const highImpactOptimizations = optimizations.filter(opt =>
    opt.severity === 'high' || opt.type === 'performance'
  );

  for (const optimization of highImpactOptimizations) {
    try {
      const tests = await generateTests(optimization);

      if (tests) {
        const testFilePath = getTestFilePath(optimization.file);

        // Check if test file exists
        const existingTests = await githubClient.getFileContent(
          repository.owner,
          repository.name,
          testFilePath,
          branch
        );

        const updatedTests = existingTests
          ? `${existingTests}\n\n${tests}`
          : tests;

        await githubClient.updateFile(
          repository.owner,
          repository.name,
          testFilePath,
          updatedTests,
          `Add tests for ${optimization.title}`,
          branch
        );

        logger.debug('Added tests for optimization', {
          repository: repository.fullName,
          optimization: optimization.id,
          testFile: testFilePath,
        });
      }
    } catch (error) {
      logger.error('Failed to generate tests for optimization', {
        repository: repository.fullName,
        optimization: optimization.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function applyFileOptimizations(content: string, optimizations: Optimization[]): string {
  let optimizedContent = content;
  const lines = content.split('\n');

  // Sort optimizations by line number in reverse order to avoid offset issues
  const sortedOptimizations = [...optimizations].sort((a, b) => b.lineStart - a.lineStart);

  for (const optimization of sortedOptimizations) {
    try {
      // Replace the code snippet
      const beforeLines = lines.slice(0, optimization.lineStart - 1);
      const afterLines = lines.slice(optimization.lineEnd);

      // Find the exact original code to replace
      const originalSnippet = lines.slice(optimization.lineStart - 1, optimization.lineEnd).join('\n');

      if (originalSnippet.includes(optimization.originalCode.trim()) ||
          optimization.originalCode.includes(originalSnippet.trim())) {

        const newLines = optimization.suggestedCode.split('\n');
        optimizedContent = [...beforeLines, ...newLines, ...afterLines].join('\n');

        logger.debug('Applied optimization to code', {
          optimization: optimization.id,
          linesAffected: newLines.length,
        });
      } else {
        logger.warn('Could not match original code for optimization', {
          optimization: optimization.id,
          expected: optimization.originalCode.slice(0, 50),
          found: originalSnippet.slice(0, 50),
        });
      }
    } catch (error) {
      logger.error('Failed to apply optimization', {
        optimization: optimization.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return optimizedContent;
}

function buildCommitMessage(optimizations: Optimization[]): string {
  const types = [...new Set(optimizations.map(opt => opt.type))];
  const totalGain = optimizations.reduce((sum, opt) => sum + opt.estimatedGain, 0);

  return `Optimize code: ${types.join(', ')}\n\n` +
         `Estimated performance improvement: ${totalGain.toFixed(1)}%\n\n` +
         optimizations.map(opt => `- ${opt.title} (${opt.estimatedGain}% gain)`).join('\n');
}

function buildPRData(
  repository: Repository,
  optimizations: Optimization[],
  branch: string,
  changedFiles: string[]
): PullRequestData {
  const totalGain = optimizations.reduce((sum, opt) => sum + opt.estimatedGain, 0);
  const highImpact = optimizations.filter(opt => opt.severity === 'high').length;

  const title = `🤖 Code Optimizations: ${totalGain.toFixed(1)}% Performance Improvement`;

  const body = `# Code Optimization Suggestions

This pull request contains automated code optimizations suggested by the GitHub Code Optimizer Bot.

## Summary

- **Files Modified**: ${changedFiles.length}
- **Optimizations Applied**: ${optimizations.length}
- **Estimated Performance Gain**: ${totalGain.toFixed(1)}%
- **High Impact Changes**: ${highImpact}

## Optimizations Details

${optimizations.map(opt => `### ${opt.title}
- **Type**: ${opt.type}
- **Severity**: ${opt.severity}
- **Estimated Gain**: ${opt.estimatedGain}%
- **File**: \`${opt.file}\`
- **Description**: ${opt.description}

\`\`\`diff
${opt.originalCode.split('\n').map(line => `-${line}`).join('\n')}
${opt.suggestedCode.split('\n').map(line => `+${line}`).join('\n')}
\`\`\`
`).join('\n\n')}

## Testing

Unit tests have been generated for high-impact optimizations. Please review and run the test suite before merging.

## Verification

- [ ] Code compiles successfully
- [ ] All tests pass
- [ ] Performance benchmarks show improvement
- [ ] No breaking changes introduced

---

*This PR was automatically generated by the GitHub Code Optimizer Bot.*`;

  return {
    title,
    body,
    head: branch,
    base: repository.defaultBranch,
    draft: true, // Create as draft for review
  };
}

function getTestFilePath(sourceFile: string): string {
  const ext = sourceFile.split('.').pop();
  const baseName = sourceFile.replace(/\.[^/.]+$/, '');

  const testExtensions: Record<string, string> = {
    js: '.test.js',
    jsx: '.test.jsx',
    ts: '.test.ts',
    tsx: '.test.tsx',
    py: '_test.py',
    java: 'Test.java',
  };

  return baseName + (testExtensions[ext || ''] || '.test');
}