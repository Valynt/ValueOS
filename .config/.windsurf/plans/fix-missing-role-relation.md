# Fix Missing Role Relation on User Model

This plan addresses the bug where the User model has a `roleId` field but is missing the corresponding `role` relation to the Role model, causing Prisma validation failures.

## Current Problem

- User model has `roleId` field (line 135) referencing Role model
- Role model declares `users User[]` relation (line 108)
- User model is missing the corresponding `role` relation
- Prisma requires both sides of a relation to be defined
- `prisma generate` fails with validation error

## Solution

Add the missing role relation to the User model's relations section with proper field mapping and references.

## Implementation Steps

1. Add `role Role? @relation(fields: [roleId], references: [id])` to User model relations
2. Ensure the relation is optional (using `?`) since roleId is nullable
3. Verify the relation mapping matches the Role model's users field

## Files to Modify

- `/home/ino/ValueOS/prisma/schema.prisma` (User model relations section, around line 147)

## Expected Outcome

- Prisma schema validation passes
- `prisma generate` succeeds without errors
- Proper bidirectional relation between User and Role models
