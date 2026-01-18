---
description: Open-source codebase indexing using Ollama and ChunkHound
---

# Open-Source Codebase Indexing Skill

## Overview

Sets up and manages a completely free, open-source codebase indexing solution using local Ollama embeddings and ChunkHound for semantic search.

## Prerequisites

- Docker or local installation permissions
- Python 3.10+ environment
- Sufficient RAM (2GB+ recommended)

## Setup Commands

### 1. Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Start Ollama Service

```bash
nohup ollama serve > ollama.log 2>&1 &
```

### 3. Pull Embedding Model

```bash
ollama pull nomic-embed-text
```

### 4. Install ChunkHound

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
uv tool install chunkhound
```

### 5. Configure Indexing

Create `.chunkhound.json`:

```json
{
  "embedding": {
    "provider": "openai",
    "model": "nomic-embed-text",
    "base_url": "http://localhost:11434/v1",
    "api_key": "ollama"
  },
  "indexing": {
    "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "docs/**/*.md"],
    "exclude": ["node_modules/**", "dist/**", ".git/**"],
    "watch": true
  }
}
```

### 6. Index Codebase

```bash
chunkhound index --config .chunkhound.json --force-reindex
```

## Usage

### Regex Search (No embeddings required)

```bash
chunkhound search --regex "pattern" --config .chunkhound.json
```

### Semantic Search (Natural language)

```bash
chunkhound search "authentication logic" --config .chunkhound.json
```

## Verification Commands

### Check Ollama Status

```bash
curl -s http://localhost:11434/api/version
```

### Test Embedding Generation

```bash
curl -s http://localhost:11434/v1/embeddings -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ollama" \
  -d '{"model":"nomic-embed-text","input":"test"}'
```

### Search Test

```bash
chunkhound search --regex "test" --config .chunkhound.json
```

## Troubleshooting

### Ollama Issues

```bash
# Restart Ollama
pkill ollama
nohup ollama serve > ollama.log 2>&1 &

# Check logs
tail -f ollama.log
```

### ChunkHound Issues

```bash
# Reinstall
uv tool uninstall chunkhound
uv tool install chunkhound

# Verify installation
export PATH="$HOME/.local/bin:$PATH"
which chunkhound
```

## Performance Metrics

### Expected Performance

- **Initial indexing**: 3-5 minutes for full codebase
- **Incremental updates**: 10-30 seconds
- **Search response**: <1 second (regex), <2 seconds (semantic)
- **Memory usage**: ~2GB RAM

### Cost Comparison

- **Previous (VoyageAI)**: ~$0.10 per 1K tokens
- **Current (Ollama)**: $0.00 - completely free

## Integration Points

### IDE Integration

The setup works with MCP-compatible editors:

- VS Code with MCP extension
- Cursor/Windsurf (built-in MCP)
- Claude Desktop

### CI/CD Integration

Add to pipeline for automated code documentation:

```bash
# Index before documentation generation
chunkhound index --config .chunkhound.json
chunkhound search "API endpoints" --config .chunkhound.json > api_inventory.md
```

## Maintenance

### Regular Tasks

1. **Update Ollama**: `ollama pull nomic-embed-text` (monthly)
2. **Reindex**: `chunkhound index --force-reindex` (weekly)
3. **Clean cache**: Remove `.chunkhound/` directory if bloated

### Monitoring

- Monitor Ollama log file for errors
- Check embedding generation performance
- Validate search result quality

## Success Criteria

- ✅ Ollama serving embeddings locally
- ✅ ChunkHound successfully installed
- ✅ Regex search returns results
- ✅ Semantic search functional
- ✅ Zero external API costs
- ✅ Local processing only
