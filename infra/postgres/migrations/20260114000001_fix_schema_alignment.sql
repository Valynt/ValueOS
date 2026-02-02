-- ============================================================================
-- Fix Schema Alignment: Add tier field to tenants table for consistency
-- ============================================================================

-- Add tier field to tenants table to match Prisma Organization model
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'standard', 'enterprise'));

-- Add limits JSON field to match Prisma Organization.limits
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS limits JSONB DEFAULT '{"max_users": 5, "max_agents": 3, "api_calls_per_month": 10000}'::jsonb;

-- Update existing tenants to have default tier and limits
UPDATE tenants 
SET tier = 'free', 
    limits = '{"max_users": 5, "max_agents": 3, "api_calls_per_month": 10000}'::jsonb
WHERE tier IS NULL OR limits IS NULL;

-- Add index for tier queries
CREATE INDEX IF NOT EXISTS idx_tenants_tier ON tenants(tier);

-- Add comment for documentation
COMMENT ON COLUMN tenants.tier IS 'Tenant subscription tier (free/standard/enterprise)';
COMMENT ON COLUMN tenants.limits IS 'JSON limits configuration matching Prisma Organization.limits';
