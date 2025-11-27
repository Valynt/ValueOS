/**
 * Multi-User Workflow E2E Tests
 * 
 * Tests concurrent user scenarios, collaboration workflows,
 * conflict resolution, and real-time synchronization.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { OpportunityAgent } from '../../lib/agent-fabric/agents/OpportunityAgent';
import { TargetAgent } from '../../lib/agent-fabric/agents/TargetAgent';
import { ExpansionAgent } from '../../lib/agent-fabric/agents/ExpansionAgent';

describe('MultiUserWorkflow - Concurrent Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles concurrent opportunity creation by multiple users', async () => {
    const user1Agent = new OpportunityAgent({} as any);
    const user2Agent = new OpportunityAgent({} as any);

    const [result1, result2] = await Promise.all([
      user1Agent.invoke({
        customer_context: 'User 1 opportunity',
        user_id: 'user-1',
      }),
      user2Agent.invoke({
        customer_context: 'User 2 opportunity',
        user_id: 'user-2',
      }),
    ]);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.data.opportunity_id).not.toBe(result2.data.opportunity_id);
  });

  it('handles concurrent updates to same value tree', async () => {
    const targetAgent = new TargetAgent({} as any);

    const initialResult = await targetAgent.invoke({
      opportunity_id: 'opp-1',
    });

    expect(initialResult.success).toBe(true);

    const valueTreeId = initialResult.data.value_tree_id;

    const [update1, update2] = await Promise.all([
      targetAgent.invoke({
        value_tree_id: valueTreeId,
        update: { node: 'kpi-1', value: 100 },
        user_id: 'user-1',
      }),
      targetAgent.invoke({
        value_tree_id: valueTreeId,
        update: { node: 'kpi-2', value: 200 },
        user_id: 'user-2',
      }),
    ]);

    expect(update1.success).toBe(true);
    expect(update2.success).toBe(true);
  });

  it('prevents conflicting updates with optimistic locking', async () => {
    const targetAgent = new TargetAgent({} as any);

    const initialResult = await targetAgent.invoke({
      opportunity_id: 'opp-1',
    });

    const valueTreeId = initialResult.data.value_tree_id;
    const version = initialResult.data.version;

    const [update1, update2] = await Promise.allSettled([
      targetAgent.invoke({
        value_tree_id: valueTreeId,
        version,
        update: { node: 'kpi-1', value: 100 },
      }),
      targetAgent.invoke({
        value_tree_id: valueTreeId,
        version,
        update: { node: 'kpi-1', value: 200 },
      }),
    ]);

    const successCount = [update1, update2].filter(
      (r) => r.status === 'fulfilled'
    ).length;

    expect(successCount).toBe(1);
  });

  it('handles concurrent agent invocations without race conditions', async () => {
    const agents = Array.from({ length: 10 }, () => new OpportunityAgent({} as any));

    const results = await Promise.all(
      agents.map((agent, i) =>
        agent.invoke({
          customer_context: `Concurrent request ${i}`,
        })
      )
    );

    const successCount = results.filter((r) => r.success).length;
    expect(successCount).toBe(10);

    const uniqueIds = new Set(results.map((r) => r.data?.opportunity_id));
    expect(uniqueIds.size).toBe(10);
  });
});

describe('MultiUserWorkflow - Collaboration', () => {
  it('supports collaborative value tree editing', async () => {
    const targetAgent = new TargetAgent({} as any);

    const initialResult = await targetAgent.invoke({
      opportunity_id: 'opp-1',
    });

    const valueTreeId = initialResult.data.value_tree_id;

    const user1Update = await targetAgent.invoke({
      value_tree_id: valueTreeId,
      user_id: 'user-1',
      action: 'add_node',
      node: { label: 'User 1 KPI', type: 'kpi' },
    });

    expect(user1Update.success).toBe(true);

    const user2Update = await targetAgent.invoke({
      value_tree_id: valueTreeId,
      user_id: 'user-2',
      action: 'add_node',
      node: { label: 'User 2 KPI', type: 'kpi' },
    });

    expect(user2Update.success).toBe(true);

    const finalTree = await targetAgent.invoke({
      value_tree_id: valueTreeId,
      action: 'get',
    });

    expect(finalTree.data.nodes).toHaveLength(2);
  });

  it('tracks user contributions in audit log', async () => {
    const targetAgent = new TargetAgent({} as any);

    await targetAgent.invoke({
      opportunity_id: 'opp-1',
      user_id: 'user-1',
    });

    await targetAgent.invoke({
      opportunity_id: 'opp-1',
      user_id: 'user-2',
      action: 'update',
    });

    const auditLog = await targetAgent.invoke({
      action: 'get_audit_log',
      opportunity_id: 'opp-1',
    });

    expect(auditLog.data.entries).toHaveLength(2);
    expect(auditLog.data.entries[0].user_id).toBe('user-1');
    expect(auditLog.data.entries[1].user_id).toBe('user-2');
  });

  it('supports role-based access control', async () => {
    const targetAgent = new TargetAgent({} as any);

    const viewerResult = await targetAgent.invoke({
      opportunity_id: 'opp-1',
      user_id: 'viewer-1',
      role: 'viewer',
      action: 'update',
    });

    expect(viewerResult.success).toBe(false);
    expect(viewerResult.error).toContain('permission');

    const editorResult = await targetAgent.invoke({
      opportunity_id: 'opp-1',
      user_id: 'editor-1',
      role: 'editor',
      action: 'update',
    });

    expect(editorResult.success).toBe(true);
  });
});

describe('MultiUserWorkflow - Conflict Resolution', () => {
  it('merges non-conflicting concurrent changes', async () => {
    const targetAgent = new TargetAgent({} as any);

    const initialResult = await targetAgent.invoke({
      opportunity_id: 'opp-1',
    });

    const valueTreeId = initialResult.data.value_tree_id;

    const [change1, change2] = await Promise.all([
      targetAgent.invoke({
        value_tree_id: valueTreeId,
        update: { field: 'name', value: 'Updated Name' },
      }),
      targetAgent.invoke({
        value_tree_id: valueTreeId,
        update: { field: 'description', value: 'Updated Description' },
      }),
    ]);

    expect(change1.success).toBe(true);
    expect(change2.success).toBe(true);

    const finalResult = await targetAgent.invoke({
      value_tree_id: valueTreeId,
      action: 'get',
    });

    expect(finalResult.data.name).toBe('Updated Name');
    expect(finalResult.data.description).toBe('Updated Description');
  });

  it('detects and reports conflicting changes', async () => {
    const targetAgent = new TargetAgent({} as any);

    const initialResult = await targetAgent.invoke({
      opportunity_id: 'opp-1',
    });

    const valueTreeId = initialResult.data.value_tree_id;

    const [change1, change2] = await Promise.allSettled([
      targetAgent.invoke({
        value_tree_id: valueTreeId,
        update: { field: 'name', value: 'Name A' },
      }),
      targetAgent.invoke({
        value_tree_id: valueTreeId,
        update: { field: 'name', value: 'Name B' },
      }),
    ]);

    const conflicts = [change1, change2].filter(
      (r) => r.status === 'rejected' && r.reason?.includes('conflict')
    );

    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('uses last-write-wins for simple conflicts', async () => {
    const targetAgent = new TargetAgent({} as any);

    const initialResult = await targetAgent.invoke({
      opportunity_id: 'opp-1',
    });

    const valueTreeId = initialResult.data.value_tree_id;

    await targetAgent.invoke({
      value_tree_id: valueTreeId,
      update: { field: 'name', value: 'First Update' },
      timestamp: Date.now(),
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    await targetAgent.invoke({
      value_tree_id: valueTreeId,
      update: { field: 'name', value: 'Second Update' },
      timestamp: Date.now(),
    });

    const finalResult = await targetAgent.invoke({
      value_tree_id: valueTreeId,
      action: 'get',
    });

    expect(finalResult.data.name).toBe('Second Update');
  });
});

describe('MultiUserWorkflow - Real-time Synchronization', () => {
  it('broadcasts changes to all connected users', async () => {
    const targetAgent = new TargetAgent({} as any);

    const subscribers: any[] = [];

    const subscribe = (userId: string) => {
      const events: any[] = [];
      subscribers.push({ userId, events });
      return events;
    };

    const user1Events = subscribe('user-1');
    const user2Events = subscribe('user-2');

    await targetAgent.invoke({
      opportunity_id: 'opp-1',
      user_id: 'user-1',
      action: 'update',
      broadcast: true,
    });

    expect(user1Events.length).toBeGreaterThan(0);
    expect(user2Events.length).toBeGreaterThan(0);
  });

  it('handles offline users with event queue', async () => {
    const targetAgent = new TargetAgent({} as any);

    await targetAgent.invoke({
      opportunity_id: 'opp-1',
      user_id: 'online-user',
      action: 'update',
    });

    const offlineUserQueue = await targetAgent.invoke({
      action: 'get_event_queue',
      user_id: 'offline-user',
    });

    expect(offlineUserQueue.data.events).toBeDefined();
  });

  it('synchronizes state after reconnection', async () => {
    const targetAgent = new TargetAgent({} as any);

    await targetAgent.invoke({
      opportunity_id: 'opp-1',
      action: 'update',
      update: { field: 'name', value: 'Updated While Offline' },
    });

    const syncResult = await targetAgent.invoke({
      action: 'sync',
      user_id: 'reconnected-user',
      last_sync_timestamp: Date.now() - 60000,
    });

    expect(syncResult.success).toBe(true);
    expect(syncResult.data.updates).toBeDefined();
  });
});

describe('MultiUserWorkflow - Performance Under Load', () => {
  it('handles high concurrent user load', async () => {
    const userCount = 50;
    const agents = Array.from({ length: userCount }, () => new OpportunityAgent({} as any));

    const startTime = Date.now();

    const results = await Promise.all(
      agents.map((agent, i) =>
        agent.invoke({
          customer_context: `Load test user ${i}`,
        })
      )
    );

    const duration = Date.now() - startTime;

    const successCount = results.filter((r) => r.success).length;
    expect(successCount).toBe(userCount);
    expect(duration).toBeLessThan(10000);
  });

  it('maintains data consistency under concurrent load', async () => {
    const targetAgent = new TargetAgent({} as any);

    const initialResult = await targetAgent.invoke({
      opportunity_id: 'opp-1',
    });

    const valueTreeId = initialResult.data.value_tree_id;

    const updateCount = 100;
    const updates = Array.from({ length: updateCount }, (_, i) =>
      targetAgent.invoke({
        value_tree_id: valueTreeId,
        action: 'increment_counter',
        counter: 'test_counter',
      })
    );

    await Promise.all(updates);

    const finalResult = await targetAgent.invoke({
      value_tree_id: valueTreeId,
      action: 'get',
    });

    expect(finalResult.data.test_counter).toBe(updateCount);
  });

  it('throttles requests to prevent system overload', async () => {
    const targetAgent = new TargetAgent({} as any);

    const rapidRequests = Array.from({ length: 1000 }, (_, i) =>
      targetAgent.invoke({
        opportunity_id: 'opp-1',
        action: 'ping',
      })
    );

    const results = await Promise.allSettled(rapidRequests);

    const throttled = results.filter(
      (r) => r.status === 'rejected' && r.reason?.includes('throttle')
    );

    expect(throttled.length).toBeGreaterThan(0);
  });
});

describe('MultiUserWorkflow - Session Management', () => {
  it('tracks active user sessions', async () => {
    const targetAgent = new TargetAgent({} as any);

    await targetAgent.invoke({
      action: 'start_session',
      user_id: 'user-1',
      session_id: 'session-1',
    });

    await targetAgent.invoke({
      action: 'start_session',
      user_id: 'user-2',
      session_id: 'session-2',
    });

    const activeSessions = await targetAgent.invoke({
      action: 'get_active_sessions',
    });

    expect(activeSessions.data.sessions).toHaveLength(2);
  });

  it('cleans up expired sessions', async () => {
    const targetAgent = new TargetAgent({} as any);

    await targetAgent.invoke({
      action: 'start_session',
      user_id: 'user-1',
      session_id: 'session-1',
      ttl: 100,
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    const activeSessions = await targetAgent.invoke({
      action: 'get_active_sessions',
    });

    expect(activeSessions.data.sessions).toHaveLength(0);
  });

  it('handles session takeover gracefully', async () => {
    const targetAgent = new TargetAgent({} as any);

    await targetAgent.invoke({
      action: 'start_session',
      user_id: 'user-1',
      session_id: 'session-1',
    });

    const takeoverResult = await targetAgent.invoke({
      action: 'start_session',
      user_id: 'user-1',
      session_id: 'session-2',
      force: true,
    });

    expect(takeoverResult.success).toBe(true);

    const activeSessions = await targetAgent.invoke({
      action: 'get_active_sessions',
      user_id: 'user-1',
    });

    expect(activeSessions.data.sessions).toHaveLength(1);
    expect(activeSessions.data.sessions[0].session_id).toBe('session-2');
  });
});

describe('MultiUserWorkflow - Notification System', () => {
  it('notifies users of relevant changes', async () => {
    const targetAgent = new TargetAgent({} as any);

    await targetAgent.invoke({
      action: 'subscribe',
      user_id: 'user-1',
      resource_id: 'value-tree-1',
    });

    await targetAgent.invoke({
      value_tree_id: 'value-tree-1',
      user_id: 'user-2',
      action: 'update',
    });

    const notifications = await targetAgent.invoke({
      action: 'get_notifications',
      user_id: 'user-1',
    });

    expect(notifications.data.notifications.length).toBeGreaterThan(0);
  });

  it('supports notification preferences', async () => {
    const targetAgent = new TargetAgent({} as any);

    await targetAgent.invoke({
      action: 'set_notification_preferences',
      user_id: 'user-1',
      preferences: {
        email: false,
        in_app: true,
        push: false,
      },
    });

    const preferences = await targetAgent.invoke({
      action: 'get_notification_preferences',
      user_id: 'user-1',
    });

    expect(preferences.data.preferences.in_app).toBe(true);
    expect(preferences.data.preferences.email).toBe(false);
  });

  it('batches notifications to reduce noise', async () => {
    const targetAgent = new TargetAgent({} as any);

    await targetAgent.invoke({
      action: 'subscribe',
      user_id: 'user-1',
      resource_id: 'value-tree-1',
      batch_interval: 1000,
    });

    for (let i = 0; i < 10; i++) {
      await targetAgent.invoke({
        value_tree_id: 'value-tree-1',
        action: 'update',
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const notifications = await targetAgent.invoke({
      action: 'get_notifications',
      user_id: 'user-1',
    });

    expect(notifications.data.notifications.length).toBe(1);
    expect(notifications.data.notifications[0].count).toBe(10);
  });
});
