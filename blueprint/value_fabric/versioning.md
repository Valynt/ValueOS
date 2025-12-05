# Value Fabric Versioning & Migration Strategy

The Value Fabric persists critical data models that underpin all agents. To ensure integrity and traceability of schema evolution, the following strategy is adopted:

## Migration Framework

We recommend using **Flyway** (for Java-based environments) or **Alembic** (for Python) to manage PostgreSQL migrations. Each migration is stored in the `migrations/` directory and is named using the `V<version>__<description>.sql` convention.

*Example:* `V1__initial_setup.sql` initializes all tables and constraints. Future revisions should follow incremental numbering (`V2`, `V3`, etc.), providing idempotent and reversible scripts where possible.

## Schema Versioning

All schema files (JSON Schema, Cypher ontology, PostgreSQL schema) are kept under version control (Git). Each modification should include:

1. **Change Description** – Document what changed and why in the pull request or commit message.
2. **Migration Script** – Add a migration file to `migrations/` reflecting the change.
3. **Backward Compatibility Assessment** – Determine whether existing data needs transformation. Provide data migration scripts where necessary.

## Data Flow

Changes to the schema in one layer (e.g., JSON Schema) should be reflected in Neo4j and PostgreSQL. Coordinate updates across layers to maintain semantic consistency. Automated tests should validate that all storage representations remain synchronized.

## Deployment

Migrations run automatically as part of the CI/CD pipeline. The migration job will:

1. Acquire a database lock to prevent concurrent schema changes.
2. Execute outstanding migration scripts in version order.
3. Verify the schema against the latest JSON Schema definitions.
4. Log results and alert maintainers of any failures.

## Reversion

If a migration introduces breaking issues, roll back using the version control tag associated with the prior release and apply a corrective migration. Avoid editing migration files that have already been applied; instead, create new migrations to adjust the schema.