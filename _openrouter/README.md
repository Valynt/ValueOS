# OpenRouter MCP Server

This is a Model Context Protocol (MCP) server that provides integration with OpenRouter API, allowing access to various AI models through a unified interface.

## Features

- **List Models**: Retrieve a list of available models from OpenRouter
- **Generate Completions**: Create text completions using any supported model

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the project:

   ```bash
   npm run build
   ```

3. Set your OpenRouter API key:
   ```bash
   export OPENROUTER_API_KEY=your_api_key_here
   ```

## Usage

This MCP server is designed to be used with MCP-compatible clients like Claude Desktop or VS Code.

### Configuration in VS Code

The server is configured via the `.vscode/mcp.json` file in this workspace.

### Tools Available

- `list_models`: Lists all available models
- `generate_completion`: Generates text completion
  - Parameters:
    - `model`: Model ID (e.g., "openai/gpt-4o")
    - `prompt`: The text prompt
    - `max_tokens` (optional): Maximum tokens to generate

## Development

To modify or extend the server:

1. Edit `src/index.ts`
2. Run `npm run build` to compile
3. The server will be available at `dist/index.js`

## Requirements

- Node.js 18+
- OpenRouter API key

