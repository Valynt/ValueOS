#!/usr/bin/env node
/**
 * Evidence chain integrity verifier.
 *
 * Reads compliance_control_evidence records for a given (tenant_id, control_id)
 * pair within a time window, recomputes integrity_hash for each record, and
 * verifies the previous_hash linkage forms an unbroken chain.
 *
 * Usage:
 *   node scripts/compliance/verify-evidence-chain.mjs \
 *     --tenant-id=<uuid> \
 *     --control-id=<e.g. CC6.1> \
 *     [--from=<ISO8601>] \
 *     [--to=<ISO8601>] \
 *     [--limit=<number>]
 *
 * Exit codes:
 *   0  Chain is intact
 *   1  Chain is broken (first broken link reported)
 *   2  Configuration or connection error
 *
 * Requires: DATABASE_URL or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createHash } from "node:crypto";
import { parseArgs } from "node:util";

// ── Argument parsing ──────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    "tenant-id":  { type: "string" },
    "control-id": { type: "string" },
    from:         { type: "string" },
    to:           { type: "string" },
    limit:        { type: "string", default: "1000" },
    help:         { type: "boolean", default: false },
  },
  strict: true,
});

if (args.help) {
  console.log(`
verify-evidence-chain.mjs — Validate compliance evidence hash chain integrity.

Usage:
  node scripts/compliance/verify-evidence-chain.mjs \\
    --tenant-id=<uuid> \\
    --control-id=<e.g. CC6.1> \\
    [--from=<ISO8601>] \\
    [--to=<ISO8601>] \\
    [--limit=<number>]

Options:
  --tenant-id   Required. Organization/tenant UUID.
  --control-id  Required. Control ID from control-registry.json (e.g. CC6.1).
  --from        Optional. Start of time window (ISO 8601). Defaults to 30 days ago.
  --to          Optional. End of time window (ISO 8601). Defaults to now.
  --limit       Optional. Max records to verify. Default: 1000.
  --help        Show this help.

Exit codes:
  0  Chain intact
  1  Chain broken
  2  Configuration or connection error
`);
  process.exit(0);
}

if (!args["tenant-id"] || !args["control-id"]) {
  console.error("[verify-evidence-chain] ERROR: --tenant-id and --control-id are required.");
  process.exit(2);
}

const tenantId = args["tenant-id"];
const controlId = args["control-id"];
const limit = parseInt(args.limit ?? "1000", 10);
const fromDate = args.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const toDate = args.to ?? new Date().toISOString();

// ── Hash computation ──────────────────────────────────────────────────────────

const GENESIS_HASH = createHash("sha256")
  .update("genesis:valueos.internal")
  .digest("hex");

/**
 * Recomputes the integrity_hash for a record using the canonical field set.
 * Must match the server-side computation in ComplianceEvidenceService.
 *
 * Canonical fields (pipe-separated, UTF-8):
 *   id|tenant_id|control_id|framework|event_type|collected_at|collected_by|previous_hash
 */
function computeIntegrityHash(record) {
  const canonical = [
    record.id,
    record.tenant_id,
    record.control_id,
    record.framework,
    record.event_type,
    record.collected_at,
    record.collected_by,
    record.previous_hash,
  ].join("|");

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

// ── Database connection ───────────────────────────────────────────────────────

async function fetchRecords() {
  // Try Supabase REST API first (available in most ValueOS environments).
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    return fetchViaSupabase(supabaseUrl, serviceRoleKey);
  }

  // Fall back to direct Postgres via DATABASE_URL.
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return fetchViaPostgres(databaseUrl);
  }

  console.error(
    "[verify-evidence-chain] ERROR: No database connection configured.\n" +
    "Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL."
  );
  process.exit(2);
}

