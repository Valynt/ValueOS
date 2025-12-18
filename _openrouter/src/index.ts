import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import OpenAI from "openai";

// Initialize OpenAI client with OpenRouter base URL
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

// Create server instance
const server = new McpServer({
  name: "openrouter-mcp",
  version: "1.0.0",
});

// Register tools
server.registerTool(
  "list_models",
  {
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const models = await openai.models.list();
      const modelList = models.data.map((model: any) => model.id).join(", ");
      return {
        content: [{ type: "text", text: `Available models: ${modelList}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error listing models: ${error}` }],
      };
    }
  }
);

server.registerTool(
  "generate_completion",
  {
    inputSchema: z.object({
      model: z.string().describe("Model ID (e.g., openai/gpt-4o)"),
      prompt: z.string().describe("Prompt text"),
      max_tokens: z.number().optional().describe("Maximum tokens to generate"),
    }),
  },
  async ({
    model,
    prompt,
    max_tokens = 100,
  }: {
    model: string;
    prompt: string;
    max_tokens?: number;
  }) => {
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens,
      });
      const response = completion.choices[0]?.message?.content || "No response";
      return {
        content: [{ type: "text", text: response }],
      };
    } catch (error) {
      return {
        content: [
          { type: "text", text: `Error generating completion: ${error}` },
        ],
      };
    }
  }
);

// Run the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OpenRouter MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
