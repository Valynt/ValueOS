#!/bin/bash
# Database Seed Script
# Populates database with initial data

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ENVIRONMENT=${1:-development}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Database Seed - ${ENVIRONMENT}${NC}"
echo -e "${GREEN}========================================${NC}"

# Check DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    exit 1
fi

# Production safety check
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${RED}⚠️  WARNING: This will seed PRODUCTION database${NC}"
    echo -e "${YELLOW}This should only be done on initial setup!${NC}"
    read -p "Type 'SEED PRODUCTION' to continue: " -r
    echo
    if [[ $REPLY != "SEED PRODUCTION" ]]; then
        echo -e "${YELLOW}Seeding cancelled${NC}"
        exit 0
    fi
fi

# Run seed script
echo -e "\n${YELLOW}Running seed script...${NC}"
NODE_ENV=$ENVIRONMENT npx tsx prisma/seed.ts

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Database seeded successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "\n${RED}========================================${NC}"
    echo -e "${RED}✗ Seeding failed!${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
