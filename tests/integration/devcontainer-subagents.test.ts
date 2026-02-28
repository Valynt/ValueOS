import * as fs from 'fs';
import * as path from 'path';

import { describe, expect, it } from 'vitest';

describe('DevContainer Subagents', () => {
  it('includes subagent compose file in devcontainer.json', () => {
    const devcontainerPath = path.join(process.cwd(), '.devcontainer', 'devcontainer.json');
    const config = JSON.parse(fs.readFileSync(devcontainerPath, 'utf8'));
    expect(config.dockerComposeFile).toContain('docker-compose.subagents.yml');
  });

  it('includes optional tools install in postCreateCommand', () => {
    const devcontainerPath = path.join(process.cwd(), '.devcontainer', 'devcontainer.json');
    const config = JSON.parse(fs.readFileSync(devcontainerPath, 'utf8'));
    expect(config.postCreateCommand).toContain('install-optional-tools.sh');
  });

  it('adds error lens extension to extensions list', () => {
    const devcontainerPath = path.join(process.cwd(), '.devcontainer', 'devcontainer.json');
    const config = JSON.parse(fs.readFileSync(devcontainerPath, 'utf8'));
    const extensions = config.extensions || (config.customizations && config.customizations.vscode && config.customizations.vscode.extensions);
    expect(extensions).toBeDefined();
    expect(extensions).toContain('usernamehw.errorlens');
  });
});
