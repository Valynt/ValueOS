import { HuskyAgent } from './HuskyAgent';
import { AgentConfig } from '../../../../types/agent';

const hook = process.argv[2] as 'pre-commit' | 'commit-msg' | 'pre-push';

(async () => {
  const agent = new HuskyAgent({} as AgentConfig); // Supply real config if needed
  const result = await agent.execute('local', { hook });
  if (!result.success) {
    console.error(result.message);
    process.exit(1);
  }
  process.exit(0);
})();
