/**
 * Mock Builder Utilities for Integration Testing
 *
 * Provides fluent interfaces for building complex mock objects
 * to reduce test complexity and improve maintainability.
 */

import { vi } from 'vitest';
import { WorkflowState } from '../../../src/repositories/WorkflowStateRepository';
import { SDUIPageDefinition } from '../../../src/sdui/schema';

// ============================================================================
// Base Mock Builder Interface
// ============================================================================

interface MockBuilder<T> {
  build(): T;
  with<K extends keyof T>(key: K, value: T[K]): MockBuilder<T>;
  withPartial(partial: Partial<T>): MockBuilder<T>;
}

// ============================================================================
// User Mock Builder
// ============================================================================

interface MockUser {
  id: string;
  email: string;
  user_metadata: { tenant_id: string };
  created_at: string;
}

class UserMockBuilder implements MockBuilder<MockUser> {
  private user: Partial<MockUser> = {};

  constructor() {
    this.user = {
      id: 'test-user-id',
      email: 'test@example.com',
      user_metadata: { tenant_id: 'test-tenant' },
      created_at: '2024-01-01T00:00:00Z',
    };
  }

  with<K extends keyof MockUser>(key: K, value: MockUser[K]): UserMockBuilder {
    this.user[key] = value;
    return this;
  }

  withPartial(partial: Partial<MockUser>): UserMockBuilder {
    this.user = { ...this.user, ...partial };
    return this;
  }

  build(): MockUser {
    return this.user as MockUser;
  }

  // Fluent methods for common scenarios
  asAdmin(): UserMockBuilder {
    return this.with('user_metadata', { tenant_id: 'admin-tenant' });
  }

  withTenant(tenantId: string): UserMockBuilder {
    return this.with('user_metadata', { tenant_id: tenantId });
  }
}

// ============================================================================
// Case Mock Builder
// ============================================================================

interface MockCase {
  id: string;
  name: string;
  company: string;
  stage: string;
  status: string;
  updatedAt: Date;
}

class CaseMockBuilder implements MockBuilder<MockCase> {
  private case: Partial<MockCase> = {};

  constructor() {
    this.case = {
      id: 'test-case-id',
      name: 'Test Case',
      company: 'Test Company',
      stage: 'opportunity',
      status: 'in-progress',
      updatedAt: new Date(),
    };
  }

  with<K extends keyof MockCase>(key: K, value: MockCase[K]): CaseMockBuilder {
    this.case[key] = value;
    return this;
  }

  withPartial(partial: Partial<MockCase>): CaseMockBuilder {
    this.case = { ...this.case, ...partial };
    return this;
  }

  build(): MockCase {
    return this.case as MockCase;
  }

  // Fluent methods for common scenarios
  atStage(stage: string): CaseMockBuilder {
    return this.with('stage', stage);
  }

  withStatus(status: string): CaseMockBuilder {
    return this.with('status', status);
  }

  forCompany(company: string): CaseMockBuilder {
    return this.with('company', company);
  }
}

// ============================================================================
// Workflow State Mock Builder
// ============================================================================

class WorkflowStateMockBuilder implements MockBuilder<WorkflowState> {
  private state: Partial<WorkflowState> = {};

  constructor() {
    this.state = {
      currentStage: 'opportunity',
      status: 'in_progress',
      completedStages: [],
      context: {
        caseId: 'test-case-id',
        company: 'Test Company',
      },
      metadata: {
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        errorCount: 0,
        retryCount: 0,
      },
    };
  }

  with<K extends keyof WorkflowState>(key: K, value: WorkflowState[K]): WorkflowStateMockBuilder {
    this.state[key] = value;
    return this;
  }

  withPartial(partial: Partial<WorkflowState>): WorkflowStateMockBuilder {
    this.state = { ...this.state, ...partial };
    return this;
  }

  build(): WorkflowState {
    return this.state as WorkflowState;
  }

  // Fluent methods for common scenarios
  atStage(stage: string): WorkflowStateMockBuilder {
    return this.with('currentStage', stage);
  }

  withError(errorCount: number): WorkflowStateMockBuilder {
    return this.with('metadata', {
      ...this.state.metadata,
      errorCount,
    });
  }

  withRetries(retryCount: number): WorkflowStateMockBuilder {
    return this.with('metadata', {
      ...this.state.metadata,
      retryCount,
    });
  }

  withContext(context: Partial<WorkflowState['context']>): WorkflowStateMockBuilder {
    return this.with('context', {
      ...this.state.context,
      ...context,
    });
  }
}

// ============================================================================
// SDUI Page Mock Builder
// ============================================================================

class SDUIPageMockBuilder implements MockBuilder<SDUIPageDefinition> {
  private page: Partial<SDUIPageDefinition> = {};

