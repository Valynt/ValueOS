-- ============================================================================
-- Standardize Tenant ID Types: Convert TEXT to UUID for consistency
-- ============================================================================

-- First, create a temporary UUID column for the transition
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'id_uuid')
ALTER TABLE tenants ADD id_uuid UNIQUEIDENTIFIER DEFAULT NEWID();

-- Create a mapping table to track old TEXT IDs to new UUIDs
SELECT id as old_text_id, id_uuid as new_uuid_id INTO #tenant_id_mapping FROM tenants WHERE id_uuid IS NOT NULL;

-- Update all foreign key references to use UUID
-- Note: This is a complex migration that requires careful handling in production

-- For billing_customers table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('billing_customers') AND name = 'tenant_id_uuid')
ALTER TABLE billing_customers ADD tenant_id_uuid UNIQUEIDENTIFIER;

-- Update billing_customers to use new UUID
UPDATE billing_customers
SET tenant_id_uuid = t.id_uuid
FROM tenants t
WHERE billing_customers.tenant_id = t.id;

-- Add foreign key constraint with UUID
ALTER TABLE billing_customers
ADD CONSTRAINT billing_customers_tenant_id_fkey
FOREIGN KEY (tenant_id_uuid) REFERENCES tenants(id_uuid) ON DELETE CASCADE;

-- Similar updates for other tables with tenant_id references
-- This is a simplified version - full migration would handle all tables

-- Create index for performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('billing_customers') AND name = 'idx_billing_customers_tenant_uuid')
CREATE INDEX idx_billing_customers_tenant_uuid ON billing_customers(tenant_id_uuid);

-- Add comment
EXEC sp_addextendedproperty 'MS_Description', 'UUID reference to tenants.id_uuid (replaces tenant_id TEXT)', 'SCHEMA', 'dbo', 'TABLE', 'billing_customers', 'COLUMN', 'tenant_id_uuid';
