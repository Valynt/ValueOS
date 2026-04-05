#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

const nginxPath = resolve(repoRoot, "infra/nginx/nginx.conf");
const middlewarePath = resolve(
  repoRoot,
  "packages/backend/src/middleware/securityHeaders.ts"
);
const securityConfigPath = resolve(
  repoRoot,
  "packages/backend/src/config/securityConfig.ts"
);

const nginxSource = readFileSync(nginxPath, "utf8");
const middlewareSource = readFileSync(middlewarePath, "utf8");
const securityConfigSource = readFileSync(securityConfigPath, "utf8");

const CRITICAL_HEADERS = [
  "Strict-Transport-Security",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function extractCanonicalMatrixEntry(headerName) {
  const pattern = new RegExp(
    `"${headerName}":\\s*\\{[\\s\\S]*?value:\\s*"([^"]+)"[\\s\\S]*?owner:\\s*"([^"]+)"[\\s\\S]*?\\}`,
    "m"
  );
  const match = securityConfigSource.match(pattern);
  if (!match) {
    fail(
      `Canonical matrix entry missing for ${headerName} in securityConfig.ts.`
    );
  }

  return {
    value: match[1],
    owner: match[2],
  };
}

function parseNginxAddHeaders() {
  const headers = new Map();
  const addHeaderRegex = /add_header\s+([A-Za-z\-]+)\s+"([^"]+)"\s+always;/g;
  for (const match of nginxSource.matchAll(addHeaderRegex)) {
    headers.set(match[1], match[2]);
  }

  return headers;
}

function ensurePatternInSource(source, description, pattern) {
  if (!pattern.test(source)) {
    fail(description);
  }
}

function ensureCanonicalLookupsInMiddleware() {
  ensurePatternInSource(
    middlewareSource,
    "App middleware drift: expected securityHeaders.ts to use canonical Strict-Transport-Security lookup.",
    /getCanonicalSecurityHeaderValue\(\s*(?:"|')Strict-Transport-Security(?:"|')\s*\)/
  );
  ensurePatternInSource(
    middlewareSource,
    "App middleware drift: expected securityHeaders.ts to use canonical X-Frame-Options lookup.",
    /getCanonicalSecurityHeaderValue\(\s*(?:"|')X-Frame-Options(?:"|')\s*\)/
  );
  ensurePatternInSource(
    middlewareSource,
    "App middleware drift: expected securityHeaders.ts to use canonical Referrer-Policy lookup.",
    /getCanonicalSecurityHeaderValue\(\s*(?:"|')Referrer-Policy(?:"|')\s*\)/
  );
  ensurePatternInSource(
    middlewareSource,
    "App middleware drift: expected securityHeaders.ts to use buildCanonicalPermissionsPolicy().",
    /buildCanonicalPermissionsPolicy\(\)/
  );
}

function ensureCanonicalLookupsInSecurityConfig() {
  ensurePatternInSource(
    securityConfigSource,
    "App config drift: expected securityConfig.ts to use canonical X-Frame-Options lookup.",
    /getCanonicalSecurityHeaderValue\(\s*(?:"|')X-Frame-Options(?:"|')\s*\)/
  );
  ensurePatternInSource(
    securityConfigSource,
    "App config drift: expected securityConfig.ts to use canonical Referrer-Policy lookup.",
    /getCanonicalSecurityHeaderValue\(\s*(?:"|')Referrer-Policy(?:"|')\s*\)/
  );
  ensurePatternInSource(
    securityConfigSource,
    "App config drift: expected securityConfig.ts to use buildCanonicalPermissionsPolicy().",
    /buildCanonicalPermissionsPolicy\(\)/
  );
}

function ensureCspBaselineAtEdge() {
  const cspMatch = nginxSource.match(
    /add_header\s+Content-Security-Policy\s+"([^"]+)"\s+always;/
  );
  if (!cspMatch) {
    fail("Nginx config must define a Content-Security-Policy header.");
  }

  const cspHeaderValue = cspMatch[1];
  const requiredDirectives = [
    "default-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ];

  for (const directive of requiredDirectives) {
    if (!cspHeaderValue.includes(directive)) {
      fail(
        `Nginx Content-Security-Policy missing required directive: ${directive}.`
      );
    }
  }
}

const nginxHeaders = parseNginxAddHeaders();

for (const header of CRITICAL_HEADERS) {
  const matrix = extractCanonicalMatrixEntry(header);
  const nginxValue = nginxHeaders.get(header);

  if (!nginxValue) {
    fail(`Nginx is missing critical header ${header}.`);
  }

  if (nginxValue !== matrix.value) {
    fail(
      `Drift detected for ${header}: nginx="${nginxValue}" but canonical="${matrix.value}" (owner: ${matrix.owner}).`
    );
  }
}

ensureCspBaselineAtEdge();
ensureCanonicalLookupsInMiddleware();
ensureCanonicalLookupsInSecurityConfig();

console.log(
  "✅ Security header drift check passed (edge and app aligned to canonical matrix)."
);