  constructor() {
    this.page = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'TextBlock',
          version: 1,
          props: {
            text: '### Test Analysis\n\nThis is a test analysis.',
            className: 'mb-6 prose dark:prose-invert',
          },
        },
      ],
      metadata: {
        case_id: 'test-case-id',
        session_id: 'test-session-id',
        trace_id: 'test-trace-id',
        generated_at: Date.now(),
        priority: 'high',
      },
    };
  }

  with<K extends keyof SDUIPageDefinition>(key: K, value: SDUIPageDefinition[K]): SDUIPageMockBuilder {
    this.page[key] = value;
    return this;
  }

  withPartial(partial: Partial<SDUIPageDefinition>): SDUIPageMockBuilder {
    this.page = { ...this.page, ...partial };
    return this;
  }

  build(): SDUIPageDefinition {
    return this.page as SDUIPageDefinition;
  }

  // Fluent methods for common scenarios
  withComponent(component: string, props: any): SDUIPageMockBuilder {
    return this.with('sections', [
      ...(this.page.sections || []),
      {
        type: 'component' as const,
        component,
        version: 1,
        props,
      },
    ]);
  }

  withMetadata(metadata: Partial<SDUIPageDefinition['metadata']>): SDUIPageMockBuilder {
    return this.with('metadata', {
      ...this.page.metadata,
      ...metadata,
    });
  }
}

// ============================================================================
// Supabase Mock Builder
// ============================================================================

class SupabaseMockBuilder {
  private auth: any = {};
  private from: any = {};

  constructor() {
    this.setupDefaults();
  }

  private setupDefaults(): void {
    this.auth = {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
    };

    this.from = vi.fn().mockReturnValue(this.createQueryChain());
  }

  private createQueryChain(): any {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-session-id' },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      }),
    };
  }

  withAuth(auth: any): SupabaseMockBuilder {
    this.auth = auth;
    return this;
  }

  withFrom(from: any): SupabaseMockBuilder {
    this.from = from;
    return this;
  }

  build(): any {
    return {
      auth: this.auth,
      from: this.from,
    };
  }

  // Fluent methods for common scenarios
  withAuthenticatedUser(user: MockUser): SupabaseMockBuilder {
    return this.withAuth({
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user, access_token: 'test-token' } },
        error: null,
      }),
    });
  }

  withSessionData(data: any): SupabaseMockBuilder {
    return this.withAuth({
      getSession: vi.fn().mockResolvedValue({
        data: { session: data },
        error: null,
      }),
    });
  }
}

// ============================================================================
// Agent Chat Service Mock Builder
// ============================================================================

interface MockChatResponse {
  message: {
    role: string;
    content: string;
    timestamp: number;
    agentName?: string;
    confidence?: number;
    reasoning?: string[];
  };
  sduiPage?: SDUIPageDefinition;
  nextState: WorkflowState;
  traceId: string;
}

class AgentChatServiceMockBuilder {
  private mockService: any = {};

  constructor() {
    this.mockService = {
      chat: vi.fn(),
    };
  }

  withResponse(response: Partial<MockChatResponse>): AgentChatServiceMockBuilder {
    const defaultResponse: MockChatResponse = {
      message: {
        role: 'assistant',
        content: 'Test analysis response',
        timestamp: Date.now(),
        agentName: 'Test Agent',
        confidence: 0.9,
        reasoning: ['Test reasoning'],
      },
      sduiPage: new SDUIPageMockBuilder().build(),
      nextState: new WorkflowStateMockBuilder().build(),
      traceId: 'test-trace-id',
    };

    this.mockService.chat.mockResolvedValue({ ...defaultResponse, ...response });
    return this;
  }

  withError(error: Error | string): AgentChatServiceMockBuilder {
    this.mockService.chat.mockRejectedValue(error instanceof Error ? error : new Error(error));
    return this;
  }

  build(): any {
    return this.mockService;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export const createMockUser = () => new UserMockBuilder();
export const createMockCase = () => new CaseMockBuilder();
export const createMockWorkflowState = () => new WorkflowStateMockBuilder();
export const createMockSDUIPage = () => new SDUIPageMockBuilder();
export const createMockSupabase = () => new SupabaseMockBuilder();
export const createMockAgentChatService = () => new AgentChatServiceMockBuilder();

// ============================================================================
// Convenience Functions for Common Test Scenarios
// ============================================================================

export const createStandardTestSetup = () => {
  const user = createMockUser().build();
  const caseData = createMockCase().build();
  const workflowState = createMockWorkflowState().build();
  const sduiPage = createMockSDUIPage().build();
  const supabase = createMockSupabase().withAuthenticatedUser(user).build();
  const agentChatService = createMockAgentChatService()
    .withResponse({ sduiPage, nextState: workflowState })
    .build();

  return {
    user,
    caseData,
    workflowState,
    sduiPage,
    supabase,
    agentChatService,
  };
};

export const createErrorTestSetup = (errorMessage: string) => {
  const user = createMockUser().build();
  const caseData = createMockCase().build();
  const workflowState = createMockWorkflowState().build();
  const supabase = createMockSupabase().withAuthenticatedUser(user).build();
  const agentChatService = createMockAgentChatService().withError(errorMessage).build();

  return {
    user,
    caseData,
    workflowState,
    supabase,
    agentChatService,
  };
};
