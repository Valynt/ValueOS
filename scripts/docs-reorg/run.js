#!/usr/bin/env node
/*
Docs Reorg Runner
- Scans repository for Markdown docs
- Generates embeddings (via EMBEDDING_API_URL or fallback)
- Builds a similarity map and clusters similar docs
- Writes proposed merged files under tmp/proposed_merges/
- Detects stale docs by deprecated terms
- Creates a git branch and opens a PR (if GITHUB_TOKEN is set)

Usage: node scripts/docs-reorg/run.js [--once] [--daemon]
*/
import fs from 'fs/promises';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'docs-reorg.config.json');
const PROPOSED_DIR = path.join(process.cwd(), 'tmp', 'proposed_merges');

async function readConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {
      filePatterns: ['**/*.md', '**/*.mdx'],
      exclude: ['node_modules', '.git', 'tmp', 'public', 'dist'],
      similarityThreshold: 0.92,
      deprecatedTerms: ["boston-hoa", "old-library"],
      schedule: '0 2 * * *'
    };
  }
}

async function collectDocs(dir, exclude) {
  const files = [];
  async function walk(cur) {
    const entries = await fs.readdir(cur, {withFileTypes: true});
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (exclude.some(ex => full.includes(path.sep + ex + path.sep) || full.endsWith(path.sep+ex))) continue;
      if (e.isDirectory()) await walk(full);
      else if (/\.mdx?$/.test(e.name)) files.push(full);
    }
  }
  await walk(dir);
  return files;
}

function textToVectorFallback(text, dim=256) {
  // deterministic lightweight embedding: hash trigram counts into vector
  const vec = new Array(dim).fill(0);
  const words = text.split(/\s+/).slice(0, 1000);
  for (let i=0;i<words.length;i++){
    const w = words[i].toLowerCase().replace(/[^a-z0-9]/g,'');
    if (!w) continue;
    let h = 0;
    for (let j=0;j<w.length;j++) h = (h*31 + w.charCodeAt(j)) >>> 0;
    vec[h % dim] += 1;
  }
  // normalize
  const len = Math.sqrt(vec.reduce((s,v)=>s+v*v,0))||1;
  return vec.map(x=>x/len);
}

async function computeEmbedding(text) {
  const api = process.env.EMBEDDING_API_URL;
  if (!api) return textToVectorFallback(text);
  try {
    const res = await fetch(api, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({input: text})
    });
    const j = await res.json();
    // Accept flexible shapes: {embedding: [...] } or {data:[{embedding:[...]}]}
    if (j.embedding && Array.isArray(j.embedding)) return j.embedding;
    if (j.data && j.data[0] && j.data[0].embedding) return j.data[0].embedding;
    if (Array.isArray(j) && j[0] && j[0].embedding) return j[0].embedding;
    console.warn('Unexpected embedding response shape, falling back');
    return textToVectorFallback(text);
  } catch (e) {
    console.warn('Embedding API failed:', e.message);
    return textToVectorFallback(text);
  }
}

function cosine(a,b){
  let dot=0, na=0, nb=0;
  for (let i=0;i<a.length;i++){dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i];}
  return dot/Math.sqrt((na||1)*(nb||1));
}

async function buildSimilarityMap(docs, simThres) {
  // compute embeddings
  const items = [];
  for (const p of docs) {
    const txt = await fs.readFile(p,'utf8');
    const emb = await computeEmbedding(txt);
    items.push({path:p, text:txt, emb});
  }
  // greedy clustering by centroid
  const clusters = [];
  for (const it of items){
    let placed=false;
    for (const c of clusters){
      // compute similarity to centroid
      const sim = cosine(it.emb, c.centroid);
      if (sim >= simThres){
        c.items.push(it);
        // recompute centroid
        const L = c.centroid.length;
        for (let i=0;i<L;i++) c.centroid[i] = (c.centroid[i]* (c.items.length-1) + (it.emb[i]||0))/c.items.length;
        placed=true; break;
      }
    }
    if (!placed) clusters.push({items:[it], centroid: it.emb.slice()});
  }
  // build similarity map
  const map = clusters.map((c, idx)=>({cluster: idx, size: c.items.length, files: c.items.map(x=>x.path)}));
  return {clusters, map};
}

