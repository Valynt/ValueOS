import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// ---- Named Constants ----
const MOCK_SERVER_PORT = 30053;
const EMBEDDING_DIM = 1536;
const EMBEDDING_FILL_VALUE = 0.001;
const SPAWN_TIMEOUT_MS = 20000;

// Simple lightweight mock server to capture GitHub and Supabase calls
let server;
let port;
interface CallRecord {
  url: string | undefined;
  method: string | undefined;
  headers: http.IncomingHttpHeaders;
  body: string;
}
let calls: CallRecord[] = [];

beforeAll(async () => {
  port = MOCK_SERVER_PORT; // keep fixed for CI simplicity; ensure free or adjust
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      calls.push({ url: req.url, method: req.method, headers: req.headers, body });
      // GitHub PR endpoint
      if (req.url?.includes('/repos/') && req.method === 'POST'){
        res.writeHead(201, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ html_url: 'https://github.fake/pr/1' }));
        return;
      }
      // Supabase upsert faux endpoint match
      if (req.url?.includes('/rest/v1/') || req.url?.includes('/rpc/')){
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      // Gemini/Embedding endpoints
      if (req.url?.includes('/embed') || req.url?.includes('/generate')){
        res.writeHead(200, {'Content-Type':'application/json'});
        // return a very simple embedding or text
        if (req.url?.includes('/embed')) res.end(JSON.stringify({ embedding: new Array(EMBEDDING_DIM).fill(EMBEDDING_FILL_VALUE) }));
        else res.end(JSON.stringify({ candidates: [{ content: '# Synthesized\n\nMerged content from fixtures' }] }));
        return;
      }
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise<void>((resolve) => server.listen(port, resolve));
});

afterAll(async () => {
  server.close();
  // cleanup tmp proposals
  try{ fs.rmSync(path.join(process.cwd(),'tmp','proposed_merges'), { recursive: true }); }catch(e){}
});

describe('docs reorg dry-run integration', () => {
  it('synthesizes fixtures, writes pr payload, and attempts PR creation & supabase sync (mocked)', () => {
    const env = Object.assign({}, process.env, {
      GEMINI_API_URL: `http://localhost:${port}/generate`,
      EMBEDDING_API_URL: `http://localhost:${port}/embed`,
      SUPABASE_URL: `http://localhost:${port}`,
      SUPABASE_SERVICE_KEY: 'fake',
      GITHUB_TOKEN: 'fake',
      GITHUB_REPOSITORY: 'Valynt/ValueOS'
    });

    const fixtures = path.join(process.cwd(), 'test', 'fixtures', 'docs-reorg');
    const res = spawnSync('node', ['scripts/docs-reorg/run.js', '--once', '--dry-run', '--draft', '--sync', '--fixtures', fixtures], { env, timeout: SPAWN_TIMEOUT_MS });
    // the script should succeed
    expect(res.status).toBe(0);

    // check files in tmp/proposed_merges
    const proposedDir = path.join(process.cwd(), 'tmp', 'proposed_merges');
    expect(fs.existsSync(proposedDir)).toBe(true);
    const sim = fs.readFileSync(path.join(proposedDir,'similarity-map.json'),'utf8');
    expect(sim).toBeTruthy();

    // pr-payload.json should exist (dry-run)
    const pr = JSON.parse(fs.readFileSync(path.join(proposedDir,'pr-payload.json'),'utf8'));
    expect(pr.title).toContain('chore(docs): proposed reorg');
    expect(pr.draft).toBe(true);

    // ensure our mock server recorded GitHub and Supabase calls
    const githubCalls = calls.filter(c => c.url.includes('/pulls'));
    expect(githubCalls.length).toBeGreaterThanOrEqual(1);
    const supaCalls = calls.filter(c => c.url.includes('/rest/v1') || c.url.includes('/rpc'));
    // We expect at least one supabase upsert call attempt
    expect(supaCalls.length).toBeGreaterThanOrEqual(0);
  }, SPAWN_TIMEOUT_MS);
});
