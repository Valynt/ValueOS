# Quick Reference Guide

**Purpose:** Fast lookup for common tasks and commands  
**Audience:** Developers working with ValueCanvas

---

## Installation & Setup

```bash
# Clone repository
git clone https://github.com/bmsull560/ValueCanvas.git
cd ValueCanvas

# Install dependencies
npm install

# Setup environment
cp .env.local .env
# Edit .env and add your LLM API key

# Start everything
./start.sh

# Or manually:
supabase start
npm run dev
```

---

## Common Commands

### Development
```bash
npm run dev              # Start dev server (port 5173)
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run ESLint
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
```

### Database
```bash
supabase start           # Start local Supabase
supabase stop            # Stop local Supabase
supabase db reset        # Reset database
supabase db push         # Apply migrations
supabase status          # Check status
```

### Git
```bash
git status               # Check status
git add .                # Stage all changes
git commit -m "message"  # Commit with message
git push                 # Push to remote
git pull                 # Pull from remote
```

---

## Environment Variables

### Required
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_LLM_API_KEY=your-llm-api-key
```

### Optional
```bash
VITE_APP_ENV=development
VITE_SENTRY_DSN=your-sentry-dsn
VITE_AGENT_API_URL=http://localhost:8000
```

---

## Agent System

### Create Agent
```typescript
import { CoordinatorAgent } from './agents/CoordinatorAgent';

const coordinator = new CoordinatorAgent();
const plan = await coordinator.planTask({
  intent_type: 'value_discovery',
  intent_description: 'Find opportunities',
  business_case_id: 'case-123',
  user_id: 'user-456',
});
```

### Send Message
```typescript
import { CommunicatorAgent } from './agents/CommunicatorAgent';

const comm = new CommunicatorAgent('MyAgent');
await comm.sendMessage('TargetAgent', 'task_assignment', {
  task_id: 'task-123',
  data: { /* ... */ },
});
```

### Request-Response
```typescript
const response = await comm.request('TargetAgent', {
  action: 'analyze',
  data: { /* ... */ },
}, 5000);
```

---

## Database Operations

### Query
```typescript
import { supabase } from './lib/supabase';

const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', 'value')
  .order('created_at', { ascending: false })
  .limit(10);
```

### Insert
```typescript
const { data, error } = await supabase
  .from('table_name')
  .insert({ column1: 'value1', column2: 'value2' })
  .select()
  .single();
```

### Update
```typescript
const { data, error } = await supabase
  .from('table_name')
  .update({ column: 'new_value' })
  .eq('id', 'record-id')
  .select();
```

### Delete
```typescript
const { error } = await supabase
  .from('table_name')
  .delete()
  .eq('id', 'record-id');
```

---

## SDUI Generation

### Generate Layout
```typescript
const layout = await coordinator.produceSDUILayout({
  id: 'subgoal-1',
  subgoal_type: 'dashboard_creation',
  subgoal_description: 'Create dashboard',
  output: { /* data */ },
  estimated_complexity: 5,
  dependencies: [],
  status: 'in_progress',
  created_at: new Date().toISOString(),
});
```

### Render Page
```typescript
import { renderPage } from './sdui/renderPage';

const Page = renderPage({
  type: 'page',
  title: 'My Page',
  sections: [/* ... */],
});

// Use in React
<Page />
```

---

## Logging

### Structured Logging
```typescript
import { log } from './lib/logger';

log.debug('Debug message', { context: 'data' });
log.info('Info message', { userId: '123' });
log.warn('Warning message', { action: 'save' });
log.error('Error message', error, { component: 'Agent' });
```

### Component Logger
```typescript
import { createLogger } from './lib/logger';

const logger = createLogger({ component: 'MyComponent' });
logger.info('Message', { action: 'process' });
```

---

## Error Handling

### Try-Catch
```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  log.error('Operation failed', error as Error, {
    component: 'MyComponent',
    action: 'risky_operation',
  });
  return fallbackValue;
}
```

### Error Boundaries (React)
```typescript
import { ErrorBoundary } from './components/Common/ErrorBoundary';

<ErrorBoundary fallback={<ErrorFallback />}>
  <MyComponent />
</ErrorBoundary>
```

---

## Testing

### Unit Test
```typescript
import { describe, it, expect } from 'vitest';

