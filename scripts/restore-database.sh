#!/bin/bash

# ============================================================================
# Database Restore Script
# ============================================================================
# Restores Supabase PostgreSQL database from S3 backup
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║           Database Restore Script                                    ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Configuration
BACKUP_DIR="/tmp/db_restore"
S3_BUCKET="${S3_BACKUP_BUCKET:-valuecanvas-production-backups}"
S3_PREFIX="database-backups"

# Parse arguments
BACKUP_FILE=""
LIST_BACKUPS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --list)
            LIST_BACKUPS=true
            shift
            ;;
        --file)
            BACKUP_FILE="$2"
            shift 2
            ;;
        --latest)
            BACKUP_FILE="latest"
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--list] [--file FILENAME] [--latest]"
            exit 1
            ;;
    esac
done

# List backups if requested
if [ "$LIST_BACKUPS" = true ]; then
    echo -e "${BLUE}Available backups in S3:${NC}"
    echo ""
    aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" | grep "valuecanvas_backup_" | sort -r
    exit 0
fi

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ ERROR: DATABASE_URL environment variable not set${NC}"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ ERROR: psql not found. Install PostgreSQL client tools.${NC}"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ ERROR: AWS CLI not found. Install AWS CLI.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Get backup file
if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ ERROR: No backup file specified${NC}"
    echo "Usage: $0 --file FILENAME"
    echo "   or: $0 --latest"
    echo "   or: $0 --list"
    exit 1
fi

# Get latest backup if requested
if [ "$BACKUP_FILE" = "latest" ]; then
    echo -e "${YELLOW}Finding latest backup...${NC}"
    BACKUP_FILE=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" | \
        grep "valuecanvas_backup_" | \
        sort -r | \
        head -1 | \
        awk '{print $4}')
    
    if [ -z "$BACKUP_FILE" ]; then
        echo -e "${RED}❌ ERROR: No backups found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Latest backup: ${BACKUP_FILE}${NC}"
fi

# Confirm restore
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will restore the database from backup${NC}"
echo -e "${YELLOW}⚠️  All current data will be replaced!${NC}"
echo ""
echo "Backup file: $BACKUP_FILE"
echo "Database: $(echo $DATABASE_URL | sed 's/:[^:]*@/:***@/')"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${BLUE}Restore cancelled${NC}"
    exit 0
fi

# Create restore directory
mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

# Download backup from S3
echo ""
echo -e "${YELLOW}Downloading backup from S3...${NC}"
S3_PATH="s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}"

aws s3 cp "$S3_PATH" "$BACKUP_FILE"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ ERROR: Failed to download backup${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backup downloaded${NC}"

# Download and verify checksum
echo ""
echo -e "${YELLOW}Verifying checksum...${NC}"

if aws s3 cp "${S3_PATH}.sha256" "${BACKUP_FILE}.sha256" 2>/dev/null; then
    EXPECTED_CHECKSUM=$(cat "${BACKUP_FILE}.sha256")
    ACTUAL_CHECKSUM=$(sha256sum "$BACKUP_FILE" | awk '{print $1}')
    
    if [ "$EXPECTED_CHECKSUM" = "$ACTUAL_CHECKSUM" ]; then
        echo -e "${GREEN}✅ Checksum verified${NC}"
    else
        echo -e "${RED}❌ ERROR: Checksum mismatch!${NC}"
        echo "Expected: $EXPECTED_CHECKSUM"
        echo "Actual:   $ACTUAL_CHECKSUM"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  WARNING: Checksum file not found, skipping verification${NC}"
fi

# Decompress backup
echo ""
echo -e "${YELLOW}Decompressing backup...${NC}"
gunzip "$BACKUP_FILE"

SQL_FILE="${BACKUP_FILE%.gz}"

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ ERROR: Failed to decompress backup${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backup decompressed${NC}"

# Restore database
echo ""
echo -e "${YELLOW}Restoring database...${NC}"
echo -e "${RED}⚠️  This may take several minutes...${NC}"
echo ""

START_TIME=$(date +%s)

# Restore using psql
psql "$DATABASE_URL" < "$SQL_FILE"

if [ $? -eq 0 ]; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo ""
    echo -e "${GREEN}✅ Database restored successfully in ${DURATION}s${NC}"
else
    echo -e "${RED}❌ ERROR: Database restore failed${NC}"
    exit 1
fi

# Cleanup
echo ""
echo -e "${YELLOW}Cleaning up...${NC}"
rm -f "$SQL_FILE" "${BACKUP_FILE}.sha256"
echo -e "${GREEN}✅ Cleanup complete${NC}"

# Summary
echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                      Restore Summary                                 ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Backup file:      $BACKUP_FILE"
echo "Duration:         ${DURATION}s"
echo "Database:         $(echo $DATABASE_URL | sed 's/:[^:]*@/:***@/')"
echo ""
echo -e "${GREEN}✅ Restore completed successfully!${NC}"

# Send notification (optional)
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{
            \"text\": \"✅ Database restored from backup\",
            \"attachments\": [{
                \"color\": \"good\",
                \"fields\": [
                    {\"title\": \"Backup File\", \"value\": \"${BACKUP_FILE}\", \"short\": false},
                    {\"title\": \"Duration\", \"value\": \"${DURATION}s\", \"short\": true}
                ]
            }]
        }" > /dev/null 2>&1 || true
fi

exit 0
