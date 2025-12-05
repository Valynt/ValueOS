# Local Setup Guide - ValueCanvas with LLM-MARL & Generative UI

This guide will help you run the complete ValueCanvas system locally with all the new features:
- LLM-MARL (Multi-Agent Reinforcement Learning)
- Generative UI System
- SOF (Systemic Outcome Framework)

---

## Prerequisites

### Required Software
1. **Node.js** (v18 or higher)
   ```bash
   node --version  # Should be v18+
   ```

2. **npm** or **yarn**
   ```bash
   npm --version
   ```

3. **Supabase CLI** (for local database)
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Or with Homebrew (Mac)
   brew install supabase/tap/supabase
   ```

4. **Docker** (for Supabase local)
   - Download from https://www.docker.com/products/docker-desktop

---

## Step 1: Clone and Install Dependencies

```bash
# Navigate to project directory
cd /path/to/ValueCanvas

# Install dependencies
npm install

# Install additional dependencies for new features
npm install uuid lz-string
```

---

## Step 2: Set Up Supabase Locally

### Option A: Local Supabase (Recommended for Development)

```bash
# Initialize Supabase
supabase init

# Start local Supabase (requires Docker)
supabase start

# This will output:
# - API URL: http://localhost:54321
# - Anon key: eyJhbGc...
# - Service role key: eyJhbGc...
```

### Option B: Use Supabase Cloud

1. Go to https://supabase.com
2. Create a new project
3. Get your project URL and anon key from Settings > API

---

## Step 3: Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.local .env
```

Edit `.env` with your values:

```bash
# Application
VITE_APP_ENV=development
VITE_APP_URL=http://localhost:5173

# Supabase (Local)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key

# OR Supabase (Cloud)
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-cloud-anon-key

# LLM Configuration
VITE_LLM_PROVIDER=together  # or 'openai'
VITE_LLM_API_KEY=your-together-api-key  # Get from together.ai
VITE_LLM_GATING_ENABLED=true

# Feature Flags
VITE_SDUI_DEBUG=true
VITE_AGENT_FABRIC_ENABLED=true
VITE_DYNAMIC_UI_ENABLED=true
VITE_UI_REFINEMENT_ENABLED=true

# Development
VITE_HMR_ENABLED=true
VITE_SOURCE_MAPS=true
LOG_LEVEL=debug
```

### Get LLM API Keys

**Together.ai** (Recommended - cheaper):
1. Go to https://together.ai
2. Sign up and get API key
3. Add to `.env` as `VITE_LLM_API_KEY`

**OpenAI** (Alternative):
1. Go to https://platform.openai.com
2. Get API key
3. Set `VITE_LLM_PROVIDER=openai`

---

## Step 4: Run Database Migrations

### If Using Local Supabase:

```bash
# Apply all migrations
supabase db push

# Verify migrations
supabase db diff
```

### If Using Supabase Cloud:

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### Manual Migration (if needed):

