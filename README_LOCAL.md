# Running ValueCanvas Locally - Complete Guide

## 🎯 What You're Running

A complete AI-powered business intelligence platform with:

- **LLM-MARL**: Multi-agent reinforcement learning system
- **Generative UI**: Dynamic, self-improving user interfaces
- **SOF**: Systemic Outcome Framework for complex system analysis
- **Episodic Memory**: Learning from every interaction
- **Simulation Engine**: "What-if" analysis before execution

## 📋 Prerequisites Checklist

- [ ] Node.js v18+ installed
- [ ] npm or yarn installed
- [ ] Docker Desktop installed and running
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] LLM API key (Together.ai or OpenAI)

## 🚀 Quick Start (3 Steps)

### Step 1: Install Dependencies

```bash
npm install
```

This installs:
- React + TypeScript
- Supabase client
- Zod for validation
- uuid, lz-string for utilities
- Vitest for testing
- All other dependencies

### Step 2: Configure Environment

```bash
# Copy template
cp .env.local .env

# Edit .env and add:
# - VITE_LLM_API_KEY=your-api-key
# - Other settings as needed
```

### Step 3: Start Everything

```bash
./start.sh
```

This will:
1. Check prerequisites
2. Install dependencies (if needed)
3. Start Supabase (local database)
4. Run database migrations
5. Start development server

**Done!** Open http://localhost:5173

## 🧪 Verify Setup

```bash
# Run verification tests
node test-setup.js

# Should show:
# ✅ Node.js version
# ✅ Required files exist
# ✅ Database migrations
# ✅ Environment configuration
# ✅ Package dependencies
# ✅ Dependencies installed
```

## 📁 Project Structure

```
ValueCanvas/
├── src/
│   ├── agents/                    # AI Agents
│   │   ├── CoordinatorAgent.ts   # Task planning & routing
│   │   ├── CommunicatorAgent.ts  # Inter-agent messaging
│   │   ├── ValueEvalAgent.ts     # Quality scoring
│   │   └── sof/                   # SOF agents
│   ├── services/
│   │   ├── MessageBus.ts          # Agent communication
│   │   ├── UIGenerationTracker.ts # UI metrics
│   │   ├── UIRefinementLoop.ts    # UI improvement
│   │   └── WorkflowOrchestrator.ts # Simulation
│   ├── sdui/
│   │   ├── ComponentToolRegistry.ts # UI components as tools
│   │   ├── schema.ts              # SDUI schema
│   │   └── templates/             # Page templates
│   ├── types/                     # TypeScript types
│   └── lib/                       # Utilities
├── supabase/
│   └── migrations/                # Database migrations
├── test/                          # Test suites
├── docs/                          # Documentation
├── .env                           # Environment config
├── start.sh                       # Startup script
└── test-setup.js                  # Verification script
```

## 🗄️ Database Setup

### Automatic (Recommended)

```bash
./start.sh
# Migrations run automatically
```

### Manual

```bash
# Start Supabase
supabase start

# Run migrations
supabase db push

# Verify
supabase db diff
```

### Tables Created

**SOF System** (6 tables):
- `sof_system_maps` - System representations
- `sof_entities` - System entities
- `sof_relationships` - Entity relationships
- `sof_intervention_points` - Intervention strategies
- `sof_outcome_hypotheses` - Outcome predictions
- `sof_feedback_loops` - Behavior monitoring

**Governance** (2 tables):
- `sof_governance_controls` - Governance policies
- `sof_audit_events` - Audit trail

**Episodic Memory** (4 tables):
- `episodes` - Complete episodes
- `episode_steps` - Step-by-step tracking
- `episode_similarities` - Similarity search
- `simulation_results` - Simulation outcomes

**Artifact Scoring** (2 tables):
- `artifact_scores` - Quality scores
- `artifact_score_history` - Score tracking

**UI Generation** (6 tables):
- `ui_generation_trajectories` - UI generation decisions
- `ui_interaction_events` - User interactions
- `ui_generation_metrics` - Effectiveness metrics
- `ui_generation_feedback` - User feedback
- `component_usage_stats` - Component performance
- `layout_effectiveness` - Layout performance

**Total: 20 new tables**

## 🔑 Environment Variables

Required in `.env`:

```bash
# Supabase (Local)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key

# LLM Configuration
VITE_LLM_PROVIDER=together
VITE_LLM_API_KEY=your-api-key
VITE_LLM_GATING_ENABLED=true

# Feature Flags
VITE_DYNAMIC_UI_ENABLED=true
VITE_UI_REFINEMENT_ENABLED=true
VITE_AGENT_FABRIC_ENABLED=true
```

Get API keys:
- **Together.ai**: https://together.ai (cheaper, recommended)
- **OpenAI**: https://platform.openai.com

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm test test/llm-marl
npm test test/sof

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## 🎨 Features to Try

### 1. Dynamic UI Generation

```typescript
import { CoordinatorAgent } from './src/agents/CoordinatorAgent';

const coordinator = new CoordinatorAgent();
coordinator.setDynamicUIEnabled(true);
coordinator.setUIRefinementEnabled(true);

// Generate UI for any task output
const layout = await coordinator.produceSDUILayout(subgoal);
```

