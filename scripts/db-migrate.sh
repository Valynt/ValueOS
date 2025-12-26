#!/bin/bash
# Database Migration Script
# Runs Prisma migrations with safety checks

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ENVIRONMENT=${1:-development}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Database Migration - ${ENVIRONMENT}${NC}"
echo -e "${GREEN}========================================${NC}"

# Check prerequisites
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx is not installed${NC}"
    exit 1
fi

# Check DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    exit 1
fi

echo -e "${YELLOW}Database URL: ${DATABASE_URL}${NC}"

# Production safety check
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${RED}⚠️  WARNING: This will run migrations on PRODUCTION${NC}"
    read -p "Type 'MIGRATE PRODUCTION' to continue: " -r
    echo
    if [[ $REPLY != "MIGRATE PRODUCTION" ]]; then
        echo -e "${YELLOW}Migration cancelled${NC}"
        exit 0
    fi
fi

# Create backup (production only)
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "\n${YELLOW}Creating database backup...${NC}"
    BACKUP_FILE="backups/db-backup-$(date +%Y%m%d_%H%M%S).sql"
    mkdir -p backups
    
    pg_dump "$DATABASE_URL" > "$BACKUP_FILE" || {
        echo -e "${RED}Backup failed!${NC}"
        exit 1
    }
    
    echo -e "${GREEN}✓ Backup saved to ${BACKUP_FILE}${NC}"
fi

# Generate Prisma Client
echo -e "\n${YELLOW}Generating Prisma Client...${NC}"
npx prisma generate

# Run migrations
echo -e "\n${YELLOW}Running migrations...${NC}"
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Migrations completed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "\n${RED}========================================${NC}"
    echo -e "${RED}✗ Migration failed!${NC}"
    echo -e "${RED}========================================${NC}"
    
    if [ "$ENVIRONMENT" = "production" ] && [ -f "$BACKUP_FILE" ]; then
        echo -e "${YELLOW}Backup available at: ${BACKUP_FILE}${NC}"
        echo -e "${YELLOW}To restore: psql \$DATABASE_URL < ${BACKUP_FILE}${NC}"
    fi
    
    exit 1
fi

# Show migration status
echo -e "\n${YELLOW}Migration Status:${NC}"
npx prisma migrate status

echo -e "\n${GREEN}Done!${NC}"
