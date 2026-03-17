/**
 * Together AI Validation Utilities
 *
 * Helper functions to validate that Together AI is properly configured
 * and that no OpenAI references remain in the codebase.
 */

import { llmConfig } from "../config/llm";
import { validateLLMConfig } from "../config/validateEnv";

export interface ProviderValidationResult {
  isTogetherAI: boolean;
  errors: string[];
  warnings: string[];
  details: {
    configProvider: string;
    embeddingModel: string;
    embeddingDimension: number;
    hasOpenAIReferences: boolean;
  };
}

/**
 * Validates that Together AI is the sole provider throughout the application
 */
export function validateTogetherAIProvider(): ProviderValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check config
  if (llmConfig.provider !== "together") {
    errors.push(`Provider is not 'together': ${llmConfig.provider}`);
  }

  // Check embedding model
  const expectedModel = "togethercomputer/m2-bert-80M-8k-retrieval";
  if (llmConfig.semanticMemory.embeddingModel !== expectedModel) {
    errors.push(
      `Embedding model is not Together AI: ${llmConfig.semanticMemory.embeddingModel}`
    );
  }

  // Check embedding dimensions
  if (llmConfig.semanticMemory.embeddingDimension !== 768) {
    errors.push(
      `Embedding dimension is not 768 (Together AI): ${llmConfig.semanticMemory.embeddingDimension}`
    );
  }

  // Check for OpenAI references in config
  const configStr = JSON.stringify(llmConfig).toLowerCase();
  const hasOpenAIRefs = configStr.includes("openai");

  if (hasOpenAIRefs) {
    warnings.push('Configuration contains "openai" references');
  }

  return {
    isTogetherAI: errors.length === 0,
    errors,
    warnings,
    details: {
      configProvider: llmConfig.provider,
      embeddingModel: llmConfig.semanticMemory.embeddingModel,
      embeddingDimension: llmConfig.semanticMemory.embeddingDimension,
      hasOpenAIReferences: hasOpenAIRefs,
    },
  };
}

/**
 * Validates environment configuration for Together AI
 */
export function validateTogetherAIEnvironment(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  provider: string;
} {
  const result = validateLLMConfig();

  return {
    valid: result.valid && result.provider === "together",
    errors: result.errors,
    warnings: result.warnings,
    provider: result.provider,
  };
}

/**
 * Runtime assertion that Together AI is configured
 * Throws error if not properly configured
 */
export function assertTogetherAIProvider(): void {
  const validation = validateTogetherAIProvider();

  if (!validation.isTogetherAI) {
    const errorMsg = [
      "Together AI is not properly configured!",
      ...validation.errors,
      ...validation.warnings.map((w) => `Warning: ${w}`),
    ].join("\n");

    throw new Error(errorMsg);
  }
}

/**
 * Gets detailed provider information for debugging
 */
export function getProviderInfo(): {
  provider: string;
  embeddingModel: string;
  embeddingDimension: number;
  isTogetherAI: boolean;
  environmentValid: boolean;
} {
  const envValidation = validateTogetherAIEnvironment();
  const providerValidation = validateTogetherAIProvider();

  return {
    provider: llmConfig.provider,
    embeddingModel: llmConfig.semanticMemory.embeddingModel,
    embeddingDimension: llmConfig.semanticMemory.embeddingDimension,
    isTogetherAI: providerValidation.isTogetherAI,
    environmentValid: envValidation.valid,
  };
}

/**
 * Checks if a string contains OpenAI references
 * Useful for scanning code or configuration
 */
export function containsOpenAIReferences(text: string): {
  hasReferences: boolean;
  matches: string[];
} {
  const openaiPatterns = [
    /openai/gi,
    /gpt-[34]/gi,
    /text-embedding-(?:ada|3)/gi,
    /api\.openai\.com/gi,
  ];

  const matches: string[] = [];

  openaiPatterns.forEach((pattern) => {
    const found = text.match(pattern);
    if (found) {
      matches.push(...found);
    }
  });

  return {
    hasReferences: matches.length > 0,
    matches: Array.from(new Set(matches)), // Remove duplicates
  };
}

/**
 * Validates Together API key is present
 */
export function validateTogetherAPIKey(): {
  isConfigured: boolean;
  error?: string;
} {
  // Check for Together API key in environment
  const hasKey =
    (typeof process !== "undefined" && !!process.env.TOGETHER_API_KEY) ||
    (typeof import.meta !== "undefined" &&
      !!(((import.meta as Record<string, unknown>)?.env) as Record<string, string> | undefined)?.TOGETHER_API_KEY);

  return {
    isConfigured: hasKey,
    error: hasKey ? undefined : "TOGETHER_API_KEY is not configured",
  };
}

/**
 * Complete startup validation for Together AI
 * Call this at application startup to ensure proper configuration
 */
export function validateTogetherAIStartup(): {
  success: boolean;
  errors: string[];
  warnings: string[];
  info: Record<string, any>;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate provider
  const providerValidation = validateTogetherAIProvider();
  errors.push(...providerValidation.errors);
  warnings.push(...providerValidation.warnings);

  // 2. Validate environment
  const envValidation = validateTogetherAIEnvironment();
  if (!envValidation.valid) {
    errors.push(...envValidation.errors);
  }
  warnings.push(...envValidation.warnings);

  // 3. Validate API key
  const keyValidation = validateTogetherAPIKey();
  if (!keyValidation.isConfigured && typeof process !== "undefined") {
    warnings.push(keyValidation.error || "API key not configured");
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
    info: {
      provider: providerValidation.details,
      environment: {
        provider: envValidation.provider,
        valid: envValidation.valid,
      },
      apiKey: {
        configured: keyValidation.isConfigured,
      },
    },
  };
}
