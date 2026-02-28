/**
 * Backend for Agents (BFA) Base Tool Implementation
 *
 * Abstract base class for semantic tools with common functionality
 * including validation, telemetry, and error handling.
 */

import { z } from "zod";

import { logger } from "../../lib/logger.js"

import { BfaTelemetry } from "./telemetry.js"
import {
  AgentContext,
  BFAError,
  BusinessLogicError,
  SemanticTool,
  ToolExecutionResult,
  ValidationError,
} from "./types";

/**
 * Abstract base class for semantic tools
 */
export abstract class BaseSemanticTool<TInput, TOutput> implements SemanticTool<
  TInput,
  TOutput
> {
  abstract id: string;
  abstract description: string;
  abstract inputSchema: z.ZodSchema<TInput>;
  abstract outputSchema: z.ZodSchema<TOutput>;
  abstract policy: {
    resource: string;
    action: string;
    requiredPermissions?: string[];
  };

  /**
   * Override to configure telemetry options
   */
  telemetry = {
    trackMetrics: true,
    logInputs: false,
    logOutputs: false,
  };

  /**
   * Execute the semantic operation with built-in validation and telemetry
   */
  async execute(input: TInput, context: AgentContext): Promise<TOutput> {
    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = await this.validateInput(input);

      // Log execution start if enabled
      if (this.telemetry.logInputs) {
        logger.info("BFA tool execution started", {
          toolId: this.id,
          userId: context.userId,
          tenantId: context.tenantId,
          input: this.sanitizeForLogging(validatedInput),
        });
      }

      // Execute the actual business logic
      const result = await this.executeBusinessLogic(validatedInput, context);

      // Validate output
      const validatedOutput = await this.validateOutput(result);

      // Create execution result
      const executionResult: ToolExecutionResult<TOutput> = {
        data: validatedOutput,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          toolId: this.id,
          userId: context.userId,
          tenantId: context.tenantId,
          success: true,
        },
      };

      // Log execution success if enabled
      if (this.telemetry.logOutputs) {
        logger.info("BFA tool execution completed", {
          toolId: this.id,
          userId: context.userId,
          tenantId: context.tenantId,
          output: this.sanitizeForLogging(validatedOutput),
          executionTimeMs: executionResult.metadata.executionTimeMs,
        });
      }

      // Record telemetry if enabled
      if (this.telemetry.trackMetrics) {
        BfaTelemetry.recordExecution(
          this.id,
          context,
          executionResult.metadata.executionTimeMs,
          executionResult
        );
      }

      return validatedOutput;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      // Record error telemetry if enabled
      if (this.telemetry.trackMetrics) {
        BfaTelemetry.recordExecution(
          this.id,
          context,
          executionTimeMs,
          error instanceof Error ? error : new Error("Unknown error")
        );
      }

      // Log error
      logger.error(
        "BFA tool execution failed",
        error instanceof Error ? error : undefined,
        {
          toolId: this.id,
          userId: context.userId,
          tenantId: context.tenantId,
          executionTimeMs,
        }
      );

      throw error;
    }
  }

  /**
   * Abstract method that must be implemented by concrete tools
   */
  protected abstract executeBusinessLogic(
    input: TInput,
    context: AgentContext
  ): Promise<TOutput>;

  /**
   * Validate input against schema
   */
  private async validateInput(input: TInput): Promise<TInput> {
    try {
      return await this.inputSchema.parseAsync(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.reduce(
          (acc, err) => {
            acc[err.path.join(".")] = err.message;
            return acc;
          },
          {} as Record<string, string>
        );

        throw new ValidationError(
          `Input validation failed for tool '${this.id}'`,
          validationErrors
        );
      }
      throw new ValidationError(
        `Input validation failed for tool '${this.id}'`,
        { unknown: "Validation error" }
      );
    }
  }

  /**
   * Validate output against schema
   */
  private async validateOutput(output: TOutput): Promise<TOutput> {
    try {
      return await this.outputSchema.parseAsync(output);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.reduce(
          (acc, err) => {
            acc[err.path.join(".")] = err.message;
            return acc;
          },
          {} as Record<string, string>
        );

        throw new ValidationError(
          `Output validation failed for tool '${this.id}'`,
          validationErrors
        );
      }
      throw new ValidationError(
        `Output validation failed for tool '${this.id}'`,
        { unknown: "Validation error" }
      );
    }
  }

  /**
   * Sanitize data for logging to prevent sensitive data exposure
   */
  private sanitizeForLogging(data: any): any {
    if (typeof data !== "object" || data === null) {
      return data;
    }

    const sensitiveFields = [
      "password",
      "token",
      "secret",
      "key",
      "apiKey",
      "auth",
      "creditCard",
      "ssn",
      "socialSecurity",
      "email",
      "phone",
    ];

    const sanitized = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      if (
        sensitiveFields.some((field) =>
          key.toLowerCase().includes(field.toLowerCase())
        )
      ) {
        (sanitized as any)[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        (sanitized as any)[key] = this.sanitizeForLogging(value);
      } else {
        (sanitized as any)[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Helper method to create business logic errors
   */
  protected createBusinessError(
    message: string,
    rule: string
  ): BusinessLogicError {
    return new BusinessLogicError(message, rule);
  }

  /**
   * Helper method to check tenant access
   */
  protected async checkTenantAccess(
    tenantId: string,
    context: AgentContext,
    requiredFeature?: string
  ): Promise<void> {
    if (context.tenantId !== tenantId) {
      throw new BFAError("Tenant access denied", "TENANT_ACCESS_DENIED", {
        expectedTenant: tenantId,
        actualTenant: context.tenantId,
      });
    }

    // Add additional feature checks here if needed
    if (requiredFeature) {
      // Placeholder for feature flag checking
      // await this.checkFeatureEnabled(requiredFeature, context.tenantId);
    }
  }
}
