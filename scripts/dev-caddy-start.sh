#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}⚠️  scripts/dev-caddy-start.sh is deprecated.${NC}"
echo -e "${YELLOW}➡️  Use the DX entry point instead: pnpm run dx:docker${NC}"

echo -e "${GREEN}🚀 Launching DX (docker mode with Caddy)...${NC}"
exec pnpm run dx:docker "$@"
