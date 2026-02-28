import { BotConfig, CodeAnalysis, Optimization } from '../types/index.js';
import { queryAI } from '../services/aiService.js';
import { logger } from '../utils/logger.js';

export async function generateOptimizations(
  filePath: string,
  content: string,
  staticIssues: CodeAnalysis[],
  config: BotConfig
): Promise<Optimization[]> {
  const optimizations: Optimization[] = [];

  try {
    // Generate AI-based optimizations for the entire file
    const aiOptimizations = await generateAIOptimizations(filePath, content, staticIssues, config);
    optimizations.push(...aiOptimizations);

    // Generate specific optimizations based on static analysis issues
    for (const issue of staticIssues) {
      const specificOptimizations = await generateIssueSpecificOptimizations(
        filePath,
        content,
        issue,
        config
      );
      optimizations.push(...specificOptimizations);
    }

    // Filter and rank optimizations
    const filteredOptimizations = filterAndRankOptimizations(optimizations, config);

    logger.debug('Generated optimizations', {
      file: filePath,
      total: optimizations.length,
      filtered: filteredOptimizations.length,
    });

    return filteredOptimizations;
  } catch (error) {
    logger.error('Failed to generate optimizations', {
      file: filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function generateAIOptimizations(
  filePath: string,
  content: string,
  staticIssues: CodeAnalysis[],
  config: BotConfig
): Promise<Optimization[]> {
  const optimizations: Optimization[] = [];

  try {
    const prompt = buildOptimizationPrompt(filePath, content, staticIssues, config);

    const aiResponse = await queryAI(prompt, config.ai.model, config.ai.maxTokens);

    if (!aiResponse) return optimizations;

    // Parse AI response and extract optimizations
    const parsedOptimizations = parseAIResponse(aiResponse, filePath, content);

    optimizations.push(...parsedOptimizations);
  } catch (error) {
    logger.error('AI optimization generation failed', {
      file: filePath,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return optimizations;
}

async function generateIssueSpecificOptimizations(
  filePath: string,
  content: string,
  issue: CodeAnalysis,
  config: BotConfig
): Promise<Optimization[]> {
  const optimizations: Optimization[] = [];

  try {
    const prompt = buildIssueSpecificPrompt(filePath, content, issue, config);

    const aiResponse = await queryAI(prompt, config.ai.model, config.ai.maxTokens);

    if (!aiResponse) return optimizations;

    // Parse response for specific issue
    const parsedOptimization = parseIssueSpecificResponse(aiResponse, filePath, content, issue);

    if (parsedOptimization) {
      optimizations.push(parsedOptimization);
    }
  } catch (error) {
    logger.error('Issue-specific optimization generation failed', {
      file: filePath,
      issue: issue.rule,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return optimizations;
}

function buildOptimizationPrompt(
  filePath: string,
  content: string,
  staticIssues: CodeAnalysis[],
  config: BotConfig
): string {
  const language = getLanguageFromPath(filePath);

  return `You are an expert code optimizer. Analyze the following ${language} code file and suggest specific optimizations for performance, readability, and maintainability.

File: ${filePath}
Language: ${language}

Code:
\`\`\`${language}
${content}
\`\`\`

${staticIssues.length > 0 ? `Static Analysis Issues Found:
${staticIssues.map(issue => `- ${issue.message} (line ${issue.line})`).join('\n')}

` : ''}Please provide 2-3 specific optimization suggestions in the following JSON format:

[
  {
    "type": "performance|complexity|readability|security|maintainability",
    "title": "Brief title of the optimization",
    "description": "Detailed explanation of the optimization",
    "estimatedGain": 15,
    "originalSnippet": "Original code snippet",
    "optimizedSnippet": "Optimized code snippet",
    "lineStart": 10,
    "lineEnd": 15
  }
]

Focus on optimizations that provide at least ${config.thresholds.performanceGain * 100}% improvement. Only suggest changes that are safe and maintain functionality.`;
}

function buildIssueSpecificPrompt(
  filePath: string,
  content: string,
  issue: CodeAnalysis,
  config: BotConfig
): string {
  const language = getLanguageFromPath(filePath);
  const lines = content.split('\n');
  const contextStart = Math.max(0, issue.line - 6);
  const contextEnd = Math.min(lines.length, issue.line + 4);
  const context = lines.slice(contextStart, contextEnd).join('\n');

  return `You are a code optimization expert. A static analysis tool found this issue:

Issue: ${issue.message}
Rule: ${issue.rule}
File: ${filePath}
Line: ${issue.line}

Context around the issue:
\`\`\`${language}
${context}
\`\`\`

Please provide a specific optimization to fix this issue. Respond in JSON format:

{
  "type": "performance|complexity|readability|security|maintainability",
  "title": "Brief title",
  "description": "Why this optimization helps",
  "estimatedGain": 10,
  "originalSnippet": "The problematic code",
  "optimizedSnippet": "The improved code",
  "lineStart": ${issue.line},
  "lineEnd": ${issue.line}
}

Only suggest safe optimizations that maintain functionality.`;
}

function parseAIResponse(response: string, filePath: string, content: string): Optimization[] {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const optimizations = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;

    return optimizations.map((opt: Record<string, unknown>, index: number) => ({
      id: `${filePath}-${Date.now()}-${index}`,
      file: filePath,
      type: opt.type || 'performance',
      title: opt.title || 'Code Optimization',
      description: opt.description || '',
      severity: getSeverityFromType(opt.type),
      estimatedGain: opt.estimatedGain || 10,
      originalCode: opt.originalSnippet || '',
      suggestedCode: opt.optimizedSnippet || '',
      lineStart: opt.lineStart || 1,
      lineEnd: opt.lineEnd || 1,
      aiAnalysis: response,
    }));
  } catch (error) {
    logger.error('Failed to parse AI optimization response', { error });
    return [];
  }
}

function parseIssueSpecificResponse(
  response: string,
  filePath: string,
  content: string,
  issue: CodeAnalysis
): Optimization | null {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const opt = JSON.parse(jsonMatch[0]);

    return {
      id: `${filePath}-${issue.rule}-${Date.now()}`,
      file: filePath,
      type: opt.type || 'performance',
      title: opt.title || 'Issue Fix',
      description: opt.description || '',
      severity: getSeverityFromType(opt.type),
      estimatedGain: opt.estimatedGain || 10,
      originalCode: opt.originalSnippet || '',
      suggestedCode: opt.optimizedSnippet || '',
      lineStart: opt.lineStart || issue.line,
      lineEnd: opt.lineEnd || issue.line,
      aiAnalysis: response,
    };
  } catch (error) {
    logger.error('Failed to parse issue-specific AI response', { error });
    return null;
  }
}

function filterAndRankOptimizations(optimizations: Optimization[], config: BotConfig): Optimization[] {
  return optimizations
    .filter(opt => opt.estimatedGain >= config.thresholds.performanceGain * 100)
    .sort((a, b) => b.estimatedGain - a.estimatedGain)
    .slice(0, 10); // Limit to top 10 optimizations per file
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
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
  };
  return languageMap[ext || ''] || 'text';
}

function getSeverityFromType(type: string): 'low' | 'medium' | 'high' {
  const severityMap: Record<string, 'low' | 'medium' | 'high'> = {
    performance: 'high',
    security: 'high',
    complexity: 'medium',
    readability: 'low',
    maintainability: 'medium',
  };
  return severityMap[type] || 'medium';
}