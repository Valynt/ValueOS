import { spawn } from "node:child_process";

const baseArgs = ["vitest", "run", "--reporter=verbose"];
const watchLike = true; // keep looping even after green
const delayMs = 500;

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["inherit", "pipe", "pipe"], ...opts });
    let out = "";
    child.stdout.on("data", (d) => {
      const s = d.toString();
      out += s;
      process.stdout.write(s);
    });
    child.stderr.on("data", (d) => {
      const s = d.toString();
      out += s;
      process.stderr.write(s);
    });
    child.on("close", (code) => resolve({ code, out }));
  });
}

// Heuristic: pick failing test file paths from output.
// Vitest output formats vary; this aims to be "good enough".
function extractFailingFiles(output) {
  const files = new Set();

  // Common patterns include:
  // FAIL  path/to/test.spec.ts
  // ❯ path/to/test.spec.ts (in stack headers)
  const failLine = output.matchAll(/FAIL\s+([^\s]+?\.(test|spec)\.[jt]sx?)/g);
  for (const m of failLine) files.add(m[1]);

  const pathish = output.matchAll(/([^\s'"()]+?\.(test|spec)\.[jt]sx?)/g);
  for (const m of pathish) files.add(m[1]);

  return [...files];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  let targets = [];

  // Loop forever
  for (;;) {
    const args = targets.length
      ? [...baseArgs, ...targets]
      : baseArgs;

    // Run under Node inspector so VS Code can attach/launch easily
    // If you use VS Code "launch" config, it will handle inspector flags there instead.
    const { code, out } = await run("npx", args);

    if (code === 0) {
      console.log("\n✅ All tests passed.");
      if (!watchLike) process.exit(0);
      targets = [];
      await sleep(delayMs);
      continue;
    }

    const failingFiles = extractFailingFiles(out);
    if (failingFiles.length) {
      console.log("\n🔁 Re-running failing files only:\n", failingFiles.join("\n"));
      targets = failingFiles;
    } else {
      // If parsing fails, fall back to running the full suite next loop
      console.log("\n⚠️ Could not parse failing files; falling back to full run.");
      targets = [];
    }

    await sleep(delayMs);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
