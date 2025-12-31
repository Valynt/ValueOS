# ValueCanvas - Quick Start

Get up and running in 5 minutes!

## Prerequisites

- Node.js v18+ ([download](https://nodejs.org))
- Docker ([download](https://www.docker.com/products/docker-desktop))
- Supabase CLI: `npm install -g supabase`

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.local .env
# Edit .env and add your LLM API key

# 3. Start everything
./start.sh
```

That's it! Open http://localhost:5173

## What You Get

✅ **LLM-MARL System**
- CoordinatorAgent for task planning
- MessageBus for agent communication
- Episodic memory for learning
- Simulation loop for "what-if" analysis

✅ **Generative UI**
- Dynamic component selection
- LLM-powered layout generation
- Automatic refinement (3 iterations)
- Continuous learning from interactions

✅ **SOF Framework**
- System mapping
- Intervention design
- Outcome engineering
- Feedback loop monitoring

## Manual Setup

If `./start.sh` doesn't work:

```bash
# Install dependencies
npm install

# Start Supabase
supabase start

# Run migrations
supabase db push

# Start dev server
npm run dev
```

## Test Your Setup

```bash
# Run verification script
node test-setup.js

# Run tests
npm test
```

## Get LLM API Key

**Together.ai** (Recommended):
1. Go to https://together.ai
2. Sign up and get API key
3. Add to `.env`: `VITE_LLM_API_KEY=your-key`

**OpenAI** (Alternative):
1. Go to https://platform.openai.com
2. Get API key
3. Set in `.env`: `VITE_LLM_PROVIDER=openai`

## Troubleshooting

### "npm not found"
Install Node.js from https://nodejs.org

### "Docker not running"
Start Docker Desktop

### "Supabase connection failed"
```bash
supabase stop
supabase start
```

### "Port 5173 in use"
```bash
npm run dev -- --port 3000
```

## Documentation

- **Setup Guide**: See `docs/getting-started/setup/` for detailed guides
- **LLM-MARL**: See `docs/architecture/` for LLM-MARL documentation
- **Generative UI**: See `docs/features/` for UI generation docs
- **SOF Guide**: See `docs/features/` for SOF implementation guide

## Key Features

### Dynamic UI Generation
```typescript
import { CoordinatorAgent } from './src/agents/CoordinatorAgent';

const coordinator = new CoordinatorAgent();
coordinator.setDynamicUIEnabled(true);

const layout = await coordinator.produceSDUILayout(subgoal);
// LLM selects optimal components and layout!
```

### Agent Communication
```typescript
import { CommunicatorAgent } from './src/agents/CommunicatorAgent';

const comm = new CommunicatorAgent('MyAgent');
await comm.sendMessage('TargetAgent', 'task_assignment', data);
```

### Workflow Simulation
```typescript
import { workflowOrchestrator } from './src/services/WorkflowOrchestrator';

const simulation = await workflowOrchestrator.simulateWorkflow(
  workflowId,
  context
);
console.log('Success probability:', simulation.success_probability);
```

## Architecture

```
User Request
    ↓
CoordinatorAgent (plans task)
    ↓
MessageBus (agent communication)
    ↓
Specialized Agents (execute)
    ↓
Dynamic UI Generation (LLM-powered)
    ↓
UI Refinement Loop (3 iterations)
    ↓
User Interaction
    ↓
Metrics & Learning
```

## Development

```bash
# Start dev server
npm run dev

# Run tests
npm test

# Run specific tests
npm test test/llm-marl

# Build for production
npm run build
```

## URLs

- **Application**: http://localhost:5173
- **Supabase Studio**: http://localhost:54323
- **API**: http://localhost:54321

## Next Steps

1. ✅ Complete setup
2. ✅ Test dynamic UI generation
3. ✅ Explore agent communication
4. ✅ Try workflow simulation
5. ✅ Review documentation

## Support

- Check `docs/getting-started/setup/` for detailed help
- Review error messages in browser console
- Check Supabase logs: `supabase logs`

---

**Ready to build intelligent, self-improving UIs!** 🚀