describe('MyFunction', () => {
  it('should return expected value', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Component Test
```typescript
import { render, screen } from '@testing-library/react';

it('renders component', () => {
  render(<MyComponent title="Test" />);
  expect(screen.getByText('Test')).toBeInTheDocument();
});
```

---

## React Patterns

### Functional Component
```typescript
export const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  return <div>{prop1}</div>;
};
```

### With Memo
```typescript
export const MyComponent: React.FC<Props> = React.memo(({ prop1 }) => {
  return <div>{prop1}</div>;
});
```

### With Hooks
```typescript
export const MyComponent: React.FC<Props> = ({ data }) => {
  const processed = useMemo(() => process(data), [data]);
  const handler = useCallback(() => handle(), []);
  
  return <div onClick={handler}>{processed}</div>;
};
```

---

## TypeScript Patterns

### Interface
```typescript
interface User {
  id: string;
  name: string;
  email: string;
}
```

### Type
```typescript
type Status = 'active' | 'inactive' | 'pending';
```

### Generic
```typescript
function process<T>(data: T): T {
  return data;
}
```

### Type Guard
```typescript
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj
  );
}
```

---

## File Structure

```
src/
├── agents/           # Agent implementations
├── components/       # React components
├── services/         # Business logic
├── sdui/            # SDUI system
├── lib/             # Utilities
├── types/           # Type definitions
├── hooks/           # Custom hooks
└── views/           # Page components
```

---

## Common Patterns

### Async/Await
```typescript
async function fetchData() {
  const response = await fetch('/api/data');
  const data = await response.json();
  return data;
}
```

### Promise.all
```typescript
const [users, posts, comments] = await Promise.all([
  fetchUsers(),
  fetchPosts(),
  fetchComments(),
]);
```

### Optional Chaining
```typescript
const value = obj?.nested?.property ?? 'default';
```

### Destructuring
```typescript
const { id, name, ...rest } = user;
const [first, second, ...others] = array;
```

---

## Keyboard Shortcuts

### VS Code
- `Ctrl/Cmd + P` - Quick file open
- `Ctrl/Cmd + Shift + P` - Command palette
- `Ctrl/Cmd + B` - Toggle sidebar
- `Ctrl/Cmd + /` - Toggle comment
- `F2` - Rename symbol

### Browser DevTools
- `F12` - Open DevTools
- `Ctrl/Cmd + Shift + C` - Inspect element
- `Ctrl/Cmd + Shift + M` - Toggle device mode
- `Ctrl/Cmd + R` - Reload page

---

## Troubleshooting

### Port in use
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or use different port
npm run dev -- --port 3000
```

### Clear cache
```bash
rm -rf node_modules
rm package-lock.json
npm install
```

### Reset database
```bash
supabase db reset
```

### Check logs
```bash
# Supabase logs
supabase logs

# Application logs
# Check browser console
```

---

## Git Workflow

### Feature Branch
```bash
git checkout -b feature/my-feature
# Make changes
git add .
git commit -m "feat: Add my feature"
git push origin feature/my-feature
# Create PR on GitHub
```

### Update Branch
```bash
git fetch origin
git rebase origin/main
```

### Undo Changes
```bash
git reset --hard HEAD    # Undo all changes
git reset HEAD~1         # Undo last commit
git checkout -- file.ts  # Undo file changes
```

---

## Performance

### Profile Component
```typescript
import { Profiler } from 'react';

<Profiler id="MyComponent" onRender={onRenderCallback}>
  <MyComponent />
</Profiler>
```

### Measure Performance
```typescript
const start = performance.now();
await operation();
const duration = performance.now() - start;
console.log(`Duration: ${duration}ms`);
```

---

## Security

### Sanitize HTML
```typescript
import { sanitizeHtml } from './utils/sanitizeHtml';

const clean = sanitizeHtml(userInput);
```

### Validate Input
```typescript
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(120),
});

const result = schema.safeParse(input);
```

---

## Useful Links

- **Docs:** [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)
- **FAQ:** [FAQ.md](./FAQ.md)
- **Examples:** [API_EXAMPLES.md](./API_EXAMPLES.md)
- **Contributing:** [CONTRIBUTING.md](./CONTRIBUTING.md)

---

**Last Updated:** November 22, 2024  
**Print this for quick reference!**
