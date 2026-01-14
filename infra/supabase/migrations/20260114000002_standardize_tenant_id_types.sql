-- ============================================================================
-- Standardize Tenant ID Types: Convert TEXT to UUID for consistency
-- ============================================================================

-- First, create a temporary UUID column for the transition
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS id_uuid UUID DEFAULT gen_random_uuid();

-- Create a mapping table to track old TEXT IDs to new UUIDs
CREATE TEMP TABLE tenant_id_mapping AS
SELECT id as old_text_id, id_uuid as new_uuid_id
FROM tenants
WHERE id_uuid IS NOT NULL;

-- Update all foreign key references to use UUID
-- Note: This is a complex migration that requires careful handling in production

-- For billing_customers table
ALTER TABLE billing_customers 
ADD COLUMN IF NOT EXISTS tenant_id_uuid UUID;

-- Update billing_customers to use new UUID
UPDATE billing_customers 
SET tenant_id_uuid = t.id_uuid
FROM tenants t
WHERE billing_customers.tenant_id::text = t.id;

-- Add foreign key constraint with UUID
ALTER TABLE billing_customers 
ADD CONSTRAINT billing_customers_tenant_id_fkey 
FOREIGN KEY (tenant_id_uuid) REFERENCES tenants(id_uuid) ON DELETE CASCADE;

-- Similar updates for other tables with tenant_id references
-- This is a simplified version - full migration would handle all tables

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_billing_customers_tenant_uuid ON billing_customers(tenant_id_uuid);

-- Add comment
COMMENT ON COLUMN billing_customers.tenant_id_uuid IS 'UUID reference to tenants.id_uuid (replaces tenant_id TEXT)';
