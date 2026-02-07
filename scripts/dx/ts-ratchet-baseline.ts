import * as fs from "fs";
import * as path from "path";

export interface RatchetBaselines {
  packageBaselines: Record<string, number>;
  packageBaselinePaths: Record<string, string>;
}

function listWorkspacePackageDirs(projectRoot: string): string[] {
  const roots = ["apps", "packages"];
  const dirs: string[] = [];

  for (const root of roots) {
    const rootPath = path.join(projectRoot, root);
    if (!fs.existsSync(rootPath)) continue;

    const entries = fs.readdirSync(rootPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) dirs.push(`${root}/${entry.name}`);
    }
  }

  return dirs;
}

export function loadRatchetBaselines(projectRoot: string): RatchetBaselines {
  const globalBaselinePath = path.join(projectRoot, ".github/ts-error-baseline.json");
  const packageDirs = listWorkspacePackageDirs(projectRoot);

  const packageBaselines: Record<string, number> = {};
  const packageBaselinePaths: Record<string, string> = {};

  for (const pkg of packageDirs) {
    const baselinePath = path.join(projectRoot, pkg, ".ts-debt.json");
    if (!fs.existsSync(baselinePath)) continue;

    let parsed: { baseline?: unknown };
    try {
      parsed = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    } catch {
      throw new Error(`Invalid baseline JSON in ${baselinePath}`);
    }

    if (typeof parsed.baseline === "number") {
      packageBaselines[pkg] = parsed.baseline;
      packageBaselinePaths[pkg] = baselinePath;
    }
  }

  const hasGlobalBaseline = fs.existsSync(globalBaselinePath);
  const hasPackageBaselines = Object.keys(packageBaselines).length > 0;

  if (hasGlobalBaseline && hasPackageBaselines) {
    throw new Error(
      "Baseline migration check failed: both .github/ts-error-baseline.json and per-package .ts-debt.json files exist. Remove the global file and keep per-package baselines."
    );
  }

  if (hasGlobalBaseline) {
    throw new Error(
      "Baseline model is per-package only. Found legacy .github/ts-error-baseline.json; migrate to apps/*/.ts-debt.json and packages/*/.ts-debt.json."
    );
  }

  if (!hasPackageBaselines) {
    throw new Error(
      "No per-package TypeScript ratchet baselines found. Add .ts-debt.json files under apps/* and packages/*."
    );
  }

  return { packageBaselines, packageBaselinePaths };
}

export function listWorkspacePackageDirsForUpdate(projectRoot: string): string[] {
  return listWorkspacePackageDirs(projectRoot);
}
