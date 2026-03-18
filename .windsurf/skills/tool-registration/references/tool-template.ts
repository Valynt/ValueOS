/**
 * MyTool
 *
 * [One-line description of what this tool does and which external system it wraps.]
 *
 * Replace all <MyTool> / <my-tool> placeholders before use.
 */

import {
  BaseTool,
  type JSONSchema,
  type ToolExecutionContext,
  type ToolResult,
} from "../ToolRegistry.js";

// ---------------------------------------------------------------------------
// Parameter types — mirror the JSON Schema below for type safety
// ---------------------------------------------------------------------------

interface MyToolParams {
  requiredParam: string;
  optionalParam?: string;
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export class MyTool extends BaseTool {
  // Unique kebab-case identifier — agents use this to call the tool
  name = "my-tool";

  // Agent-readable description — be specific about what the tool returns
  description = "Fetches [X] from [system] given [input]. Returns [Y].";

  // JSON Schema for parameters — agents use this to construct calls
  parameters: JSONSchema = {
    type: "object",
    properties: {
      requiredParam: {
        type: "string",
        description: "Description of what this param controls",
      },
      optionalParam: {
        type: "string",
        description: "Description of what this param controls",
      },
    },
    required: ["requiredParam"],
  };

  metadata = {
    version: "1.0.0",
    category: "integration", // "integration" | "data" | "compute" | "ui"
    tags: ["<tag1>", "<tag2>"],
  };

  async execute(
    params: MyToolParams,
    _context?: ToolExecutionContext,
  ): Promise<ToolResult> {
    try {
      // Validate required params (BaseTool.validate() handles JSON Schema
      // checks, but add domain-level validation here if needed)
      if (!params.requiredParam.trim()) {
        return {
          success: false,
          error: {
            code: "INVALID_PARAM",
            message: "requiredParam must not be empty",
          },
        };
      }

      // Call external system / compute result
      const result = await this.fetchData(params.requiredParam);

      return {
        success: true,
        data: result,
        metadata: {
          // Optional: surface cost/token usage if the call has a cost
        },
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: "TOOL_EXECUTION_ERROR",
          message: (err as Error).message,
        },
      };
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async fetchData(input: string): Promise<unknown> {
    // Replace with real implementation
    throw new Error(`fetchData not implemented for input: ${input}`);
  }
}
