import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('DevContainer Playwright Subagent', () => {
  it('includes the Playwright subagent in compose file', () => {
    const composePath = path.join(process.cwd(), '.devcontainer', 'docker-compose.subagents.yml');
    const content = fs.readFileSync(composePath, 'utf8');
    expect(content).toContain('subagent-playwright');
  });
});
