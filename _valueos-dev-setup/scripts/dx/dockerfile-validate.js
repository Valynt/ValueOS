#!/usr/bin/env node
/*
  Simple Dockerfile hardening validator.
  - Ensures non-root user in final stages
  - Ensures no build toolchains (build-essential, python3-dev) in final runtime stages
  - Ensures COPYs that bring app files use --chown (heuristic: look for COPY . / or COPY . .)
  - Ensures EXPOSE ports are listed in config/ports.json

  Usage: node scripts/dx/dockerfile-validate.js
*/
const fs = require('fs');
const path = require('path');

function readFile(p){ return fs.readFileSync(p,'utf8'); }

const repoRoot = path.resolve(__dirname, '..', '..');
const configPorts = require(path.join(repoRoot, 'config', 'ports.json'));
const allowedPorts = new Set(Object.values(configPorts).flatMap(o=>Object.values(o).filter(v=>Number.isInteger(v))));

const dockerfiles = [];
// Common Dockerfile locations
['Dockerfile', 'Dockerfile.build', 'Dockerfile.optimized', 'Dockerfile.optimized.agent', 'Dockerfile.optimized.frontend', '.devcontainer/Dockerfile.dev', '.devcontainer/Dockerfile.optimized']
  .forEach(p => { const abs = path.join(repoRoot, p); if(fs.existsSync(abs)) dockerfiles.push(abs); });

let failed = false;
function error(msg){ console.error('\u001b[31mERROR:\u001b[0m', msg); failed = true; }
function warn(msg){ console.warn('\u001b[33mWARN:\u001b[0m', msg); }

for(const file of dockerfiles){
  const content = readFile(file);
  console.log('Checking', path.relative(repoRoot, file));

  // Check for COPY of workspace roots without --chown
  const copyRootRegex = /COPY\s+(?:--from=[^\s]+\s+)?(\.|\.|\/)\s+.*$/gm;
  let m;
  while((m = copyRootRegex.exec(content))){
    const line = m[0];
    if(!/--chown=/.test(line)){
      warn(`${path.relative(repoRoot,file)}: COPY of project files without --chown detected: \n  ${line}`);
    }
  }

  // Check final stage for build tool installs: find last FROM .. AS <name> or just last FROM
  const fromRegex = /^FROM\s+(.+?)(?:\s+AS\s+(\w+))?$/gim;
  let lastFrom;
  while((m = fromRegex.exec(content))){ lastFrom = {line:m[0], image:m[1].trim(), alias:m[2]||null, idx:m.index}; }

  // Determine lines after last FROM
  const tail = content.slice(lastFrom ? lastFrom.idx : 0);
  // Check if tail includes apt-get install of build-essential or python3-dev or apk add build-base
  if(/apt-get\s+install[\s\S]*?(build-essential|python3-dev)/.test(tail) || /apk\s+add[\s\S]*?(build-base|python3-dev)/.test(tail)){
    error(`${path.relative(repoRoot,file)}: runtime stage installs build toolchains (build-essential, python3-dev, build-base) - move them to build stages`);
  }

  // Check non-root: look for 'USER ' or 'nonroot' in base image
  const hasUser = /(^|\n)USER\s+[^\n]+/m.test(tail);
  const baseIsNonRoot = /nonroot/.test(lastFrom ? lastFrom.image : '');
  if(!hasUser && !baseIsNonRoot){
    warn(`${path.relative(repoRoot,file)}: runtime stage has no explicit non-root USER nor nonroot base image. Add a non-privileged user and a USER instruction.`);
  }

  // Check EXPOSE port(s) and validate
  const exposeRegex = /(^|\n)EXPOSE\s+(\d+)/gim;
  let foundExpose = false;
  while((m = exposeRegex.exec(content))){
    foundExpose = true;
    const p = Number(m[2]);
    if(!allowedPorts.has(p)){
      error(`${path.relative(repoRoot,file)}: EXPOSE ${p} is not present in config/ports.json`);
    }
  }

  // Allow ARG EXPOSE_PORT pattern as well - attempt to find ARG default and validate
  const argRegex = /(^|\n)ARG\s+EXPOSE_PORT(?:=(\d+))?/gim;
  while((m = argRegex.exec(content))){
    const def = m[2] ? Number(m[2]) : null;
    if(def && !allowedPorts.has(def)){
      error(`${path.relative(repoRoot,file)}: ARG EXPOSE_PORT default ${def} is not present in config/ports.json`);
    }
  }
}

if(failed){
  console.error('\nOne or more Dockerfile hardening checks failed.');
  process.exit(2);
}
console.log('\nDockerfile hardening checks passed.');
process.exit(0);
