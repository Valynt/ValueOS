/**
 * AgentOrchestratorAdapter Tests
 *
 * Tests for the adapter that connects the frontend to the backend
 * UnifiedAgentOrchestrator.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentOrchestratorAdapter } from '../AgentOrchestratorAdapter';
import * as agentService from '../agentService';

// Mock the agent service
vi.mock('../agentService', () => ({
  invokeAgent: vi.fn(),
  getJobStatus: vi.fn(),
  waitForJob: vi.fn(),
}));

describe('AgentOrchestratorAdapter', () => {
  let adapter: AgentOrchestratorAdapter;

  beforeEach(() => {
    adapter = new AgentOrchestratorAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    adapter.cancel();
  });



  describe('Configuration', () => {
    it('should use default configuration', () => {
      const adapter = new AgentOrchestratorAdapter();
      expect(adapter).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const config = {
        baseUrl: 'http://custom-api.com',
        pollingInterval: 500,
        maxPollingAttempts: 30,
        timeoutMs: 60000,
      };
      const adapter = new AgentOrchestratorAdapter(config);
      expect(adapter).toBeDefined();
    });
  });

  describe('invokeAgent', () => {
    it('should invoke agent and poll for results', async () => {
      const mockEvents: any[] = [];
      const onEvent = (event: any) => mockEvents.push(event);

      // Mock invokeAgent to return a job ID
      (agentService.invokeAgent as any).mockResolvedValue({
        success: true,
        data: {
          jobId: 'test-job-123',
          status: 'queued',
          agentId: 'coordinator',
        },
      });

      // Mock getJobStatus to return completed status
      (agentService.getJobStatus as any).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'completed',
        result: { message: 'Test response' },
      });

      await adapter.invokeAgent('coordinator', 'Test query', { companyName: 'Test Co' }, 'test-run-123', onEvent);

      expect(agentService.invokeAgent).toHaveBeenCalledWith('coordinator', {
        query: 'Test query',
        context: JSON.stringify({ companyName: 'Test Co' }),
      });

      expect(agentService.getJobStatus).toHaveBeenCalledWith('test-job-123');
      expect(mockEvents.length).toBeGreaterThan(0);
    });

    it('should handle errors during invocation', async () => {
      const mockEvents: any[] = [];
      const onEvent = (event: any) => mockEvents.push(event);

      (agentService.invokeAgent as any).mockResolvedValue({
        success: false,
        error: 'Agent invocation failed',
      });

      await expect(
        adapter.invokeAgent('coordinator', 'Test query', {}, 'test-run-123', onEvent)
      ).rejects.toThrow('Agent invocation failed');

      // Should have emitted an error event
      const errorEvent = mockEvents.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
    });

    it('should handle polling timeout', async () => {
      const mockEvents: any[] = [];
      const onEvent = (event: any) => mockEvents.push(event);

      (agentService.invokeAgent as any).mockResolvedValue({
        success: true,
        data: { jobId: 'test-job-123' },
      });

      // Mock getJobStatus to always return processing
      (agentService.getJobStatus as any).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'processing',
      });

      // Create adapter with short timeout for testing
      const shortTimeoutAdapter = new AgentOrchestratorAdapter({
        maxPollingAttempts: 2,
        pollingInterval: 10,
      });

      await expect(
        shortTimeoutAdapter.invokeAgent('coordinator', 'Test query', {}, 'test-run-123', onEvent)
      ).rejects.toThrow('Job polling timed out or was cancelled');
    });

    it('should handle job failure', async () => {
      const mockEvents: any[] = [];
      const onEvent = (event: any) => mockEvents.push(event);

      (agentService.invokeAgent as any).mockResolvedValue({
        success: true,
        data: { jobId: 'test-job-123' },
      });

      (agentService.getJobStatus as any).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'failed',
        error: 'Agent execution failed',
      });

      await expect(
        adapter.invokeAgent('coordinator', 'Test query', {}, 'test-run-123', onEvent)
      ).rejects.toThrow('Agent execution failed');
    });
  });

  describe('cancel', () => {
    it('should cancel ongoing operation', async () => {
      const mockEvents: any[] = [];
      const onEvent = (event: any) => mockEvents.push(event);

      (agentService.invokeAgent as any).mockResolvedValue({
        success: true,
        data: { jobId: 'test-job-123' },
      });

      // Mock getJobStatus to never complete
      (agentService.getJobStatus as any).mockImplementation(() => {
        return new Promise(() => {}); // Never resolves
      });

      // Start the operation
      const promise = adapter.invokeAgent('coordinator', 'Test query', {}, 'test-run-123', onEvent);

      // Cancel immediately
      adapter.cancel();

      // The promise should reject or resolve with cancellation
      await expect(promise).rejects.toThrow();
    });
  });

  describe('isCurrentlyStreaming', () => {
    it('should return false when not streaming', () => {
      expect(adapter.isCurrentlyStreaming).toBe(false);
    });

    it('should return true when streaming', async () => {
      (agentService.invokeAgent as any).mockResolvedValue({
        success: true,
        data: { jobId: 'test-job-123' },
      });

      (agentService.getJobStatus as any).mockImplementation(() => {
        return new Promise(() => {}); // Never resolves
      });

      const promise = adapter.invokeAgent('coordinator', 'Test query', {}, 'test-run-123');

      // Check streaming status while operation is in progress
      expect(adapter.isCurrentlyStreaming).toBe(true);

      adapter.cancel();
      await expect(promise).rejects.toThrow();
    });
  });

  describe('getCurrentJobId', () => {
    it('should return null when no job is active', () => {
      expect(adapter.getCurrentJobId()).toBe(null);
    });

    it('should return job ID when job is active', async () => {
      (agentService.invokeAgent as any).mockResolvedValue({
        success: true,
        data: { jobId: 'test-job-123' },
      });

      (agentService.getJobStatus as any).mockImplementation(() => {
        return new Promise(() => {}); // Never resolves
      });

      const promise = adapter.invokeAgent('coordinator', 'Test query', {}, 'test-run-123');

      expect(adapter.getCurrentJobId()).toBe('test-job-123');

      adapter.cancel();
      await expect(promise).rejects.toThrow();
    });
  });
});