async function callGeminiSummarize(promptText, cfg){
  // Flexible adapter for Gemini 3 Flash. Tries GEMINI_API_URL then the Google Generative API.
  const model = process.env.GEMINI_MODEL || 'gemini-3.0-flash';
  // 1) Custom endpoint (useful for proxying or local ollama/http bridges)
  if (process.env.GEMINI_API_URL){
    try{
      const res = await fetch(process.env.GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': process.env.GEMINI_API_KEY ? `Bearer ${process.env.GEMINI_API_KEY}` : '' },
        body: JSON.stringify({ model, prompt: promptText, maxOutputTokens: cfg?.maxOutputTokens || 1600 })
      });
      const j = await res.json();
      if (j.output?.[0]?.content) return j.output[0].content;
      if (j.text) return j.text;
      if (j.candidates && j.candidates[0] && j.candidates[0].content) return j.candidates[0].content;
    } catch(e){ console.warn('Gemini proxy call failed:', e.message); }
  }
  // 2) Google Generative API (if API KEY present)
  if (process.env.GEMINI_API_KEY){
    try{
      const endpoint = `https://generativeai.googleapis.com/v1beta2/models/${model}:generateText`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GEMINI_API_KEY}` },
        body: JSON.stringify({ prompt: { text: promptText }, temperature: 0.2, maxOutputTokens: cfg?.maxOutputTokens || 1600 })
      });
      const j = await res.json();
      if (j.candidates && j.candidates[0] && j.candidates[0].content) return j.candidates[0].content;
    } catch(e){ console.warn('Gemini (Google API) call failed:', e.message); }
  }
  return null;
}

async function summarizeCluster(cluster){
  // Build a compact prompt with filenames and key sections (truncate large files)
  const files = cluster.items.map(it => ({path: it.path, snippet: it.text.slice(0, 20_000)}));
  let prompt = `Synthesize the following ${files.length} documents into a single cohesive Markdown document. Preserve all unique technical steps, remove redundant introductions, keep chronological order when relevant, and output a Table of Contents at the top. Files:\n`;
  for (const f of files){ prompt += `\n---\nFile: ${f.path}\n\n${f.snippet}\n`; }
  // Prefer Gemini 3 Flash for synthesis
  const gem = await callGeminiSummarize(prompt, { maxOutputTokens: 2000 });
  if (gem && gem.trim()){ return `<!-- PROPOSED MERGE: ${cluster.items.length} files (synthesized by Gemini) -->\n\n${gem.trim()}\n`; }
  // fallback to previous conservative merge
  const parts = [];
  const seen = new Set();
  for (const it of cluster.items){
    const sections = it.text.split(/(^#{1,6}\s.+$)/m).filter(Boolean);
    for (const sec of sections){
      const key = sec.trim().slice(0,200);
      if (!seen.has(key)) {seen.add(key); parts.push(sec.trim());}
    }
  }
  return `<!-- PROPOSED MERGE: ${cluster.items.length} files (fallback synthesis) -->\n\n` + parts.join('\n\n') + '\n';
}

async function synthesizeCluster(cluster, outDir, cfg) {
  // Use Gemini summarization where possible, otherwise fallback
  const content = await summarizeCluster(cluster);
  const fname = `cluster-${Date.now()}-${Math.random().toString(36).slice(2,6)}.md`;
  const out = path.join(outDir, fname);
  await fs.writeFile(out, content,'utf8');
  return out;
}

async function detectStale(it, deprecatedTerms){
  const txt = it.text.toLowerCase();
  return deprecatedTerms.some(t=>txt.includes(t.toLowerCase()));
}

async function ensureDir(d){ try { await fs.mkdir(d,{recursive:true}); } catch(e){} }

async function syncToSupabase(rows, cfg){
  // rows: [{path, content, embedding}]
  if (!cfg.supabase || !cfg.supabase.enabled) return;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY){ console.warn('Supabase sync enabled but SUPABASE_URL or SUPABASE_SERVICE_KEY not set'); return; }
  try{
    const mod = await import('@supabase/supabase-js');
    const createClient = mod.createClient || mod.default?.createClient || mod.createClient;
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const table = cfg.supabase.table || 'docs_embeddings';
    for (const r of rows){
      // Upsert row. Assumes table has primary key on "path"
      const payload = { path: r.path, content: r.content, embedding: r.embedding, updated_at: new Date().toISOString() };
      const { error } = await supabase.from(table).upsert(payload, { onConflict: 'path' });
      if (error) console.warn('Supabase upsert error for', r.path, error.message || error);
    }
    console.log('Supabase sync complete');
  }catch(e){ console.warn('Supabase sync failed:', e.message); }
}


async function gitRun(cmd){
  return execSync(cmd,{cwd:process.cwd()}).toString().trim();
}

async function runOnce(config) {
  const args = process.argv.slice(2);
  console.log('Collecting docs...');
  // allow overriding root via --fixtures <path> for dry runs/tests
  let root = process.cwd();
  const fiIndex = args.indexOf('--fixtures');
  if (fiIndex !== -1 && args[fiIndex+1]) root = path.resolve(args[fiIndex+1]);
  const docs = await collectDocs(root, config.exclude || []);
  console.log(`Found ${docs.length} docs (root: ${root})`);
  await ensureDir(PROPOSED_DIR);
  const {clusters, map} = await buildSimilarityMap(docs, config.similarityThreshold || 0.92);
  await fs.writeFile(path.join(PROPOSED_DIR,'similarity-map.json'), JSON.stringify(map,null,2),'utf8');
  // synthesize clusters
  const proposed = [];
  const upsertRows = [];
  for (const c of clusters){
    if (c.items.length <= 1) continue;
    const out = await synthesizeCluster(c, PROPOSED_DIR, config);
    proposed.push({out, files: c.items.map(x=>x.path)});
    // read content and compute embedding for merged file
    try{
      const content = await fs.readFile(out,'utf8');
      const emb = await computeEmbedding(content);
      upsertRows.push({ path: out.replace(process.cwd() + path.sep, ''), content, embedding: emb });
    }catch(e){ console.warn('Failed to read/embed proposed file', out, e.message); }
  }
  // stale detection
  const stale = [];
  for (const c of clusters){
    for (const it of c.items){
      if (await detectStale(it, config.deprecatedTerms || [])) stale.push(it.path);
    }
  }
  await fs.writeFile(path.join(PROPOSED_DIR,'stale.json'), JSON.stringify(stale,null,2),'utf8');
  console.log(`Proposed ${proposed.length} merges; flagged ${stale.length} stale files`);

  // optionally sync merged docs to Supabase vector table
  if (args.includes('--sync') || config.supabase?.enabled){
    await syncToSupabase(upsertRows, config);
  }

  // create git branch and commit
  const branch = `cleanup/docs-reorg-${new Date().toISOString().slice(0,10)}`;
  try {
    gitRun(`git checkout -b ${branch}`);
  } catch (e) {
    console.warn('Branch may already exist, attempting checkout');
    gitRun(`git checkout ${branch}`);
  }
  // copy proposed files into repo under tmp/proposed_merges (already there)
  // add changes
  try {
    gitRun('git add -f tmp/proposed_merges');
    gitRun(`git commit -m "chore(docs): proposed merges and stale report by docs-reorg"`);
  } catch(e){ console.warn('No changes to commit or commit failed:',e.message); }

  const remote = process.env.GIT_REMOTE || 'origin';

  const isDryRun = args.includes('--dry-run');
  if (!isDryRun){
    try {
      gitRun(`git push -u ${remote} ${branch}`);
    } catch (e) { console.warn('Push failed:', e.message); }
  } else {
    console.log('DRY RUN: skipping git push for branch', branch);
  }

  // Create PR if GITHUB_TOKEN set and user didn't opt-out
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY && !args.includes('--no-pr')){
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    const body = `This PR was generated by automated docs reorg. Proposed merges: ${proposed.length}. Stale files: ${stale.length}. See tmp/proposed_merges/ for details.`;
    // Respect args or config for draft behavior: --draft / --open-pr or config.prDraftDefault
    let draft = Boolean(config.prDraftDefault);
    if (args.includes('--draft')) draft = true;
    if (args.includes('--open-pr')) draft = false;

    // In dry-run mode, instead of pushing, write a local PR payload for review
    const prPayload = { title: `chore(docs): proposed reorg ${new Date().toISOString().slice(0,10)}`, head: branch, base: 'main', body, draft };
    if (isDryRun){
      await fs.writeFile(path.join(PROPOSED_DIR,'pr-payload.json'), JSON.stringify(prPayload,null,2),'utf8');
      console.log('DRY RUN: wrote local PR payload to tmp/proposed_merges/pr-payload.json');
      if (args.includes('--create-pr')){
        console.log('--create-pr specified: attempting to create PR on GitHub even in dry-run mode');
        // attempt to create PR (may fail if branch not pushed); tests may mock this call
        try{
          const url = `https://api.github.com/repos/${owner}/${repo}/pulls`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}`, 'Content-Type':'application/json', 'Accept':'application/vnd.github.v3+json'},
            body: JSON.stringify(prPayload)
          });
          const jr = await res.json();
          if (jr.html_url) console.log('PR created (dry-run create):', jr.html_url);
          else console.warn('PR creation (dry-run) failed', jr);
        }catch(e){ console.warn('PR creation (dry-run) attempt failed:', e.message); }
      }
    } else {
      console.log('Creating PR via GitHub API (draft:', draft, ')...');
      // minimal octokit usage via fetch
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}`, 'Content-Type':'application/json', 'Accept':'application/vnd.github.v3+json'},
        body: JSON.stringify(prPayload)
      });
      const jr = await res.json();
      if (jr.html_url) console.log('PR created:', jr.html_url);
      else console.warn('PR creation failed', jr);
    }
  } else {
    console.log('GITHUB_TOKEN or GITHUB_REPOSITORY not set or --no-pr provided; skipped PR creation. Branch:', branch);
  }
}

async function main(){
  const args = process.argv.slice(2);
  const cfg = await readConfig();
  if (args.includes('--once')) return runOnce(cfg);
  if (args.includes('--daemon')){
    console.log('Launching docs-reorg daemon; scheduling daily 02:00 job (local timer)');
    // simple daily timer using setInterval
    const now = new Date();
    const next = new Date(); next.setHours(2,0,0,0);
    if (next <= now) next.setDate(next.getDate()+1);
    const delay = next - now;
    setTimeout(async ()=>{
      await runOnce(cfg);
      // then every 24h
      setInterval(async()=>{ try{ await runOnce(cfg);}catch(e){console.error(e);} }, 24*3600*1000);
    }, delay);
    // keep process alive
    process.stdin.resume();
    return;
  }
  // default behavior: run once
  await runOnce(cfg);
}

main().catch(e=>{console.error(e); process.exit(1);});
