# Migrate Prisma Configuration for Version 7.2.0

This plan addresses the Prisma 7.2.0 configuration issues where datasource properties `url` and `directUrl` are no longer supported in schema files and must be moved to `prisma.config.ts`.

## Current Problem

- Prisma 7.2.0 deprecated datasource `url` and `directUrl` properties in schema.prisma
- Current schema has these properties which cause validation failures
- Error: "The datasource property `url` is no longer supported in schema files"
- Error: "The datasource property `directUrl` is no longer supported in schema files"
- Need to migrate to new prisma.config.ts approach

## Solution

Create prisma.config.ts file and update PrismaClient instantiation to use the new configuration pattern.

## Implementation Steps

1. Create `prisma.config.ts` file with datasource configuration
2. Remove `url` and `directUrl` from schema.prisma datasource block
3. Update PrismaClient instantiation to use adapter or accelerateUrl
4. Update database connection code to use new configuration
5. Test that prisma generate and validate work correctly

## Files to Modify

- Create: `/home/ino/ValueOS/prisma.config.ts`
- Modify: `/home/ino/ValueOS/prisma/schema.prisma` (remove url/directUrl)
- Modify: `/home/ino/ValueOS/src/lib/database.ts` (update client instantiation)
- Modify: Any other files using PrismaClient directly

## Expected Outcome

- Prisma 7.2.0 validation passes
- prisma generate succeeds without errors
- Database connections work with new configuration pattern
- Backward compatibility maintained during transition
