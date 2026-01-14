#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔄 ValueOS Database Migration Automation${NC}"
echo "=========================================="

# Configuration
PROJECT_NAME="valueos"
POSTGRES_USER="postgres"
POSTGRES_DB="valuecanvas_dev"

# 1. Wait for database to be ready
echo -e "${YELLOW}⏳ Waiting for database...${NC}"

max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if docker exec ${PROJECT_NAME}-postgres-1 pg_isready -U $POSTGRES_USER -d $POSTGRES_DB &> /dev/null; then
        echo -e "${GREEN}✅ Database is ready${NC}"
        break
    fi

    echo -n "."
    sleep 2
    attempt=$((attempt + 1))
done

if [ $attempt -gt $max_attempts ]; then
    echo -e "\n${RED}❌ Database never became ready${NC}"
    exit 1
fi

# 2. Check if migrations directory exists
if [ ! -d "migrations" ]; then
    echo -e "${YELLOW}⚠️ No migrations directory found, creating...${NC}"
    mkdir -p migrations
    echo -e "${GREEN}✅ Created migrations directory${NC}"
fi

# 3. Run Supabase migrations if available
echo -e "${YELLOW}🔄 Running database migrations...${NC}"

if command -v supabase &> /dev/null && [ -f "supabase/config.toml" ]; then
    echo -e "${BLUE}📦 Using Supabase CLI for migrations${NC}"

    # Check if Supabase is linked
    if supabase status &> /dev/null; then
        if supabase db push; then
            echo -e "${GREEN}✅ Supabase migrations completed${NC}"
        else
            echo -e "${YELLOW}⚠️ Supabase migration failed, trying manual approach${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ Supabase not linked, trying manual approach${NC}"
    fi
fi

# 4. Manual migration approach
echo -e "${YELLOW}📋 Running manual migrations...${NC}"

# Create migrations table if it doesn't exist
docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT NOW(),
    checksum VARCHAR(64)
);
" 2>/dev/null

# Function to run a single migration file
run_migration() {
    local migration_file=$1
    local filename=$(basename "$migration_file")

    echo -e "${YELLOW}📄 Running migration: $filename${NC}"

    # Check if migration already executed
    executed=$(docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM schema_migrations WHERE filename = '$filename';" 2>/dev/null | tr -d ' ')

    if [ "$executed" = "1" ]; then
        echo -e "${GREEN}⏭️ Migration already executed, skipping${NC}"
        return 0
    fi

    # Calculate checksum
    checksum=$(sha256sum "$migration_file" | cut -d' ' -f1)

    # Execute migration
    if docker exec -i ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB < "$migration_file"; then
        # Record migration
        docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
            INSERT INTO schema_migrations (filename, checksum)
            VALUES ('$filename', '$checksum');
        " 2>/dev/null

        echo -e "${GREEN}✅ Migration executed successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Migration failed: $filename${NC}"
        return 1
    fi
}

# 5. Find and run migration files
echo -e "${YELLOW}🔍 Looking for migration files...${NC}"

migration_success=0
migration_failed=0

# Look for SQL migration files in common locations
migration_paths=(
    "migrations/*.sql"
    "supabase/migrations/*.sql"
    "db/migrations/*.sql"
    "database/migrations/*.sql"
)

for path_pattern in "${migration_paths[@]}"; do
    if ls $path_pattern 1> /dev/null 2>&1; then
        echo -e "${BLUE}📁 Found migrations in: $(dirname $path_pattern)${NC}"

        # Sort migration files by name
        for migration_file in $(ls $path_pattern | sort); do
            if run_migration "$migration_file"; then
                migration_success=$((migration_success + 1))
            else
                migration_failed=$((migration_failed + 1))
            fi
        done
    fi
done

# 6. Run package.json migration scripts if available
echo -e "${YELLOW}📦 Running package.json migration scripts...${NC}"

if [ -f "package.json" ]; then
    # Check for common migration scripts
    migration_scripts=("db:migrate" "db:push" "migrate" "migration:run")

    for script in "${migration_scripts[@]}"; do
        if grep -q "\"$script\":" package.json; then
            echo -e "${BLUE}🔄 Running npm run $script${NC}"
            if npm run $script; then
                echo -e "${GREEN}✅ npm run $script completed${NC}"
            else
                echo -e "${YELLOW}⚠️ npm run $script failed${NC}"
            fi
            break
        fi
    done
fi

# 7. Verify database schema
echo -e "${YELLOW}🔍 Verifying database schema...${NC}"

# Count tables
table_count=$(docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")
echo -e "${GREEN}✅ Tables found: $table_count${NC}"

# Show migration status
migration_count=$(docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null | tr -d ' ' || echo "0")
echo -e "${GREEN}✅ Migrations executed: $migration_count${NC}"

# 8. Summary
echo ""
echo -e "${GREEN}✅ Database migration automation complete!${NC}"
echo ""
echo -e "${BLUE}📊 Summary:${NC}"
echo "  Successful migrations: $migration_success"
echo "  Failed migrations: $migration_failed"
echo "  Total tables: $table_count"
echo "  Migration history: $migration_count"
echo ""

if [ $migration_failed -gt 0 ]; then
    echo -e "${RED}⚠️ Some migrations failed. Check the logs above.${NC}"
    echo -e "${YELLOW}💡 You may need to manually fix failed migrations${NC}"
else
    echo -e "${GREEN}🎉 All migrations completed successfully!${NC}"
fi

echo ""
echo -e "${BLUE}🔧 Database connection info:${NC}"
echo "  Host: localhost:5432"
echo "  Database: $POSTGRES_DB"
echo "  User: $POSTGRES_USER"
echo ""
echo -e "${BLUE}📋 Useful commands:${NC}"
echo "  db-connect    - Connect to database"
echo "  npm run db:push - Push schema changes"
echo "  npm run db:reset - Reset database"