Run these SQL files in order through Supabase Studio (http://localhost:54321 or your cloud dashboard):

1. `supabase/migrations/20251120000000_create_sof_schema.sql`
2. `supabase/migrations/20251120100000_integrate_sof_governance.sql`
3. `supabase/migrations/20251120110000_create_academy_sof_track.sql`
4. `supabase/migrations/20251120120000_create_episodic_memory.sql`
5. `supabase/migrations/20251120130000_create_artifact_scores.sql`
6. `supabase/migrations/20251120140000_create_ui_generation_metrics.sql`

---

## Step 5: Verify Database Setup

```bash
# Check tables were created
supabase db diff

# Or connect to database
psql postgresql://postgres:postgres@localhost:54322/postgres

# List tables
\dt

# Should see:
# - sof_system_maps
# - sof_entities
# - sof_relationships
# - sof_intervention_points
# - sof_outcome_hypotheses
# - sof_feedback_loops
# - sof_governance_controls
# - sof_audit_events
# - episodes
# - episode_steps
# - simulation_results
# - artifact_scores
# - ui_generation_trajectories
# - ui_interaction_events
# - component_usage_stats
# - layout_effectiveness
```

---

## Step 6: Start Development Server

```bash
# Start the development server
npm run dev

# Server will start at http://localhost:5173
```

You should see:
```
  VITE v5.4.2  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

---

## Step 7: Test the System

### Test 1: Basic Application

1. Open http://localhost:5173
2. You should see the ValueCanvas application
3. Check browser console for any errors

### Test 2: Database Connection

Open browser console and run:
```javascript
// Test Supabase connection
const { data, error } = await supabase.from('business_cases').select('count');
console.log('Database connected:', !error);
```

### Test 3: Dynamic UI Generation

Create a test file `test-dynamic-ui.ts`:

```typescript
import { CoordinatorAgent } from './src/agents/CoordinatorAgent';

async function testDynamicUI() {
  const coordinator = new CoordinatorAgent();
  
  // Enable dynamic UI
  coordinator.setDynamicUIEnabled(true);
  coordinator.setUIRefinementEnabled(true);
  
  // Test subgoal
  const subgoal = {
    id: 'test-123',
    parent_task_id: 'task-123',
    subgoal_type: 'analysis' as const,
    description: 'Test system analysis',
    assigned_agent: 'SystemMapperAgent',
    dependencies: [],
    status: 'completed' as const,
    priority: 5,
    estimated_complexity: 0.6,
    context: { test: true },
    output: {
      systemMap: { id: 'map-1', map_name: 'Test Map' },
      entities: [{ id: 'e1', entity_name: 'Test Entity' }],
      relationships: [],
    },
    created_at: new Date().toISOString(),
  };
  
  try {
    const layout = await coordinator.produceSDUILayout(subgoal);
    console.log('✅ Dynamic UI generated:', layout);
    console.log('Components:', layout.sections.map(s => s.component));
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDynamicUI();
```

Run with:
```bash
npx tsx test-dynamic-ui.ts
```

### Test 4: Message Bus

```typescript
import { MessageBus } from './src/services/MessageBus';

const bus = new MessageBus();

// Subscribe
bus.subscribe('test', 'TestAgent', async (event) => {
  console.log('✅ Received:', event);
});

// Publish
await bus.publishMessage('test', {
  channel: 'test',
  message_type: 'heartbeat',
  sender_agent: 'TestAgent',
  payload: { message: 'Hello!' },
});
```

---

## Step 8: Verify All Features

### Check Feature Status:

```bash
# Run tests
npm test

# Check specific features
npm test test/llm-marl
npm test test/sof
```

### Verify in Browser Console:

```javascript
// Check CoordinatorAgent
import { CoordinatorAgent } from './src/agents/CoordinatorAgent';
const coordinator = new CoordinatorAgent();
console.log('Available agents:', coordinator.getAvailableAgents());
console.log('Task patterns:', coordinator.getTaskPatterns());

// Check UI Generation Tracker
import { getUIGenerationTracker } from './src/services/UIGenerationTracker';
const tracker = getUIGenerationTracker();
const stats = await tracker.getAggregateStats();
console.log('UI Generation Stats:', stats);

// Check Component Registry
import { getAllComponentTools } from './src/sdui/ComponentToolRegistry';
const components = getAllComponentTools();
console.log('Available components:', components.length);
```

---

## Troubleshooting

### Issue: "npm not found"

**Solution**: Install Node.js from https://nodejs.org

### Issue: "Supabase connection failed"

**Solutions**:
1. Check Docker is running: `docker ps`
2. Restart Supabase: `supabase stop && supabase start`
3. Check `.env` has correct URL and key
4. Verify migrations ran: `supabase db diff`

### Issue: "LLM API key invalid"

**Solutions**:
1. Verify API key in `.env`
2. Check API key is active at together.ai or openai.com
3. Test with curl:
   ```bash
   curl https://api.together.xyz/v1/models \
     -H "Authorization: Bearer $VITE_LLM_API_KEY"
   ```

### Issue: "Module not found: uuid or lz-string"

**Solution**:
```bash
npm install uuid lz-string
npm install --save-dev @types/uuid
```

### Issue: "Database tables not found"

**Solution**:
```bash
# Reset database
supabase db reset

# Or manually run migrations
supabase db push
```

### Issue: "Port 5173 already in use"

**Solution**:
```bash
# Kill process on port
lsof -ti:5173 | xargs kill -9

# Or use different port
npm run dev -- --port 3000
```

---

## Development Workflow

### 1. Start Services

```bash
# Terminal 1: Start Supabase
supabase start

# Terminal 2: Start dev server
npm run dev

# Terminal 3: Watch tests
npm run test:watch
```

### 2. Make Changes

- Edit files in `src/`
- Hot reload will update automatically
- Check browser console for errors

### 3. Test Changes

```bash
# Run tests
npm test

# Run specific test
npm test test/llm-marl/coordinator-agent.test.ts

# Check coverage
npm test -- --coverage
```

### 4. View Database

```bash
# Open Supabase Studio
open http://localhost:54323

# Or use SQL editor
supabase db studio
```

---

## Production Deployment

### Build for Production

```bash
# Build
npm run build

# Preview build
npm run preview
```

### Environment Variables for Production

Create `.env.production`:

```bash
VITE_APP_ENV=production
VITE_APP_URL=https://your-domain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
VITE_LLM_API_KEY=your-production-api-key
VITE_LLM_GATING_ENABLED=true
VITE_DYNAMIC_UI_ENABLED=true
VITE_UI_REFINEMENT_ENABLED=true
```

### Deploy

```bash
# Deploy to Vercel
vercel deploy

# Or Netlify
netlify deploy

# Or any static host
npm run build
# Upload dist/ folder
```

---

## Monitoring & Debugging

### Enable Debug Mode

In `.env`:
```bash
VITE_SDUI_DEBUG=true
LOG_LEVEL=debug
```

### View Logs

```bash
# Application logs
# Check browser console

# Supabase logs
supabase logs

# Database logs
supabase db logs
```

### Monitor Performance

```javascript
// In browser console
import { getUIGenerationTracker } from './src/services/UIGenerationTracker';
const tracker = getUIGenerationTracker();

// Get statistics
const stats = await tracker.getAggregateStats();
console.log('Total generations:', stats.total_generations);
console.log('Average quality:', stats.average_quality_score);
console.log('Success rate:', stats.average_task_success_rate);

// Compare methods
const comparison = await tracker.compareGenerationMethods();
console.log('Dynamic vs Static:', comparison);
```

---

## Quick Start Script

Create `start.sh`:

```bash
#!/bin/bash

echo "🚀 Starting ValueCanvas..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not installed"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker not installed"; exit 1; }

# Install dependencies
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Start Supabase
echo "🗄️  Starting Supabase..."
supabase start

# Wait for Supabase
sleep 5

# Run migrations
echo "🔄 Running migrations..."
supabase db push

# Start dev server
echo "🌐 Starting dev server..."
npm run dev
```

Make executable and run:
```bash
chmod +x start.sh
./start.sh
```

---

## Next Steps

1. ✅ Complete this setup guide
2. ✅ Verify all services are running
3. ✅ Test dynamic UI generation
4. ✅ Explore the application
5. ✅ Review documentation:
   - `LLM_MARL_COMPLETE.md`
   - `GENERATIVE_UI_COMPLETE.md`
   - `SOF_IMPLEMENTATION_GUIDE.md`

---

## Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review error messages in browser console
3. Check Supabase logs: `supabase logs`
4. Verify environment variables in `.env`
5. Ensure all migrations ran successfully

---

## Summary

You now have:
- ✅ Complete LLM-MARL system
- ✅ Generative UI with dynamic component selection
- ✅ SOF (Systemic Outcome Framework)
- ✅ Episodic memory and learning
- ✅ UI refinement loop
- ✅ Comprehensive metrics tracking
- ✅ Full local development environment

**Ready to build intelligent, self-improving UIs!** 🎉
