# VOS Education Hub - Architecture Design

## System Overview

An interactive education platform for Value Operating System (VOS) training that combines traditional web development with TheSys C1 Generative UI capabilities to deliver adaptive, role-based learning experiences.

## Governance, ADRs, and diagrams-as-code

- Architecture decisions are recorded in `/docs/engineering/adr` using numbered markdown files. See `ADR 0001` for governance expectations.
- Diagrams-as-code live in `/docs/diagrams`; the current system view is maintained in `vos-education-hub-architecture.mmd` (Mermaid).
- Operational runbooks for deploy, rollback, and on-call live in `/docs/runbooks` and must be updated alongside architecture-impacting changes.

## Architecture Components

### 1. Frontend Layer

#### Core Technologies
- **React**: Primary UI framework
- **TheSys C1 React SDK**: Generative UI components
- **Responsive Design**: Mobile-first approach
- **Theme**: Professional blue-green palette (matching VOS brand)

#### Key Pages/Routes
1. **Landing Page**: Introduction to VOS training
2. **Dashboard**: User progress overview, certifications, maturity level
3. **Learning Paths**: Role-specific curriculum navigation
4. **Pillar Modules**: Individual pillar content and activities
5. **Quiz Interface**: Adaptive assessments
6. **Simulation Lab**: Interactive scenarios and workflows
7. **AI Tutor**: C1Chat-powered personalized assistance
8. **Resource Library**: Downloadable templates, KPI sheets, frameworks
9. **Analytics**: Admin view for tracking program effectiveness

#### Component Structure
```
/components
├── /generative-ui
│   ├── AITutor.jsx (C1Chat component)
│   ├── AdaptiveQuiz.jsx (C1Component for quizzes)
│   ├── SimulationFlow.jsx (Multi-step C1 flows)
│   └── MaturityAssessment.jsx (Interactive assessment)
├── /visualizations
│   ├── MaturityChart.jsx (Progress visualization)
│   ├── RoleGrid.jsx (Role-specific tracks)
│   └── ValueTree.jsx (Interactive value tree builder)
├── /content
│   ├── PillarModule.jsx (Content wrapper)
│   ├── QuizQuestion.jsx (Question renderer)
│   └── FeedbackPanel.jsx (Maturity-tied feedback)
└── /layout
    ├── Navigation.jsx
    ├── ProgressBar.jsx
    └── CertificationBadge.jsx
```

### 2. Backend Layer

#### Core Technologies
- **Node.js/Express** or **Python/FastAPI**: API server
- **TheSys C1 API**: Generative UI generation
- **Database**: PostgreSQL or MongoDB for user data
- **Authentication**: JWT-based user sessions

#### API Endpoints
```
/api
├── /auth
│   ├── POST /register
│   ├── POST /login
│   └── GET /profile
├── /content
│   ├── GET /pillars
│   ├── GET /pillars/:id
│   └── GET /roles/:role/curriculum
├── /quiz
│   ├── GET /quiz/:pillarId
│   ├── POST /quiz/submit
│   └── GET /quiz/results/:userId
├── /progress
│   ├── GET /progress/:userId
│   ├── POST /progress/update
│   └── GET /maturity/:userId
├── /certification
│   ├── GET /certifications/:userId
│   └── POST /certifications/award
├── /c1
│   ├── POST /generate-ui (C1 API proxy)
│   └── POST /chat (AI tutor endpoint)
└── /analytics
    ├── GET /completion-rates
    └── GET /knowledge-gains
```

### 3. Database Schema

