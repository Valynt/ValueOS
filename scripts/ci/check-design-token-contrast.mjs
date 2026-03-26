#!/usr/bin/env node
/**
 * REQ-A3: Design token contrast check
 *
 * Reads the canonical ValueOS palette from valueos-palette.css and checks
 * that all foreground/background token pairs used for text meet WCAG AA
 * contrast ratio (4.5:1 for normal text, 3:1 for large text).
 *
 * Exits 1 if any pair fails.
 */

import { readFileSync } from 'node:fs';

const PALETTE_PATH = new URL(
  '../../apps/ValyntApp/src/styles/valueos-palette.css',
  import.meta.url
).pathname;

// ---------------------------------------------------------------------------
// HSL → relative luminance
// ---------------------------------------------------------------------------

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function linearize(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r, g, b) {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Parse CSS custom properties (HSL format: "H S% L%")
// ---------------------------------------------------------------------------

function parseTokens(css) {
  const tokens = {};
  const re = /--([\w-]+):\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    tokens[m[1]] = { h: Number(m[2]), s: Number(m[3]), l: Number(m[4]) };
  }
  return tokens;
}

function luminanceForToken(tokens, name) {
  const t = tokens[name];
  if (!t) return null;
  const [r, g, b] = hslToRgb(t.h, t.s, t.l);
  return relativeLuminance(r, g, b);
}

// ---------------------------------------------------------------------------
// Token pairs to check (foreground, background)
// WCAG AA: normal text ≥ 4.5:1, large text ≥ 3:1
// ---------------------------------------------------------------------------

const PAIRS = [
  // Light mode
  { fg: 'valueos-neutral-foreground', bg: 'valueos-neutral-background', label: 'body text / page background (light)', minRatio: 4.5 },
  { fg: 'valueos-neutral-foreground', bg: 'valueos-neutral-surface', label: 'body text / surface (light)', minRatio: 4.5 },
  { fg: 'valueos-neutral-foreground', bg: 'valueos-neutral-subtle', label: 'body text / subtle (light)', minRatio: 4.5 },
  { fg: 'valueos-primary-foreground', bg: 'valueos-primary', label: 'primary button text / primary bg (light)', minRatio: 4.5 },
  { fg: 'valueos-secondary-foreground', bg: 'valueos-secondary', label: 'secondary button text / secondary bg (light)', minRatio: 4.5 },
  { fg: 'valueos-neutral-muted', bg: 'valueos-neutral-background', label: 'muted text / page background (light)', minRatio: 4.5 },
  { fg: 'valueos-on-status', bg: 'valueos-success', label: 'on-status text / success bg (light)', minRatio: 3.0 },
  { fg: 'valueos-on-status', bg: 'valueos-warning', label: 'on-status text / warning bg (light)', minRatio: 3.0 },
  { fg: 'valueos-on-status', bg: 'valueos-error', label: 'on-status text / error bg (light)', minRatio: 3.0 },
];

// ---------------------------------------------------------------------------
// Run checks
// ---------------------------------------------------------------------------

const css = readFileSync(PALETTE_PATH, 'utf8');

// Parse light mode tokens (before .dark block)
const darkStart = css.indexOf('.dark');
const lightCss = darkStart !== -1 ? css.slice(0, darkStart) : css;
const darkCss = darkStart !== -1 ? css.slice(darkStart) : '';

const lightTokens = parseTokens(lightCss);
const darkTokens = { ...lightTokens, ...parseTokens(darkCss) };

const failures = [];
const results = [];

for (const pair of PAIRS) {
  for (const [mode, tokens] of [['light', lightTokens], ['dark', darkTokens]]) {
    const fgL = luminanceForToken(tokens, pair.fg);
    const bgL = luminanceForToken(tokens, pair.bg);

    if (fgL === null || bgL === null) {
      results.push({ mode, label: pair.label, ratio: null, pass: false, reason: 'token not found' });
      continue;
    }

    const ratio = contrastRatio(fgL, bgL);
    const pass = ratio >= pair.minRatio;

    results.push({ mode, label: pair.label, ratio: ratio.toFixed(2), pass, minRatio: pair.minRatio });

    if (!pass) {
      failures.push({ mode, label: pair.label, ratio: ratio.toFixed(2), minRatio: pair.minRatio, fg: pair.fg, bg: pair.bg });
    }
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

console.log('Design token contrast check\n');
for (const r of results) {
  const icon = r.pass ? '✅' : '❌';
  const ratioStr = r.ratio !== null ? `${r.ratio}:1 (min ${r.minRatio}:1)` : `MISSING TOKEN`;
  console.log(`  ${icon} [${r.mode}] ${r.label} — ${ratioStr}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} contrast failure(s):\n`);
  for (const f of failures) {
    console.error(`  [${f.mode}] ${f.label}`);
    console.error(`    tokens: --${f.fg} on --${f.bg}`);
    console.error(`    ratio:  ${f.ratio}:1 (required ≥ ${f.minRatio}:1)\n`);
  }
  process.exit(1);
}

console.log('\nAll token pairs meet WCAG AA contrast requirements.');
