#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const backendRoot = path.join(repoRoot, 'packages/backend');
const serverFile = path.join(backendRoot, 'src/server.ts');
const openapiFile = path.join(backendRoot, 'openapi.yaml');
const metadataFile = path.join(backendRoot, 'route-security-metadata.json');
const baselineFile = path.join(backendRoot, 'security-route-violations-baseline.json');
const artifactFile = path.join(repoRoot, 'artifacts/security/route-security-posture.json');

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);

function parseTs(filePath) {
  return ts.createSourceFile(filePath, fs.readFileSync(filePath, 'utf8'), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
}

function text(node, sf) {
  return sf.text.slice(node.getStart(sf), node.getEnd());
}

function asStr(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;
}

function normalizePath(p) {
  let v = p.replace(/\/+/g, '/');
  if (!v.startsWith('/')) v = `/${v}`;
  v = v.replace(/:\w+/g, (m) => `{${m.slice(1)}}`);
  if (v.length > 1) v = v.replace(/\/+$/, '');
  return v;
}

function joinPath(prefix, local) {
  return normalizePath(`${prefix}/${local}`);
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '::DOUBLE_STAR::').replace(/\*/g, '[^ ]*').replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${escaped}$`);
}

const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
const rules = (metadata.rules ?? []).map((r, idx) => ({ ...r, idx, re: globToRegExp(r.pattern) }));
const baseline = new Set(JSON.parse(fs.readFileSync(baselineFile, 'utf8')).violations ?? []);

const serverSf = parseTs(serverFile);
const importMap = new Map();
const mounts = [];

for (const st of serverSf.statements) {
  if (ts.isImportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) && st.importClause) {
    const mod = st.moduleSpecifier.text;
    if (!mod.startsWith('./api/')) continue;
    const tsPath = path.join(backendRoot, 'src', `${mod.slice(2).replace(/\.js$/, '.ts')}`);
    if (!fs.existsSync(tsPath)) continue;
    const named = st.importClause.namedBindings;
    if (st.importClause.name) importMap.set(st.importClause.name.text, tsPath);
    if (named && ts.isNamedImports(named)) {
      for (const el of named.elements) importMap.set(el.name.text, tsPath);
    }
  }
}

function visitServer(node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const obj = node.expression.expression;
    const method = node.expression.name.text;
    if ((ts.isIdentifier(obj) && (obj.text === 'app' || obj.text === 'apiRouter')) && method === 'use') {
      const args = node.arguments;
      const prefixArg = args.find((a) => asStr(a));
      const prefix = prefixArg ? asStr(prefixArg) : '/';
      const prefixes = obj.text === 'apiRouter' ? [`/api${prefix}`] : [prefix];
      for (const p of prefixes) {
        const routers = args.filter((a) => ts.isIdentifier(a) && importMap.has(a.text)).map((a) => a.text);
        for (const rv of routers) {
          const middleware = args
            .filter((a) => a !== prefixArg)
            .filter((a) => !(ts.isIdentifier(a) && a.text === rv))
            .map((a) => text(a, serverSf));
          mounts.push({ routerVar: rv, routerFile: importMap.get(rv), prefix: normalizePath(p), middleware });
        }
      }
    }
  }
  ts.forEachChild(node, visitServer);
}
visitServer(serverSf);

function collectRoutes(filePath) {
  const sf = parseTs(filePath);
  const routerVars = new Set();
  const routes = [];

  function walk(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isCallExpression(n.initializer)) {
      const c = n.initializer.expression;
      const callee = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : '';
      if (callee === 'Router' || callee === 'createSecureRouter') routerVars.add(n.name.text);
    }

    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const obj = n.expression.expression;
      const method = n.expression.name.text.toLowerCase();
      if (ts.isIdentifier(obj) && routerVars.has(obj.text) && METHODS.has(method)) {
        const [pArg, ...rest] = n.arguments;
        const localPath = asStr(pArg);
        if (localPath) {
          routes.push({ method: method.toUpperCase(), path: normalizePath(localPath), middleware: rest.map((a) => text(a, sf)) });
        }
      }
    }
    ts.forEachChild(n, walk);
  }
  walk(sf);
  return routes;
}

const allRoutes = [];
for (const m of mounts) {
  const localRoutes = collectRoutes(m.routerFile);
  for (const lr of localRoutes) {
    const fullPath = joinPath(m.prefix, lr.path);
    allRoutes.push({
      method: lr.method,
      path: fullPath,
      middleware: [...m.middleware, ...lr.middleware],
      source: m.routerFile.replace(`${repoRoot}/`, ''),
    });
  }
}

const doc = JSON.parse(execFileSync('python', ['-c', "import json,sys,yaml;print(json.dumps(yaml.safe_load(open(sys.argv[1]))))", openapiFile], { encoding: 'utf8' }));
const globalSecurity = doc.security ?? null;
const openapiOps = new Map();
for (const [p, op] of Object.entries(doc.paths ?? {})) {
  const np = normalizePath(p);
  for (const m of Object.keys(op)) {
    if (!METHODS.has(m)) continue;
    const sec = op[m].security ?? op.security ?? globalSecurity ?? null;
    openapiOps.set(`${m.toUpperCase()} ${np}`, { security: sec, operationId: op[m].operationId ?? null });
  }
}

function infer(route) {
  const chain = route.middleware.join(' ');
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method);
  const auth = /(requireAuth|verifyAccessToken|requirePermission)/.test(chain) ? 'required' : 'none';
  const tenant = /(tenantContextMiddleware|tenantDbContextMiddleware|requireTenantRequestAlignment)/.test(chain) ? 'required' : 'none';
  const csrf = mutating ? (/(csrfProtectionMiddleware|createSecureRouter)/.test(chain) ? 'required' : 'none') : 'optional';
  const m = chain.match(/rateLimiters\.([a-zA-Z]+)/);
  const rateLimitTier = m?.[1] ?? null;
  return { auth, tenant, csrf, rateLimitTier };
}

function metadataFor(route) {
  const key = `${route.method} ${route.path}`;
  for (const rule of rules) {
    if (rule.re.test(key)) return { auth: rule.auth, tenant: rule.tenant, csrf: rule.csrf, rateLimitTier: rule.rateLimitTier, explicit: true, rule: rule.pattern };
  }
  return { ...infer(route), explicit: false, rule: null };
}

const violations = [];
const posture = [];
for (const route of allRoutes) {
  const meta = metadataFor(route);
  const opKey = `${route.method} ${route.path}`;
  const op = openapiOps.get(opKey) ?? null;
  const protectedInSpec = !!(op?.security && op.security.length > 0);

  if (!op) {
    violations.push({ type: 'undocumented_route_drift', route: opKey });
  }

  if (op) {
    if (meta.auth === 'required' && !protectedInSpec) {
      violations.push({ type: 'auth_protected_not_documented', route: opKey });
    }
    if (meta.auth !== 'required' && protectedInSpec) {
      violations.push({ type: 'auth_documented_but_unprotected', route: opKey });
    }
  }

  if (!meta.rateLimitTier) {
    violations.push({ type: 'missing_rate_limit_tier', route: opKey });
  }

  if (meta.auth !== 'required' || meta.tenant !== 'required') {
    violations.push({ type: 'missing_auth_or_tenant_controls', route: opKey });
  }

  posture.push({ ...route, metadata: meta, openapi: op ? { protectedInSpec, operationId: op.operationId } : null });
}

const effectiveViolations = violations.filter((v) => !baseline.has(`${v.type}|${v.route}`));
fs.mkdirSync(path.dirname(artifactFile), { recursive: true });
fs.writeFileSync(artifactFile, JSON.stringify({ generatedAt: new Date().toISOString(), totals: { routes: posture.length, violations: effectiveViolations.length }, violations: effectiveViolations, posture }, null, 2));

if (effectiveViolations.length) {
  console.error(`Route security check failed with ${effectiveViolations.length} violation(s). See ${artifactFile}`);
  process.exit(1);
}
console.log(`Route security check passed. Report written to ${artifactFile}`);
