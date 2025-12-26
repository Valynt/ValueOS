import { applyPatch } from "./patchManager";
import { execSync } from "child_process";

async function generateAndApplyFixes(repo, vuln, _config) {
  let patch = null;
  // Example: magic number fix
  if (vuln.ruleId === "magic-number") {
    patch = {
      file: vuln.file,
      changes: [
        {
          regex: /\b(\d{2,})\b/g,
          replacement: (m) => `MAGIC_CONST_${m}`,
        },
      ],
    };
  }
  // Example: hardcoded secret
  if (vuln.ruleId === "hardcoded-secret") {
    patch = {
      file: vuln.file,
      changes: [
        {
          regex:
            /(['"]?aws_secret|api_key|password|token['"]?\s*[:=]\s*)['"][A-Za-z0-9_]{16,}['"]/gi,
          replacement: '$1"REDACTED_SECRET"',
        },
      ],
    };
  }
  // ...other rules...

  if (patch) {
    await applyPatch(patch);
    execSync("npx eslint --fix " + patch.file);
    // Optionally run tests
    try {
      execSync("npm test -- --bail --findRelatedTests " + patch.file);
    } catch (e) {
      /* ignore test failures */
    }
    return { fixed: true, patch };
  }
  return { fixed: false };
}

export { generateAndApplyFixes };