async function fetchViaSupabase(supabaseUrl, serviceRoleKey) {
  const url = new URL(`${supabaseUrl}/rest/v1/compliance_control_evidence`);
  url.searchParams.set("tenant_id", `eq.${tenantId}`);
  url.searchParams.set("control_id", `eq.${controlId}`);
  // Use append for both collected_at filters — set() would overwrite the first.
  url.searchParams.append("collected_at", `gte.${fromDate}`);
  url.searchParams.append("collected_at", `lte.${toDate}`);
  url.searchParams.set("order", "collected_at.asc");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set(
    "select",
    "id,tenant_id,control_id,framework,event_type,collected_at,collected_by,previous_hash,integrity_hash"
  );

  const response = await fetch(url.toString(), {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[verify-evidence-chain] ERROR: Supabase query failed (${response.status}): ${body}`);
    process.exit(2);
  }

  return response.json();
}

async function fetchViaPostgres(databaseUrl) {
  // Dynamic import to avoid hard dependency when using Supabase path.
  const { default: pg } = await import("pg").catch(() => {
    console.error("[verify-evidence-chain] ERROR: 'pg' package not available. Install it or use SUPABASE_URL.");
    process.exit(2);
  });

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const result = await client.query(
      `SELECT id, tenant_id, control_id, framework, event_type, collected_at, collected_by,
              previous_hash, integrity_hash
       FROM compliance_control_evidence
       WHERE tenant_id = $1
         AND control_id = $2
         AND collected_at >= $3
         AND collected_at <= $4
       ORDER BY collected_at ASC
       LIMIT $5`,
      [tenantId, controlId, fromDate, toDate, limit]
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

// ── Chain verification ────────────────────────────────────────────────────────

function verifyChain(records) {
  if (records.length === 0) {
    console.log(
      `[verify-evidence-chain] INFO: No records found for tenant=${tenantId} control=${controlId} ` +
      `in window [${fromDate}, ${toDate}].`
    );
    return { intact: true, recordCount: 0 };
  }

  let expectedPreviousHash = GENESIS_HASH;
  let brokenAt = null;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // 1. Verify previous_hash linkage.
    if (record.previous_hash !== expectedPreviousHash) {
      brokenAt = {
        index: i,
        recordId: record.id,
        collectedAt: record.collected_at,
        reason: "previous_hash mismatch",
        expected: expectedPreviousHash,
        actual: record.previous_hash,
      };
      break;
    }

    // 2. Recompute and verify integrity_hash.
    const recomputed = computeIntegrityHash(record);
    if (recomputed !== record.integrity_hash) {
      brokenAt = {
        index: i,
        recordId: record.id,
        collectedAt: record.collected_at,
        reason: "integrity_hash mismatch (record may have been tampered with)",
        expected: recomputed,
        actual: record.integrity_hash,
      };
      break;
    }

    // Advance the expected previous hash to this record's integrity hash.
    expectedPreviousHash = record.integrity_hash;
  }

  return {
    intact: brokenAt === null,
    recordCount: records.length,
    brokenAt,
    lastHash: expectedPreviousHash,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `[verify-evidence-chain] Verifying chain for tenant=${tenantId} control=${controlId} ` +
    `window=[${fromDate}, ${toDate}] limit=${limit}`
  );

  const records = await fetchRecords();
  const result = verifyChain(records);

  if (result.intact) {
    console.log(
      `[verify-evidence-chain] PASS: Chain intact. ` +
      `${result.recordCount} record(s) verified. Last hash: ${result.lastHash?.slice(0, 16)}...`
    );
    process.exit(0);
  } else {
    const b = result.brokenAt;
    console.error(
      `[verify-evidence-chain] FAIL: Chain broken at record ${b.index + 1}/${result.recordCount}.\n` +
      `  Record ID:    ${b.recordId}\n` +
      `  Collected at: ${b.collectedAt}\n` +
      `  Reason:       ${b.reason}\n` +
      `  Expected:     ${b.expected}\n` +
      `  Actual:       ${b.actual}`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[verify-evidence-chain] FATAL:", err);
  process.exit(2);
});