#### Users Table
```sql
users {
  id: UUID (PK)
  email: STRING
  password_hash: STRING
  name: STRING
  role: ENUM (Sales, CS, Marketing, Product, Executive, VE)
  maturity_level: INTEGER (0-5)
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

#### Progress Table
```sql
progress {
  id: UUID (PK)
  user_id: UUID (FK -> users)
  pillar_id: INTEGER
  completion_percentage: FLOAT
  last_accessed: TIMESTAMP
  status: ENUM (not_started, in_progress, completed)
}
```

#### Quiz Results Table
```sql
quiz_results {
  id: UUID (PK)
  user_id: UUID (FK -> users)
  pillar_id: INTEGER
  score: FLOAT
  category_scores: JSON {
    value_definitions: FLOAT
    kpi_taxonomy: FLOAT
    roi_frameworks: FLOAT
    overall_application: FLOAT
  }
  answers: JSON
  feedback: JSON
  completed_at: TIMESTAMP
  passed: BOOLEAN
}
```

#### Certifications Table
```sql
certifications {
  id: UUID (PK)
  user_id: UUID (FK -> users)
  badge_name: STRING
  pillar_id: INTEGER
  role: STRING
  awarded_at: TIMESTAMP
  certificate_url: STRING
}
```

#### Maturity Assessments Table
```sql
maturity_assessments {
  id: UUID (PK)
  user_id: UUID (FK -> users)
  level: INTEGER (0-5)
  assessment_data: JSON
  assessed_at: TIMESTAMP
}
```

### 4. Content Management

#### Pillar Content Structure
```json
{
  "pillar_id": 1,
  "title": "Unified Value Language",
  "description": "...",
  "maturity_level": 1,
  "duration": "30-45 minutes",
  "components": [
    {
      "type": "quiz",
      "questions": [...],
      "scoring": {...},
      "feedback_rules": {...}
    },
    {
      "type": "resource",
      "title": "KPI Definition Sheet",
      "url": "/resources/kpi-sheet.pdf"
    }
  ],
  "role_adaptations": {
    "Sales": {...},
    "CS": {...}
  }
}
```

### 5. TheSys C1 Integration

#### AI Tutor Implementation
```javascript
// AITutor.jsx
import { C1Chat } from '@thesys/react';

function AITutor({ userId, role, maturityLevel }) {
  const systemPrompt = `You are a VOS training tutor for a ${role} professional 
    at maturity level ${maturityLevel}. Provide personalized guidance on value 
    operating system concepts, adapting your responses to their role and level.`;
  
  return (
    <C1Chat
      apiEndpoint="/api/c1/chat"
      systemPrompt={systemPrompt}
      context={{ userId, role, maturityLevel }}
      theme="vos-blue-green"
    />
  );
}
```

#### Adaptive Quiz Generation
```javascript
// AdaptiveQuiz.jsx
import { C1Component } from '@thesys/react';

function AdaptiveQuiz({ pillarId, userLevel }) {
  const prompt = `Generate an adaptive quiz for VOS Pillar ${pillarId} 
    at maturity level ${userLevel}. Include multiple choice and scenario-based 
    questions with instant feedback.`;
  
  return (
    <C1Component
      prompt={prompt}
      onComplete={handleQuizComplete}
      theme="vos-blue-green"
    />
  );
}
```

### 6. Adaptive Learning Logic

#### Maturity-Based Content Delivery
```javascript
function getAdaptiveContent(pillarId, userLevel, role) {
  const baseContent = getPillarContent(pillarId);
  
  // Adjust difficulty based on maturity level
  const difficulty = {
    0: 'foundational',
    1: 'awareness',
    2: 'alignment',
    3: 'integration',
    4: 'automation',
    5: 'orchestration'
  }[userLevel];
  
  // Apply role-specific adaptations
  const roleContent = baseContent.role_adaptations[role];
  
  return {
    ...baseContent,
    difficulty,
    questions: filterQuestionsByLevel(baseContent.questions, userLevel),
    examples: roleContent.examples,
    feedback_template: roleContent.feedback
  };
}
```

### 7. Visualization Integration

#### Static Assets
- Copy provided JPEG visualizations to `/public/assets/`
- Display at appropriate points in curriculum
- Use as reference materials in quizzes and simulations

#### Dynamic Visualizations
- Maturity progression charts (user-specific)
- Progress dashboards
- Role-based learning path maps
- Value tree builders (interactive)

### 8. Analytics & Reporting

#### Tracked Metrics
1. **Completion Rates**: % of users completing each pillar
2. **Knowledge Gain**: Pre/post quiz score improvements
3. **Maturity Progression**: Level changes over time
4. **Certification Rates**: % achieving 80%+ pass rate
5. **Time to Completion**: Average time per pillar/role track
6. **Engagement**: Session duration, return rate

#### Admin Dashboard
- Real-time completion statistics
- Cohort analysis by role
- Maturity distribution visualization
- Certification leaderboard
- Content effectiveness metrics

## Deployment Architecture

### Production Environment
```
Load Balancer
    ↓
