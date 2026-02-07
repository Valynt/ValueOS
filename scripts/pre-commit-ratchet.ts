import { execSync } from "child_process";

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--analyze-baseline")) {
    console.log("ℹ️ --analyze-baseline is deprecated; running unified ratchet check instead.");
  }

  console.log("🔍 Running pre-commit TypeScript ratchet check...");
  execSync("pnpm ts:ratchet:check", { stdio: "inherit" });
}

main();
