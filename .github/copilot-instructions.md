# GitHub Copilot Instructions for ValueCanvas

This file provides context and guidelines for GitHub Copilot when working on the ValueCanvas project.

---

## Project Overview

ValueCanvas is a SaaS platform for value stream mapping and business process optimization. The application uses:

- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Prisma ORM + Supabase
- **Infrastructure:** Kubernetes + Terraform + AWS
- **Testing:** Vitest + Playwright
- **Monitoring:** Prometheus + Grafana + Jaeger

---

## Code Style Guidelines

### TypeScript
- Use strict TypeScript with no implicit any
- Prefer interfaces over types for object shapes
- Use const assertions where appropriate
- Always define return types for functions

```typescript
// ✅ Good
interface User {
  id: string;
  email: string;
  name: string;
}

function getUser(id: string): Promise<User> {
  // implementation
}

// ❌ Bad
type User = {
  id: any;
  email: any;
}

function getUser(id) {
  // implementation
}
```

### React Components
- Use functional components with hooks
- Prefer named exports over default exports
- Use TypeScript for props
- Keep components small and focused

```typescript
// ✅ Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button onClick={onClick} className={`btn-${variant}`}>
      {label}
    </button>
  );
}

// ❌ Bad
export default function Button(props: any) {
  return <button onClick={props.onClick}>{props.label}</button>;
}
```

### Error Handling
- Always handle errors explicitly
- Use try-catch for async operations
- Log errors with context
- Return meaningful error messages

```typescript
// ✅ Good
try {
  const user = await getUser(id);
  return user;
} catch (error) {
  logger.error('Failed to get user', error, { userId: id });
  throw new Error(`User not found: ${id}`);
}

// ❌ Bad
const user = await getUser(id);
return user;
```

---

## Architecture Patterns

### Multi-Tenancy
- All database queries must be scoped to organization_id
- Use Row Level Security (RLS) policies
- Never expose data across tenants

```typescript
// ✅ Good
const users = await prisma.user.findMany({
  where: {
    organizationId: req.user.organizationId,
  },
});

// ❌ Bad
const users = await prisma.user.findMany();
```

### API Design
- Use RESTful conventions
- Version APIs (/api/v1/...)
- Return consistent error formats
- Include request IDs for tracing

```typescript
// ✅ Good
router.get('/api/v1/users/:id', async (req, res) => {
  try {
    const user = await getUser(req.params.id, req.user.organizationId);
    res.json({ data: user });
  } catch (error) {
    res.status(404).json({
      error: 'User not found',
      requestId: req.id,
    });
  }
});
```

### Database Access
- Use Prisma for type-safe queries
- Always use transactions for multi-step operations
- Index frequently queried fields
- Use prepared statements

```typescript
// ✅ Good
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  await tx.auditLog.create({ data: { action: 'user_created', userId: user.id } });
});

// ❌ Bad
const user = await prisma.user.create({ data: userData });
await prisma.auditLog.create({ data: { action: 'user_created', userId: user.id } });
```

---

## Testing Guidelines

### Unit Tests
- Test business logic in isolation
- Mock external dependencies
- Use descriptive test names
- Aim for 80%+ coverage

```typescript
// ✅ Good
describe('UserService', () => {
  it('should create user with hashed password', async () => {
    const userData = { email: 'test@example.com', password: 'secret' };
    const user = await userService.create(userData);
    
    expect(user.email).toBe(userData.email);
    expect(user.password).not.toBe(userData.password);
    expect(user.password).toMatch(/^\$2[aby]\$/); // bcrypt hash
  });
});
```

### Integration Tests
- Test API endpoints end-to-end
- Use test database
- Clean up after tests
- Test error cases

```typescript
// ✅ Good
describe('POST /api/v1/users', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should create user and return 201', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .send({ email: 'test@example.com', password: 'secret' })
      .expect(201);
    
    expect(response.body.data.email).toBe('test@example.com');
  });
});
```

---

## Security Best Practices

### Authentication
- Use JWT tokens with short expiration
- Store tokens securely (httpOnly cookies)
- Validate tokens on every request
- Implement refresh token rotation

### Authorization
- Check permissions before data access
- Use RBAC (Role-Based Access Control)
- Validate organization membership
- Log authorization failures

### Input Validation
- Validate all user input
- Sanitize HTML content
- Use parameterized queries
- Implement rate limiting

```typescript
// ✅ Good
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const validated = schema.parse(req.body);
```

---

## Performance Optimization

### Database
- Use indexes on foreign keys
- Implement pagination for large datasets
- Use select to limit returned fields
- Cache frequently accessed data

### Frontend
- Lazy load components
- Use React.memo for expensive renders
- Implement virtual scrolling for lists
- Optimize images and assets

### API
- Implement response caching
- Use compression middleware
- Batch database queries
- Implement request debouncing

---

## Monitoring & Observability

### Logging
- Use structured logging
- Include context (requestId, userId, etc.)
- Log at appropriate levels
- Never log sensitive data

```typescript
// ✅ Good
logger.info('User created', {
  userId: user.id,
  organizationId: user.organizationId,
  requestId: req.id,
});

// ❌ Bad
console.log('User created:', user.password);
```

### Metrics
- Track key business metrics
- Monitor API response times
- Track error rates
- Monitor resource usage

### Tracing
- Use OpenTelemetry for distributed tracing
- Include trace IDs in logs
- Track slow queries
- Monitor external API calls

---

## Common Patterns

### Async/Await
```typescript
// ✅ Good
async function processUser(id: string): Promise<User> {
  const user = await getUser(id);
  const enriched = await enrichUserData(user);
  return enriched;
}

// ❌ Bad
function processUser(id: string) {
  return getUser(id).then(user => {
    return enrichUserData(user);
  });
}
```

### Error Boundaries
```typescript
// ✅ Good
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('React error boundary caught error', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

### Custom Hooks
```typescript
// ✅ Good
function useUser(id: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    getUser(id)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);
  
  return { user, loading, error };
}
```

---

## File Organization

```
src/
├── api/              # API routes
├── components/       # React components
├── hooks/            # Custom React hooks
├── lib/              # Utility libraries
├── services/         # Business logic
├── types/            # TypeScript types
├── utils/            # Helper functions
└── config/           # Configuration
```

---

## Dependencies

### When to Add Dependencies
- Check if functionality exists in existing deps
- Evaluate bundle size impact
- Check maintenance status
- Review security advisories

### Preferred Libraries
- **State Management:** Zustand or React Context
- **Forms:** React Hook Form + Zod
- **HTTP Client:** Axios
- **Date/Time:** date-fns
- **UI Components:** Radix UI + TailwindCSS
- **Testing:** Vitest + Testing Library

---

## Git Workflow

### Commit Messages
```
feat: add user authentication
fix: resolve memory leak in WebSocket connection
docs: update API documentation
test: add tests for billing service
refactor: simplify error handling logic
```

### Branch Naming
```
feature/user-authentication
bugfix/memory-leak-websocket
hotfix/critical-security-issue
```

---

## Additional Context

- **Multi-tenant:** All features must support multiple organizations
- **Billing:** Stripe integration for subscription management
- **Observability:** OpenTelemetry for distributed tracing
- **Security:** OWASP Top 10 compliance required
- **Performance:** Target <200ms API response time
- **Accessibility:** WCAG 2.1 AA compliance

---

**Last Updated:** 2025-12-06
