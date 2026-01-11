#!/usr/bin/env node

/**
 * Port lint: ensure known docs/scripts use configured port values.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPorts } from './ports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const filesToScan = [
  'README.md',
  'QUICKSTART.md',
  'docs/getting-started/GETTING_STARTED.md',
  'docs/getting-started/LOCAL_SETUP_GUIDE.md',
  'scripts/dev/setup.sh',
  'scripts/start.sh',
  'scripts/start-docker.sh',
  'scripts/dx/setup.js',
  'scripts/verify-deployment.sh'
];

function collectPortValues(value, accumulator) {
  if (typeof value === 'number') {
    accumulator.add(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectPortValues(item, accumulator));
    return;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach(item => collectPortValues(item, accumulator));
  }
}

function extractPortsFromLine(line) {
  const ports = [];
  const patterns = [
    /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\[::\]):(\d{2,5})/g,
    /\bport\s*(?:=|:)?\s*(\d{2,5})\b/gi,
    /\bPORT\s*=\s*(\d{2,5})\b/g,
    /\b(\d{2,5})\s*:\s*(\d{2,5})\b/g
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(line)) !== null) {
      if (pattern.source.includes('\\s*:\\s*')) {
        ports.push(Number(match[1]));
        ports.push(Number(match[2]));
      } else {
        ports.push(Number(match[1]));
      }
    }
  });

  return ports;
}

function lintPorts() {
  const allowedPorts = new Set();
  collectPortValues(loadPorts(), allowedPorts);
  const failures = [];

  filesToScan.forEach((relativePath) => {
    const absolutePath = path.resolve(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      return;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const ports = extractPortsFromLine(line);
      ports.forEach((port) => {
        if (!allowedPorts.has(port)) {
          failures.push({
            file: relativePath,
            line: index + 1,
            port,
            snippet: line.trim()
          });
        }
      });
    });
  });

  if (failures.length > 0) {
    console.error('❌ Port lint failed. Unknown port literals found:\n');
    failures.forEach((failure) => {
      console.error(
        `- ${failure.file}:${failure.line} uses ${failure.port} -> ${failure.snippet}`
      );
    });
    console.error('\nUpdate config/ports.json or replace literals with ${VITE_PORT}/${API_PORT}.');
    process.exit(1);
  }

  console.log('✅ Port lint passed.');
}

lintPorts();
