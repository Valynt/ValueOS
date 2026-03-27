#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const policyPath = path.join(repoRoot, ".github/branch-protection/required-checks.json");
const policy = JSON.parse(await fs.readFile(policyPath, "utf8"));

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
if (!token || !repo) {
  throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
}

const [owner, name] = repo.split("/");
const response = await fetch(`https://api.github.com/repos/${owner}/${name}/branches/main/protection`, {
  headers: {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  },
});
if (!response.ok) {
  throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
}

const protection = await response.json();
const configured = new Set(
  (policy.requiredChecksByBranch.main ?? [])
    .filter((item) => item.required)
    .map((item) => item.check)
);
const remote = new Set(
  (protection.required_status_checks?.checks ?? []).map((check) => check.context)
);

const missing = [...configured].filter((check) => !remote.has(check));
if (missing.length > 0) {
  console.error("Branch protection drift detected. Missing required checks:", missing.join(", "));
  process.exit(1);
}

console.log("Branch protection matches required-checks.json policy.");
