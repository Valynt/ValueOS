import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export async function queryAI(
  prompt: string,
  model: string = 'openai/gpt-4o',
  maxTokens: number = 4096
): Promise<string | null> {
  try {
    if (!config.openRouter.apiKey) {
      logger.warn('OpenRouter API key not configured, skipping AI query');
      return null;
    }

    const response = await fetch(`${config.openRouter.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openRouter.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/github-code-optimizer-bot',
        'X-Title': 'GitHub Code Optimizer Bot',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software engineer specializing in code optimization, performance improvements, and best practices. Provide clear, actionable suggestions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: maxTokens,
        temperature: 0.3, // Lower temperature for more consistent results
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenRouter API error', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      return null;
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      logger.error('Invalid OpenRouter response format', { data });
      return null;
    }

    const content = data.choices[0].message.content;

    logger.debug('AI query successful', {
      model,
      promptLength: prompt.length,
      responseLength: content.length,
    });

    return content;
  } catch (error) {
    logger.error('AI query failed', {
      error: error instanceof Error ? error.message : String(error),
      model,
    });
    return null;
  }
}

export async function queryCodeGeneration(
  prompt: string,
  language: string,
  model?: string
): Promise<string | null> {
  const codeGenPrompt = `You are a code generation expert. Generate optimized ${language} code based on the following requirements:

${prompt}

Provide only the code without explanations or markdown formatting. Ensure the code is syntactically correct and follows best practices.`;

  return queryAI(codeGenPrompt, model);
}

export async function queryCodeReview(
  code: string,
  language: string,
  issues: string[],
  model?: string
): Promise<string | null> {
  const reviewPrompt = `Review the following ${language} code and the identified issues. Suggest specific improvements:

Code:
\`\`\`${language}
${code}
\`\`\`

Issues:
${issues.map(issue => `- ${issue}`).join('\n')}

Provide detailed suggestions for optimization and improvement. Focus on performance, readability, and maintainability.`;

  return queryAI(reviewPrompt, model);
}

export async function queryTestGeneration(
  code: string,
  language: string,
  functionality: string,
  model?: string
): Promise<string | null> {
  const testPrompt = `Generate unit tests for the following ${language} code. The code implements: ${functionality}

Code:
\`\`\`${language}
${code}
\`\`\`

Generate comprehensive unit tests that cover:
1. Normal operation
2. Edge cases
3. Error conditions
4. Performance considerations

Provide the test code in the appropriate testing framework for ${language}.`;

  return queryAI(testPrompt, model);
}