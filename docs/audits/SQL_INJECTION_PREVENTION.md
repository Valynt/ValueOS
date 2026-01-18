# SQL Injection Prevention Checklist + Secure Query Patterns

## Scope & chosen stack
This review focuses on the **VOSAcademy database layer** that uses **Drizzle ORM with mysql2** (`drizzle-orm/mysql2`) and the `sql` tagged template for raw fragments. The same guidance applies to any direct SQL usage in other services, but examples are written for this stack to match current usage patterns. Ensure any future database adapters (e.g., Postgres) follow the same parameterization and allowlist constraints. 

## Security review: SQL injection risk areas
### Key observations in the current stack
- **Drizzle ORM** provides parameterized queries when using its query builders (`eq`, `and`, `desc`, `inArray`, etc.) and the `sql` tagged template literal. Using the `sql` tag with `${...}` is safe as long as values remain parameters and **identifiers are never interpolated**.
- **Risk concentrates around raw SQL fragments** (e.g., manual `sql` strings or `db.execute`) and **dynamic ORDER BY** or **dynamic table/column names**. These must be guarded with allowlists.
- **Any string concatenation that injects user input into SQL** is unsafe and must be banned.

## SQL injection prevention checklist
### ✅ Required controls
- **Always use parameterized queries** for values. Prefer Drizzle query builders or `sql` tagged templates with `${value}` placeholders.
- **Allowlist for dynamic identifiers** (ORDER BY columns, sort directions, table names).
- **Use typed query builders** (e.g., `eq`, `and`, `inArray`, `asc`, `desc`) where possible.
- **Centralize query helpers** for dynamic filters and ordering to enforce safe defaults.
- **Set maximum parameter counts** for `IN (...)` lists and batch inputs to avoid DB limits.

### ❌ Banned patterns (never allow)
- **String concatenation / interpolation with user input**
  - `const q = "SELECT * FROM users WHERE email = '" + email + "'";`
- **Dynamic ORDER BY without allowlist**
  - `ORDER BY ${req.query.sort}`
- **Raw queries with unvalidated SQL fragments**
  - `db.execute(sql.raw(userProvidedSql))`
- **Dynamic table or column names** without strict mapping
  - `sql` fragments that embed arbitrary identifiers (columns, tables, functions) sourced from requests.

## Safe patterns (Drizzle + mysql2)
### 1) Dynamic filters (safe, parameterized)
```ts
import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { users } from "../drizzle/schema";

function buildUserFilters(params: {
  email?: string;
  role?: string;
  search?: string;
  userIds?: number[];
}) {
  const filters = [];

  if (params.email) filters.push(eq(users.email, params.email));
  if (params.role) filters.push(eq(users.role, params.role));
  if (params.userIds?.length) filters.push(inArray(users.id, params.userIds));

  // Use sql tagged templates for LIKE/FTS values (values remain parameterized)
  if (params.search) {
    filters.push(sql`${users.name} LIKE ${`%${params.search}%`}`);
  }

  return filters.length ? and(...filters) : undefined;
}
```
**Notes:**
- **Values are always parameters** (safe).
- Do **not** interpolate `users.${field}` dynamically — use allowlists for identifiers (see below).

### 2) Dynamic ordering with allowlist (safe)
```ts
import { asc, desc } from "drizzle-orm";
import { users } from "../drizzle/schema";

const ORDER_BY_ALLOWLIST = {
  name: users.name,
  createdAt: users.createdAt,
  lastSignedIn: users.lastSignedIn,
} as const;

type OrderByKey = keyof typeof ORDER_BY_ALLOWLIST;

type SortDirection = "asc" | "desc";

function getOrderBy(sortBy: string | undefined, direction: SortDirection | undefined) {
  const column = ORDER_BY_ALLOWLIST[sortBy as OrderByKey] ?? users.createdAt;
  return (direction ?? "desc") === "asc" ? asc(column) : desc(column);
}
```
**Notes:**
- Never allow raw `sortBy` or `direction` into SQL.
- Always map to known column references and fixed direction values.

### 3) IN clauses with parameters (safe)
```ts
import { inArray } from "drizzle-orm";
import { users } from "../drizzle/schema";

const MAX_IN_PARAMS = 1000;

function safeInArray(ids: number[]) {
  const limited = ids.slice(0, MAX_IN_PARAMS);
  return inArray(users.id, limited);
}
```
**Notes:**
- Avoid massive `IN` lists; batch queries when the list exceeds parameter limits.

### 4) Full-text search (safe patterns)
**MySQL full-text search (recommended approach):**
```ts
import { sql } from "drizzle-orm";
import { resources } from "../drizzle/schema";

function fullTextSearch(term: string) {
  return sql`MATCH(${resources.title}, ${resources.description}) AGAINST (${term} IN BOOLEAN MODE)`;
}
```
**Notes:**
- `MATCH ... AGAINST` **must** use parameterized values (`${term}`) only.
- Never allow dynamic column lists without allowlists.

## Guidance for prepared statements & parameter limits
- **Prepared statements**: Drizzle automatically parameterizes values. Ensure any raw SQL uses the `sql` tag and `${value}` placeholders so values are bound.
- **Parameter limits**: MySQL and Postgres have limits on bind parameters. Keep **`IN` list sizes capped** (e.g., `1000`) and batch large inputs.
- **Avoid dynamic SQL execution**: If raw SQL is required, keep it static and only interpolate parameter values.
- **Use database-side pagination** (limit/offset) with bound values, not string concatenation.

## Quick reference: what to allow vs. block
### Allow
- `db.select().from(users).where(eq(users.email, email))`
- `sql`${table.column} LIKE ${`%${term}%`}``
- `inArray(users.id, ids.slice(0, MAX_IN_PARAMS))`
- Allowlisted ORDER BY mappings using `asc`/`desc`

### Block
- `"... WHERE email = '" + email + "'"`
- ``sql.raw(`ORDER BY ${req.query.sort}`)``
- `db.execute(req.body.sql)`
- `sql`${req.query.field} = ${value}``

## Action items for the codebase
- **Audit for raw SQL**: Identify any `sql.raw`, `db.execute`, or string-concatenated SQL usage and replace with Drizzle builders or parameterized `sql` templates.
- **Centralize safe query helpers**: Create shared utilities for dynamic filters and ordering.
- **Add lint rules or code review checks**: Flag any string concatenation inside SQL-building code.
- **Document parameter limits** for batch endpoints and enforce input validation at request boundaries.
