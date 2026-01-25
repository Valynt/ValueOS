#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🌱 Seeding ValueOS Development Data${NC}"
echo "===================================="

# Configuration
PROJECT_NAME="valueos"
POSTGRES_USER="postgres"
POSTGRES_DB="valuecanvas_dev"

# 1. Wait for database to be ready
echo -e "${YELLOW}⏳ Waiting for database...${NC}"

max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if docker exec valueos-postgres pg_isready -U $POSTGRES_USER -d $POSTGRES_DB &> /dev/null; then
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

# 2. Run database migrations
echo -e "${YELLOW}🔄 Running database migrations...${NC}"

if [ -f "package.json" ] && grep -q "db:push" package.json; then
    if pnpm run db:push; then
        echo -e "${GREEN}✅ Migrations completed${NC}"
    else
        echo -e "${YELLOW}⚠️ Migration failed, continuing with seeding...${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ No db:push script found, skipping migrations${NC}"
fi

# 3. Seed development data
echo -e "${YELLOW}📊 Seeding development data...${NC}"

# Create development user
echo -e "${YELLOW}👤 Creating development user...${NC}"
docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
INSERT INTO users (id, email, name, role, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'dev@valueos.local',
    'Development User',
    'admin',
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    updated_at = NOW();
" 2>/dev/null || echo -e "${YELLOW}⚠️ Users table may not exist yet${NC}"

# Create sample organization
echo -e "${YELLOW}🏢 Creating sample organization...${NC}"
docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
INSERT INTO organizations (id, name, slug, domain, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'ValueOS Development',
    'valueos-dev',
    'dev.valueos.local',
    NOW(),
    NOW()
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    domain = EXCLUDED.domain,
    updated_at = NOW();
" 2>/dev/null || echo -e "${YELLOW}⚠️ Organizations table may not exist yet${NC}"

# Create sample projects
echo -e "${YELLOW}📁 Creating sample projects...${NC}"
docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
INSERT INTO projects (id, name, slug, description, status, created_at, updated_at)
VALUES
    (
        gen_random_uuid(),
        'Demo Project',
        'demo-project',
        'A demonstration project for ValueOS',
        'active',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'API Integration',
        'api-integration',
        'API integration testing project',
        'active',
        NOW(),
        NOW()
    )
ON CONFLICT (slug) DO NOTHING;
" 2>/dev/null || echo -e "${YELLOW}⚠️ Projects table may not exist yet${NC}"

# Create sample configuration data
echo -e "${YELLOW}⚙️ Creating sample configuration...${NC}"
docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
INSERT INTO configurations (id, key, value, description, created_at, updated_at)
VALUES
    (
        gen_random_uuid(),
        'app.name',
        'ValueOS Development',
        'Application name',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'app.version',
        '1.0.0-dev',
        'Application version',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'features.analytics',
        'true',
        'Enable analytics features',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'features.billing',
        'false',
        'Enable billing features (disabled in dev)',
        NOW(),
        NOW()
    )
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();
" 2>/dev/null || echo -e "${YELLOW}⚠️ Configurations table may not exist yet${NC}"

# 4. Insert test data for development
echo -e "${YELLOW}🧪 Creating test data...${NC}"

# Create sample API keys for testing
docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
INSERT INTO api_keys (id, name, key_hash, permissions, created_at, expires_at)
VALUES (
    gen_random_uuid(),
    'Development API Key',
        crypt('dev-key-12345', gen_salt('bf')),
    '{\"read\": true, \"write\": true, \"admin\": true}',
    NOW(),
    NOW() + INTERVAL '1 year'
) ON CONFLICT (name) DO NOTHING;
" 2>/dev/null || echo -e "${YELLOW}⚠️ API keys table may not exist yet${NC}"

# Create sample audit logs
docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, created_at)
SELECT
    gen_random_uuid(),
    u.id,
    'login',
    'user',
    u.id,
    '{\"ip\": \"127.0.0.1\", \"user_agent\": \"Development Environment\"}',
    NOW()
FROM users u
WHERE u.email = 'dev@valueos.local'
LIMIT 1
ON CONFLICT DO NOTHING;
" 2>/dev/null || echo -e "${YELLOW}⚠️ Audit logs table may not exist yet${NC}"

# 5. Verify data seeding
echo -e "${YELLOW}🔍 Verifying seeded data...${NC}"

# Check if we have any users
user_count=$(docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "0")
echo -e "${GREEN}✅ Users: $user_count${NC}"

# Check if we have any organizations
org_count=$(docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM organizations;" 2>/dev/null | tr -d ' ' || echo "0")
echo -e "${GREEN}✅ Organizations: $org_count${NC}"

# Check if we have any projects
project_count=$(docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM projects;" 2>/dev/null | tr -d ' ' || echo "0")
echo -e "${GREEN}✅ Projects: $project_count${NC}"

# Check if we have any configurations
config_count=$(docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM configurations;" 2>/dev/null | tr -d ' ' || echo "0")
echo -e "${GREEN}✅ Configurations: $config_count${NC}"

# 6. Create development helper data
echo -e "${YELLOW}🛠️ Creating development helpers...${NC}"

# Create a simple health check record
docker exec ${PROJECT_NAME}-postgres-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
CREATE TABLE IF NOT EXISTS dev_health_check (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    checked_at TIMESTAMP DEFAULT NOW(),
    message TEXT
);

INSERT INTO dev_health_check (service_name, status, message)
VALUES
    ('database', 'healthy', 'Database is ready for development'),
    ('seeding', 'completed', 'Development data seeded successfully')
ON CONFLICT (service_name) DO UPDATE SET
    status = EXCLUDED.status,
    message = EXCLUDED.message,
    checked_at = NOW();
" 2>/dev/null

echo ""
echo -e "${GREEN}✅ Development data seeding complete!${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo "  Development user: dev@valueos.local"
echo "  Sample organization: ValueOS Development"
echo "  Sample projects: Demo Project, API Integration"
echo "  Configuration entries: $config_count"
echo ""
echo -e "${BLUE}🔧 Database connection:${NC}"
echo "  Host: localhost:5432"
echo "  Database: $POSTGRES_DB"
echo "  User: $POSTGRES_USER"
echo ""
echo -e "${GREEN}🎉 Ready for development!${NC}"
