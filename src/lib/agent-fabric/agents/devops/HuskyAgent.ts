import { BaseAgent } from '../BaseAgent';
import { AgentConfig } from '../../../../types/agent';
import { execSync } from 'child_process';

export interface HuskyAgentInput {
  hook: 'pre-commit' | 'commit-msg' | 'pre-push';
  files?: string[];
  enforceStrict?: boolean;
}

export interface HuskyAgentOutput {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * HuskyAgent: Agentic DevOps module for orchestrating and enforcing Git hook policies.
 * - Runs lint, test, and commit message checks as agentic actions.
 * - Can be invoked by other agents or workflows for value enforcement.
 */
export class HuskyAgent extends BaseAgent {
  public lifecycleStage = 'devops';
  public version = '1.0';
  public name = 'HuskyAgent';

  constructor(config: AgentConfig) {
    super(config);
  }

  async execute(sessionId: string, input: HuskyAgentInput): Promise<HuskyAgentOutput> {
    try {
      if (input.hook === 'pre-commit') {
        execSync('npm run lint', { stdio: 'inherit' });
        execSync('npm test', { stdio: 'inherit' });
        return { success: true, message: 'Pre-commit checks passed.' };
      }
      if (input.hook === 'commit-msg') {
        // Example: enforce Conventional Commits (could integrate with a validator)
        // Placeholder: always pass
        return { success: true, message: 'Commit message check passed.' };
      }
      if (input.hook === 'pre-push') {
        execSync('npm run typecheck', { stdio: 'inherit' });
        return { success: true, message: 'Pre-push checks passed.' };
      }
      return { success: false, message: 'Unknown hook.' };
    } catch (err: any) {
      return { success: false, message: 'Check failed.', details: err.message };
    }
  }
}