**What happens:**
1. LLM analyzes task context
2. Selects optimal components from 13 documented options
3. Chooses appropriate layout (full_width, two_column, dashboard, etc.)
4. Validates against schema
5. Refines through 3 iterations
6. Tracks metrics for learning

### 2. Agent Communication

```typescript
import { CommunicatorAgent } from './src/agents/CommunicatorAgent';

const comm = new CommunicatorAgent('MyAgent');

// Send message
await comm.sendMessage('TargetAgent', 'task_assignment', {
  task: 'analyze_system',
  data: {...}
});

// Request-response
const result = await comm.request('ValueEvalAgent', {
  artifact_type: 'system_map',
  artifact_id: 'map-123'
});

// Broadcast
await comm.broadcast('status_update', {
  status: 'completed'
});
```

### 3. Workflow Simulation

```typescript
import { workflowOrchestrator } from './src/services/WorkflowOrchestrator';

// Simulate before executing
const simulation = await workflowOrchestrator.simulateWorkflow(
  workflowDefinitionId,
  context
);

console.log('Success probability:', simulation.success_probability);
console.log('Risks:', simulation.risk_assessment);
console.log('Duration estimate:', simulation.duration_estimate_seconds);

// Execute if confidence is high
if (simulation.success_probability > 0.7) {
  const execution = await workflowOrchestrator.executeWorkflow(...);
}
```

### 4. UI Metrics & Learning

```typescript
import { getUIGenerationTracker } from './src/services/UIGenerationTracker';

const tracker = getUIGenerationTracker();

// Get statistics
const stats = await tracker.getAggregateStats();
console.log('Total generations:', stats.total_generations);
console.log('Average quality:', stats.average_quality_score);
console.log('Success rate:', stats.average_task_success_rate);

// Compare methods
const comparison = await tracker.compareGenerationMethods();
console.log('Dynamic UI quality:', comparison.dynamic.avg_quality);
console.log('Static UI quality:', comparison.static.avg_quality);

// Get top components
const topComponents = await tracker.getTopComponents(10);
```

## 🐛 Troubleshooting

### Issue: Dependencies not installing

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Supabase won't start

```bash
# Check Docker is running
docker ps

# Restart Supabase
supabase stop
supabase start

# Check status
supabase status
```

### Issue: Migrations failing

```bash
# Reset database
supabase db reset

# Or manually run migrations
supabase db push
```

### Issue: LLM API errors

```bash
# Test API key
curl https://api.together.xyz/v1/models \
  -H "Authorization: Bearer $VITE_LLM_API_KEY"

# Check .env file
cat .env | grep LLM
```

### Issue: Port already in use

```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or use different port
npm run dev -- --port 3000
```

## 📊 Monitoring

### View Logs

```bash
# Application logs
# Check browser console

# Supabase logs
supabase logs

# Database logs
supabase db logs
```

### Access Supabase Studio

Open http://localhost:54323

- View tables
- Run SQL queries
- Check RLS policies
- Monitor performance

### Check Metrics

```javascript
// In browser console
import { getUIGenerationTracker } from './src/services/UIGenerationTracker';

const tracker = getUIGenerationTracker();
const stats = await tracker.getAggregateStats();
console.table(stats);
```

## 📚 Documentation

- **Quick Start**: `QUICKSTART.md` (5-minute setup)
- **Detailed Setup**: `LOCAL_SETUP_GUIDE.md` (comprehensive)
- **LLM-MARL**: `LLM_MARL_COMPLETE.md` (agent system)
- **Generative UI**: `GENERATIVE_UI_COMPLETE.md` (UI generation)
- **SOF Guide**: `SOF_IMPLEMENTATION_GUIDE.md` (system framework)

## 🎯 Next Steps

1. ✅ Complete setup (you're here!)
2. ✅ Run `node test-setup.js` to verify
3. ✅ Start server with `./start.sh`
4. ✅ Open http://localhost:5173
5. ✅ Try dynamic UI generation
6. ✅ Explore agent communication
7. ✅ Test workflow simulation
8. ✅ Review metrics and learning

## 💡 Tips

- **Enable debug mode**: Set `VITE_SDUI_DEBUG=true` in `.env`
- **Watch tests**: `npm test -- --watch`
- **Check migrations**: `supabase db diff`
- **View database**: Open Supabase Studio
- **Monitor performance**: Check UI generation metrics

## 🆘 Getting Help

1. Check troubleshooting section above
2. Review `LOCAL_SETUP_GUIDE.md`
3. Check browser console for errors
4. Review Supabase logs: `supabase logs`
5. Verify environment variables in `.env`

## 🎉 You're Ready!

You now have a complete AI-powered platform with:
- ✅ Multi-agent system
- ✅ Generative UI
- ✅ Learning from interactions
- ✅ Workflow simulation
- ✅ Comprehensive metrics

**Start building intelligent, self-improving applications!** 🚀

---

**Quick Commands:**

```bash
./start.sh              # Start everything
node test-setup.js      # Verify setup
npm test                # Run tests
npm run dev             # Start dev server
supabase status         # Check database
```