Web Server (Frontend - React + C1 SDK)
    ↓
API Server (Backend - Node.js/Python)
    ↓
├── TheSys C1 API (External)
├── Database (PostgreSQL/MongoDB)
└── File Storage (S3/CDN for resources)
```

### Security Considerations
1. **Authentication**: Secure JWT tokens, password hashing
2. **API Keys**: Environment variables for TheSys C1 API
3. **Data Privacy**: User progress and assessment data encryption
4. **HTTPS**: SSL/TLS for all communications
5. **Rate Limiting**: Prevent API abuse

## Architecture Evolution and Operational Guardrails

### Service Boundaries and Versioned APIs
- **Auth Service (v1, v2 roadmap)**: Owns identity, MFA, session management, and role/permissions; exposes `/auth/v1` and `/auth/v2` endpoints with strict token scopes for downstream services.
- **Content Service (v1)**: Curates pillar modules, simulations, and adaptive quiz definitions; delivers content metadata and signed asset URLs via `/content/v1`.
- **Analytics Service (v1)**: Processes learning events, progress, and certification metrics; provides query and export endpoints via `/analytics/v1` with aggregation limits.
- **API Evolution Rules**: Version breaking changes, keep two active major versions, publish OpenAPI specs, and require deprecation notices with sunset headers.

### Caching, Edge, and Performance Budgets
- **Edge/CDN Strategy**: Cache static assets (JS/CSS/fonts/images) and public content JSON at the CDN with immutable fingerprints; prefer stale-while-revalidate for semi-static learning catalog data.
- **API Caching**: Short-lived (30–120s) cache for read-mostly endpoints (pillars, curriculum lists, analytics summaries); bypass cache for user-personalized responses and assessment submissions.
- **Client Performance Budgets**: LCP ≤ 2.5s on 75th percentile, TTI ≤ 4s, JS bundle budget ≤ 250KB gzipped per route; enforce via CI Lighthouse checks and bundle analyzer thresholds.
- **Backend Performance Budgets**: P99 latency targets—Auth ≤ 300ms, Content ≤ 500ms, Analytics reads ≤ 800ms; circuit breaking and backpressure for downstream dependencies.

### Security and Compliance Program
- **Supply Chain**: Generate SBOMs on every release artifact; verify signatures for npm packages when supported; pin transitive dependencies via lockfiles and periodic `npm audit` with allowlist governance.
- **CI Security Gates**: Add SAST (TypeScript/Node ruleset) on PRs and nightly; run DAST against preview environments before release; block merges on critical/high findings.
- **Release Integrity**: Sign build outputs, store attestations, and require provenance verification in deployment pipelines.
- **Operational Readiness**: Maintain incident response playbooks (triage, containment, comms), quarterly access reviews for cloud/CI/CD secrets, tested DR/backup procedures (RPO 24h, RTO 4h targets), and automated key rotation runbooks for API keys and database credentials.

### Documentation and Governance
- **ADRs and Diagrams-as-Code**: Record architecture decisions in `/docs/engineering/adr` using markdown templates; keep architecture diagrams in version control (e.g., Mermaid/Structurizr) with reviews alongside code changes.
- **Runbooks**: Store deploy, rollback, on-call, and incident runbooks in `/docs/runbooks`; require updates as part of change approvals.
- **Contribution and Ownership**: Enforce contribution guidelines at the repository root, require CODEOWNERS approvals for scoped areas (frontend, backend, docs, security), and auto-assign reviewers.

## Development Workflow

### Phase 1: Project Setup
1. Initialize web project with database and authentication
2. Set up TheSys C1 API integration
3. Configure theme and branding

### Phase 2: Content Implementation
1. Structure 10 pillar modules
2. Build quiz system with adaptive logic
3. Create simulation flows
4. Integrate visualizations

### Phase 3: User Experience
1. Implement AI tutor (C1Chat)
2. Build progress tracking
3. Create certification system
4. Design analytics dashboard

### Phase 4: Testing & Refinement
1. User testing with different roles
2. Adaptive logic validation
3. Performance optimization
4. Accessibility compliance

### Phase 5: Deployment
1. Production environment setup
2. Data migration
3. Launch and monitoring
