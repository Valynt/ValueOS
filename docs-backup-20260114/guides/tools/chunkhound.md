# ChunkHound - Codebase Intelligence

ChunkHound provides semantic search and code exploration capabilities for the ValueOS codebase.

## What is ChunkHound?

ChunkHound is a local-first codebase intelligence tool that enables:

- **Semantic search**: Find code using natural language queries like "authentication logic"
- **Multi-hop discovery**: Discover interconnected code relationships across modules
- **MCP integration**: Works with Claude, VS Code, Cursor, and other MCP-compatible tools
- **Research-backed**: Uses the cAST algorithm for intelligent code chunking

## Installation

### Prerequisites

- Python 3.10+
- [uv package manager](https://docs.astral.sh/uv/)

### Install ChunkHound

```bash
# Install uv if needed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install ChunkHound
uv tool install chunkhound
```

### Configure API Keys

ChunkHound requires an embedding provider. We recommend VoyageAI:

1. Get a VoyageAI API key: https://dash.voyageai.com/
2. Set the environment variable:
   ```bash
   export VOYAGE_API_KEY="your-key-here"
   ```

Alternatively, you can use:

- **OpenAI**: Set `OPENAI_API_KEY` and update `.chunkhound.json`
- **Ollama (local)**: No API key needed, update provider to `ollama`

## Usage

### Index the Codebase

```bash
# Initial indexing (run from project root)
chunkhound index

# Re-index after major changes
chunkhound index --force
```

### Semantic Search

```bash
# Natural language search
chunkhound search "authentication and authorization logic"

# Find specific patterns
chunkhound search "SDUI component rendering"

# Multi-hop search (discovers related code)
chunkhound search "billing integration" --hops 3
```

### Regex Search (No API Key Required)

```bash
# Pattern matching
chunkhound search -r "import.*auth"

# Find TODO comments
chunkhound search -r "TODO|FIXME"
```

### IDE Integration

ChunkHound works with MCP-compatible tools:

**VS Code / Cursor / Windsurf:**

1. Install the MCP extension
2. ChunkHound will automatically be available via MCP
3. Use natural language queries in your editor

**Claude Desktop:**
ChunkHound integrates seamlessly with Claude Code CLI.

## Configuration

The `.chunkhound.json` file configures:

- **Embedding provider**: VoyageAI (default), OpenAI, or Ollama
- **LLM**: Claude Code CLI for code analysis
- **Indexing**: File patterns to include/exclude
- **Search**: Multi-hop settings

Edit `.chunkhound.json` to customize for your workflow.

## Tips

### Security & Privacy

- ChunkHound is **local-first**: your code stays on your machine
- Embeddings are generated locally, only vectors are sent to API
- Perfect for security-sensitive codebases

### Performance

- Initial indexing may take a few minutes for large codebases
- Subsequent indexes are incremental and fast
- Enable `watch: true` for real-time indexing

### Best Practices

1. **Run initial index** before starting development
2. **Use semantic search** to understand unfamiliar code areas
3. **Enable multi-hop** to discover cross-module dependencies
4. **Combine with GritQL** for search + refactoring workflows

## Troubleshooting

### Index fails with import errors

```bash
# Ensure Python 3.10+ is active
python --version

# Reinstall chunkhound
uv tool uninstall chunkhound
uv tool install chunkhound
```

### Search returns no results

```bash
# Verify index exists
ls -la .chunkhound/

# Re-index
chunkhound index --force
```

### API key errors

```bash
# Verify environment variable
echo $VOYAGE_API_KEY

# Or use .env file
export VOYAGE_API_KEY="your-key"
```

## Learn More

- [ChunkHound Documentation](https://chunkhound.github.io)
- [Tutorial](https://chunkhound.github.io/tutorial/)
- [Architecture Deep Dive](https://chunkhound.github.io/under-the-hood/)
