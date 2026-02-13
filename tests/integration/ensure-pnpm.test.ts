import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
const execFileAsync = promisify(execFile);

describe('DevContainer ensure-pnpm script', () => {
  it('activates pnpm using a corepack stub when pnpm is missing', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(process.cwd(), 'tmp/test-ensure-pnpm-'));
    const binDir = path.join(tmpRoot, 'bin');
    await fs.mkdir(binDir, { recursive: true });

    const corepackPath = path.join(binDir, 'corepack');
    const pnpmPath = path.join(binDir, 'pnpm');

    const corepackScript = `#!/usr/bin/env bash
set -e
# Simulate corepack behavior: "corepack prepare pnpm@X --activate" will write a pnpm shim
if [[ "$1" == "enable" ]]; then
  exit 0
fi
if [[ "$1" == "prepare" ]]; then
  cat > "${pnpmPath}" <<'EOF'
#!/usr/bin/env bash
if [[ "$1" == "-v" || "$1" == "--version" ]]; then
  echo "9.15.0"
  exit 0
fi
# simple stub
case "$1" in
  "--version"|"-v") echo "9.15.0" ;;
  *) echo "pnpm stub" ;;
esac
EOF
  chmod +x "${pnpmPath}"
  echo "prepared"
  exit 0
fi
exit 0
`;

    await fs.writeFile(corepackPath, corepackScript, { mode: 0o755 });

    // Ensure PATH has our stub first and that pnpm is not already present
    const env = { ...process.env, PATH: `${binDir}:${process.env.PATH}` };

    const scriptPath = path.join(process.cwd(), '.devcontainer', 'scripts', 'ensure-pnpm.sh');

    const { stdout, stderr } = await execFileAsync('bash', [scriptPath], { env, timeout: 30_000 });

    // Expect script to report pnpm ready with version from our stub
    const combined = `${stdout}\n${stderr}`;
    expect(combined).toMatch(/pnpm (ready|found):?\s*9\.15\.0/);

    // Also directly invoke the stubbed pnpm to ensure it is executable in PATH
    const { stdout: vOut } = await execFileAsync(pnpmPath, ['-v']);
    expect(vOut.trim()).toBe('9.15.0');

    // Cleanup
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });
});
