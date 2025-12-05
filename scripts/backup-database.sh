#!/bin/bash

# ============================================================================
# Automated Database Backup Script
# ============================================================================
# Backs up Supabase PostgreSQL database to S3 with encryption and verification
# ============================================================================

set -e

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/db_backups"
BACKUP_FILE="valuecanvas_backup_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"
S3_BUCKET="${S3_BACKUP_BUCKET:-valuecanvas-production-backups}"
S3_PREFIX="database-backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-90}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║           Database Backup Script                                     ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ ERROR: DATABASE_URL environment variable not set${NC}"
    exit 1
fi

if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}❌ ERROR: pg_dump not found. Install PostgreSQL client tools.${NC}"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ ERROR: AWS CLI not found. Install AWS CLI.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

# Perform backup
echo -e "${BLUE}Starting database backup...${NC}"
echo "Timestamp: $TIMESTAMP"
echo "Backup file: $BACKUP_FILE"
echo ""

START_TIME=$(date +%s)

# Dump database
echo -e "${YELLOW}Dumping database...${NC}"
pg_dump "$DATABASE_URL" \
    --format=plain \
    --no-owner \
    --no-acl \
    --verbose \
    --file="$BACKUP_FILE" 2>&1 | grep -v "^$" || true

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ ERROR: Backup file not created${NC}"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo -e "${GREEN}✅ Database dumped successfully (${BACKUP_SIZE})${NC}"
echo ""

# Compress backup
echo -e "${YELLOW}Compressing backup...${NC}"
gzip -9 "$BACKUP_FILE"

if [ ! -f "$COMPRESSED_FILE" ]; then
    echo -e "${RED}❌ ERROR: Compressed file not created${NC}"
    exit 1
fi

COMPRESSED_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
echo -e "${GREEN}✅ Backup compressed (${COMPRESSED_SIZE})${NC}"
echo ""

# Calculate checksum
echo -e "${YELLOW}Calculating checksum...${NC}"
CHECKSUM=$(sha256sum "$COMPRESSED_FILE" | awk '{print $1}')
echo "$CHECKSUM" > "${COMPRESSED_FILE}.sha256"
echo -e "${GREEN}✅ Checksum: ${CHECKSUM}${NC}"
echo ""

# Upload to S3
echo -e "${YELLOW}Uploading to S3...${NC}"
S3_PATH="s3://${S3_BUCKET}/${S3_PREFIX}/${COMPRESSED_FILE}"

aws s3 cp "$COMPRESSED_FILE" "$S3_PATH" \
    --storage-class STANDARD_IA \
    --metadata "timestamp=${TIMESTAMP},checksum=${CHECKSUM},size=${COMPRESSED_SIZE}" \
    --server-side-encryption AES256

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backup uploaded to ${S3_PATH}${NC}"
else
    echo -e "${RED}❌ ERROR: Failed to upload backup to S3${NC}"
    exit 1
fi

# Upload checksum
aws s3 cp "${COMPRESSED_FILE}.sha256" "${S3_PATH}.sha256" \
    --server-side-encryption AES256

echo ""

# Verify upload
echo -e "${YELLOW}Verifying upload...${NC}"
if aws s3 ls "$S3_PATH" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backup verified in S3${NC}"
else
    echo -e "${RED}❌ ERROR: Backup not found in S3${NC}"
    exit 1
fi

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
echo ""
echo -e "${BLUE}Backup completed in ${DURATION} seconds${NC}"

# Cleanup local files
echo ""
echo -e "${YELLOW}Cleaning up local files...${NC}"
rm -f "$COMPRESSED_FILE" "${COMPRESSED_FILE}.sha256"
echo -e "${GREEN}✅ Local files cleaned up${NC}"

# Clean up old backups
echo ""
echo -e "${YELLOW}Cleaning up old backups (older than ${RETENTION_DAYS} days)...${NC}"

# List and delete old backups
OLD_BACKUPS=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" | \
    awk '{print $4}' | \
    grep "valuecanvas_backup_" | \
    while read file; do
        # Extract timestamp from filename
        FILE_DATE=$(echo "$file" | grep -oP '\d{8}_\d{6}' | head -1)
        if [ -n "$FILE_DATE" ]; then
            FILE_TIMESTAMP=$(date -d "${FILE_DATE:0:8} ${FILE_DATE:9:2}:${FILE_DATE:11:2}:${FILE_DATE:13:2}" +%s 2>/dev/null || echo "0")
            CUTOFF_TIMESTAMP=$(date -d "${RETENTION_DAYS} days ago" +%s)
            
            if [ "$FILE_TIMESTAMP" -lt "$CUTOFF_TIMESTAMP" ] && [ "$FILE_TIMESTAMP" -gt "0" ]; then
                echo "$file"
            fi
        fi
    done)

if [ -n "$OLD_BACKUPS" ]; then
    echo "$OLD_BACKUPS" | while read file; do
        echo "Deleting old backup: $file"
        aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${file}"
        aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${file}.sha256" 2>/dev/null || true
    done
    echo -e "${GREEN}✅ Old backups cleaned up${NC}"
else
    echo -e "${BLUE}No old backups to clean up${NC}"
fi

# Log backup metadata
echo ""
echo -e "${YELLOW}Logging backup metadata...${NC}"

# Create metadata file
cat > "/tmp/backup_metadata_${TIMESTAMP}.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "backup_file": "${COMPRESSED_FILE}",
  "s3_path": "${S3_PATH}",
  "size": "${COMPRESSED_SIZE}",
  "checksum": "${CHECKSUM}",
  "duration_seconds": ${DURATION},
  "retention_days": ${RETENTION_DAYS},
  "database_url": "$(echo $DATABASE_URL | sed 's/:[^:]*@/:***@/')"
}
EOF

# Upload metadata
aws s3 cp "/tmp/backup_metadata_${TIMESTAMP}.json" \
    "s3://${S3_BUCKET}/${S3_PREFIX}/metadata/backup_${TIMESTAMP}.json" \
    --server-side-encryption AES256

rm -f "/tmp/backup_metadata_${TIMESTAMP}.json"

echo -e "${GREEN}✅ Metadata logged${NC}"

# Summary
echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                      Backup Summary                                  ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Timestamp:        $TIMESTAMP"
echo "Backup file:      $COMPRESSED_FILE"
echo "Size:             $COMPRESSED_SIZE"
echo "Checksum:         $CHECKSUM"
echo "S3 location:      $S3_PATH"
echo "Duration:         ${DURATION}s"
echo "Retention:        ${RETENTION_DAYS} days"
echo ""
echo -e "${GREEN}✅ Backup completed successfully!${NC}"

# Send notification (optional)
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{
            \"text\": \"✅ Database backup completed\",
            \"attachments\": [{
                \"color\": \"good\",
                \"fields\": [
                    {\"title\": \"Timestamp\", \"value\": \"${TIMESTAMP}\", \"short\": true},
                    {\"title\": \"Size\", \"value\": \"${COMPRESSED_SIZE}\", \"short\": true},
                    {\"title\": \"Duration\", \"value\": \"${DURATION}s\", \"short\": true},
                    {\"title\": \"Location\", \"value\": \"${S3_PATH}\", \"short\": false}
                ]
            }]
        }" > /dev/null 2>&1 || true
fi

exit 0
