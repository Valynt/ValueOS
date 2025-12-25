import { Optimization } from '../types/index.js';
import { queryTestGeneration } from '../services/aiService.js';
import { logger } from '../utils/logger.js';

export async function generateTests(optimization: Optimization): Promise<string | null> {
  try {
    const language = getLanguageFromFile(optimization.file);

    // Skip test generation for certain types or low-impact optimizations
    if (optimization.severity === 'low' || optimization.type === 'readability') {
      logger.debug('Skipping test generation for low-impact optimization', {
        optimization: optimization.id,
        type: optimization.type,
        severity: optimization.severity,
      });
      return null;
    }

    const prompt = buildTestGenerationPrompt(optimization, language);

    const testCode = await queryTestGeneration(
      optimization.suggestedCode,
      language,
      optimization.description
    );

    if (!testCode) {
      logger.warn('No test code generated', { optimization: optimization.id });
      return null;
    }

    // Clean up the response (remove markdown if present)
    const cleanTestCode = cleanTestCode(testCode, language);

    logger.debug('Generated tests for optimization', {
      optimization: optimization.id,
      language,
      testLength: cleanTestCode.length,
    });

    return cleanTestCode;
  } catch (error) {
    logger.error('Test generation failed', {
      optimization: optimization.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function buildTestGenerationPrompt(optimization: Optimization, language: string): string {
  const framework = getTestFramework(language);

  return `Generate unit tests for this optimized ${language} code using ${framework}.

Optimization: ${optimization.title}
Description: ${optimization.description}

Original code:
${optimization.originalCode}

Optimized code:
${optimization.suggestedCode}

The optimization changes the code from ${optimization.originalCode.length} to ${optimization.suggestedCode.length} characters and should improve ${optimization.type} by approximately ${optimization.estimatedGain}%.

Generate comprehensive tests that verify:
1. The optimization maintains the same functionality
2. Performance is improved (if applicable)
3. Edge cases are handled correctly
4. Error conditions are properly managed

Use ${framework} best practices and include setup/teardown where appropriate.`;
}

function getLanguageFromFile(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    js: 'JavaScript',
    jsx: 'JavaScript',
    ts: 'TypeScript',
    tsx: 'TypeScript',
    py: 'Python',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    cs: 'C#',
    php: 'PHP',
    rb: 'Ruby',
    go: 'Go',
    rs: 'Rust',
  };
  return languageMap[ext || ''] || 'JavaScript';
}

function getTestFramework(language: string): string {
  const frameworkMap: Record<string, string> = {
    JavaScript: 'Jest',
    TypeScript: 'Jest',
    Python: 'pytest',
    Java: 'JUnit',
    'C++': 'Google Test',
    C: 'Check',
    'C#': 'NUnit',
    PHP: 'PHPUnit',
    Ruby: 'RSpec',
    Go: 'testing',
    Rust: 'built-in testing',
  };
  return frameworkMap[language] || 'Jest';
}

function cleanTestCode(testCode: string, language: string): string {
  // Remove markdown code blocks
  let clean = testCode.replace(/```[\w]*\n?/g, '');

  // Remove common AI prefixes
  clean = clean.replace(/^Here are the tests?:\s*/im, '');
  clean = clean.replace(/^Here's how you can test:\s*/im, '');

  // Language-specific cleaning
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'typescript':
      // Ensure Jest-style tests
      if (!clean.includes('describe(') && !clean.includes('test(')) {
        clean = `describe('Optimization Tests', () => {\n${clean}\n});`;
      }
      break;
    case 'python':
      // Ensure pytest-style tests
      if (!clean.includes('def test_')) {
        clean = `import pytest\n\n${clean}`;
      }
      break;
    case 'java':
      // Basic Java test structure
      if (!clean.includes('@Test')) {
        clean = `import org.junit.Test;\nimport static org.junit.Assert.*;\n\npublic class OptimizationTest {\n${clean}\n}`;
      }
      break;
  }

  return clean.trim();
}

export async function generateBenchmarkTests(optimization: Optimization): Promise<string | null> {
  try {
    const language = getLanguageFromFile(optimization.file);

    const prompt = `Generate performance benchmark tests for this code optimization using ${getBenchmarkFramework(language)}.

Optimization: ${optimization.title}
Expected improvement: ${optimization.estimatedGain}%

Original code:
${optimization.originalCode}

Optimized code:
${optimization.suggestedCode}

Generate benchmark tests that measure execution time, memory usage, and other relevant metrics. Include both the original and optimized versions for comparison.`;

    const benchmarkCode = await queryTestGeneration(
      optimization.suggestedCode,
      language,
      `performance benchmarking for ${optimization.description}`
    );

    return benchmarkCode ? cleanTestCode(benchmarkCode, language) : null;
  } catch (error) {
    logger.error('Benchmark test generation failed', {
      optimization: optimization.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function getBenchmarkFramework(language: string): string {
  const frameworkMap: Record<string, string> = {
    JavaScript: 'benchmark.js',
    TypeScript: 'benchmark.js',
    Python: 'timeit or pytest-benchmark',
    Java: 'JMH (Java Microbenchmark Harness)',
    'C++': 'Google Benchmark',
    C: 'custom timing',
    'C#': 'BenchmarkDotNet',
    PHP: 'PHPBench',
    Ruby: 'benchmark gem',
    Go: 'testing.Benchmark',
    Rust: 'criterion',
  };
  return frameworkMap[language] || 'benchmark.js';
}