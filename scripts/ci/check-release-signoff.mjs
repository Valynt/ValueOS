#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
const failures = [];

function readArg(flag) {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function normalizeRelease(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const shortTag = trimmed.startsWith('refs/tags/') ? trimmed.slice('refs/tags/'.length) : trimmed;
  const match = shortTag.match(/^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/);
  if (!match) return null;
  return match[0].startsWith('v') ? match[0] : `v${match[0]}`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fail(message) {
  console.error(`❌ ${message}`);
  failures.push(message);
}

function pass(message) {
  console.log(`✅ ${message}`);
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} is missing at ${filePath}.`);
    return null;
  }

  pass(`${label} exists at ${filePath}.`);
  return fs.readFileSync(filePath, 'utf8');
}

const signoffPath = readArg('--signoff') ?? 'docs/operations/release-scope-ga-signoff.md';
const threatModelPath = readArg('--threat-model') ?? 'docs/security-compliance/threat-model.md';
const evidenceIndexPath = readArg('--evidence-index') ?? 'docs/security-compliance/evidence-index.md';
const packageJsonPath = readArg('--package-json') ?? 'package.json';
const explicitRelease = normalizeRelease(
  readArg('--release') ??
    process.env.RELEASE_VERSION ??
    process.env.RELEASE_TAG ??
    process.env.GITHUB_REF_NAME ??
    process.env.GITHUB_REF
);

const signoff = requireFile(signoffPath, 'Release sign-off document');
const threatModel = requireFile(threatModelPath, 'Threat model document');
const evidenceIndex = requireFile(evidenceIndexPath, 'Evidence index document');
const packageJsonRaw = requireFile(packageJsonPath, 'package.json');

let packageVersion = null;
if (packageJsonRaw) {
  try {
    const parsed = JSON.parse(packageJsonRaw);
    packageVersion = normalizeRelease(parsed.version);
    if (!packageVersion) {
      fail(`Unable to derive a semantic version from ${packageJsonPath}.`);
    } else {
      pass(`Derived release ${packageVersion} from ${packageJsonPath}.`);
    }
  } catch (error) {
    fail(`Unable to parse ${packageJsonPath}: ${error.message}`);
  }
}

const targetRelease = explicitRelease ?? packageVersion;
if (!targetRelease) {
  fail('Unable to determine the target release. Pass --release or set RELEASE_VERSION/RELEASE_TAG.');
} else {
  pass(`Target release resolved to ${targetRelease}.`);
}

if (explicitRelease && packageVersion && explicitRelease !== packageVersion) {
  fail(`Workflow target release ${explicitRelease} does not match package.json version ${packageVersion}.`);
}

let signoffRelease = null;
if (signoff) {
  const releaseMatch = signoff.match(/^\*\*Release:\*\*.*?`([^`]+)`/m);
  if (!releaseMatch) {
    fail(`Could not find a release tag in ${signoffPath}.`);
  } else {
    signoffRelease = normalizeRelease(releaseMatch[1]);
    pass(`Sign-off document declares ${signoffRelease}.`);
    if (targetRelease && signoffRelease !== targetRelease) {
      fail(`Sign-off document release ${signoffRelease} does not match target release ${targetRelease}.`);
    }
  }

  const requiredApprovers = ['Product', 'Engineering', 'Security'];
  for (const approver of requiredApprovers) {
    const lineRegex = new RegExp(
      '^- \\*\\*' + approver + ':\\*\\*.*?signed:\\s*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z)',
      'm'
    );
    const lineMatch = signoff.match(lineRegex);
    if (!lineMatch) {
      fail(`${signoffPath} is missing a ${approver} approver with an explicit signed timestamp.`);
      continue;
    }
    pass(`${approver} approver has explicit signed timestamp ${lineMatch[1]}.`);
  }
}

if (threatModel && targetRelease) {
  const releasePattern = new RegExp(
    '^\\|\\s*`' +
      escapeRegex(targetRelease) +
      '`\\s*\\|\\s*`([^`]+)`\\s*\\|\\s*`([^`]+)`\\s*\\|\\s*`([^`]+)`\\s*\\|',
    'm'
  );
  const match = threatModel.match(releasePattern);
  if (!match) {
    fail(`${threatModelPath} does not contain a Review and Approver Record row for ${targetRelease}.`);
  } else {
    pass(`${threatModelPath} contains the review record for ${targetRelease}.`);
  }
}

if (evidenceIndex && targetRelease) {
  const headingPattern = new RegExp('^## Release evidence bundle chain .*' + escapeRegex(targetRelease) + '.*$', 'm');
  const releaseMentionPattern = new RegExp(escapeRegex(targetRelease));
  const signoffMention = evidenceIndex.includes(signoffPath);
  const threatMention = evidenceIndex.includes(threatModelPath);

  if (!headingPattern.test(evidenceIndex) && !releaseMentionPattern.test(evidenceIndex)) {
    fail(`${evidenceIndexPath} does not mention the release evidence bundle for ${targetRelease}.`);
  } else {
    pass(`${evidenceIndexPath} mentions the release evidence bundle for ${targetRelease}.`);
  }

  if (!signoffMention) {
    fail(`${evidenceIndexPath} does not link ${signoffPath}.`);
  } else {
    pass(`${evidenceIndexPath} links ${signoffPath}.`);
  }

  if (!threatMention) {
    fail(`${evidenceIndexPath} does not link ${threatModelPath}.`);
  } else {
    pass(`${evidenceIndexPath} links ${threatModelPath}.`);
  }
}

if (failures.length > 0) {
  console.error(`\nRelease sign-off validation failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`\nRelease sign-off validation passed for ${targetRelease}.`);
