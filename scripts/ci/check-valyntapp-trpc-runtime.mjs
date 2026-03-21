import { readFile } from "node:fs/promises";

const targetPath = new URL("../../apps/ValyntApp/src/lib/trpc.ts", import.meta.url);
const source = await readFile(targetPath, "utf8");

const violations = [
  {
    description: 'contains the phrase "test-only stub"',
    test: /test-only stub/i.test(source),
  },
  {
    description: "exports trpc as an unknown placeholder",
    test: /export\s+const\s+trpc\s*:\s*unknown\s*=\s*\{\s*\}/.test(source),
  },
];

const failures = violations.filter((violation) => violation.test);

if (failures.length > 0) {
  console.error("ValyntApp runtime tRPC client guard failed:");
  for (const failure of failures) {
    console.error(`- apps/ValyntApp/src/lib/trpc.ts ${failure.description}`);
  }
  process.exit(1);
}
